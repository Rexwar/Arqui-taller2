const grpc = require('@grpc/grpc-js');
const Invoice = require('../models/Invoice');
const { publishToQueue } = require('../utils/messageQueue');
const userServiceClient = require('../clients/userServiceClient');

// --- Helper Functions ---

// Extracts user info from gRPC metadata
const getRequesterInfo = (call) => {
  const metadata = call.metadata.getMap();
  const userId = metadata['user-id'];
  const userRole = metadata['user-role'];

  if (!userId) {
    return { error: { code: grpc.status.UNAUTHENTICATED, details: 'El usuario debe haber iniciado sesión.' } };
  }
  return { userId, userRole };
};

// Converts a Sequelize model instance to a gRPC response object
const toInvoiceResponse = (invoice) => {
  if (!invoice) {
    return {};
  }
  return {
    id: invoice.id.toString(),
    user_id: invoice.userId,
    status: invoice.status,
    amount: invoice.amount,
    emission_date: invoice.emissionDate ? new Date(invoice.emissionDate).toISOString() : '',
    payment_date: invoice.paymentDate ? new Date(invoice.paymentDate).toISOString() : '',
  };
};

// --- Service Implementation ---

const billingService = {
  // 1. Create Invoice
  createInvoice: async (call, callback) => {
    const { error, userRole } = getRequesterInfo(call);
    if (error) return callback(error);

    if (userRole !== 'admin') {
      return callback({ code: grpc.status.PERMISSION_DENIED, details: 'Solo los administradores pueden crear facturas.' });
    }

    const { user_id, status, amount } = call.request;

    if (!user_id || !status || amount == null) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, details: 'user_id, status, and amount are required.' });
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, details: 'El monto debe ser un número entero positivo.' });
    }

    const validStatus = ['Pendiente', 'Pagado', 'Vencido'];
    if (!validStatus.includes(status)) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, details: 'El estado de la factura debe ser Pendiente, Pagado o Vencido.' });
    }

    try {
      const newInvoice = await Invoice.create({
        userId: user_id,
        status,
        amount,
        paymentDate: status === 'Pagado' ? new Date() : null,
      });
      callback(null, toInvoiceResponse(newInvoice));
    } catch (err) {

      callback({ code: grpc.status.INTERNAL, details: 'Error al crear la factura.' });
    }
  },

  // 2. Get Invoice By ID
  getInvoiceById: async (call, callback) => {
    const { error, userId, userRole } = getRequesterInfo(call);
    if (error) return callback(error);

    try {
      const invoice = await Invoice.findByPk(call.request.id);

      if (!invoice) {
        return callback({ code: grpc.status.NOT_FOUND, details: 'Factura no encontrada.' });
      }

      if (userRole !== 'admin' && invoice.userId.toString() !== userId) {
        return callback({ code: grpc.status.PERMISSION_DENIED, details: 'No tiene permisos para consultar esta factura.' });
      }

      callback(null, toInvoiceResponse(invoice));
    } catch (err) {

      callback({ code: grpc.status.INTERNAL, details: 'Error al obtener la factura.' });
    }
  },

  // 3. Update Invoice Status
  updateInvoiceStatus: async (call, callback) => {
    const { error, userRole } = getRequesterInfo(call);
    if (error) return callback(error);

    if (userRole !== 'admin') {
      return callback({ code: grpc.status.PERMISSION_DENIED, details: 'Solo los administradores pueden actualizar facturas.' });
    }

    try {
      const { id, status } = call.request;
      const validStatus = ['Pagado', 'Vencido'];
      if (!validStatus.includes(status)) {
        return callback({ code: grpc.status.INVALID_ARGUMENT, details: 'El estado de la factura solo puede ser Pagado o Vencido.' });
      }

      const invoice = await Invoice.findByPk(id);

      if (!invoice) {
        return callback({ code: grpc.status.NOT_FOUND, details: 'Factura no encontrada.' });
      }

      const updateData = { status };
      if (status === 'Pagado') {
        updateData.paymentDate = new Date();
      }

      await invoice.update(updateData);

      // Obtener el email del usuario para enviar la notificación
      userServiceClient.GetUserById({ id: invoice.userId }, (err, userResponse) => {
        if (err || !userResponse) {
          console.error('Error al obtener los detalles del usuario para la notificación:', err);
          // A pesar del error, la operación principal fue exitosa
          return callback(null, toInvoiceResponse(invoice));
        }

        // Publicar mensaje en RabbitMQ
        const message = {
          id: invoice.id,
          userEmail: userResponse.email,
          amount: invoice.amount,
          status: invoice.status,
        };
        publishToQueue('invoice_updated_queue', message);

        callback(null, toInvoiceResponse(invoice));
      });
    } catch (err) {

      callback({ code: grpc.status.INTERNAL, details: 'Error al actualizar la factura.' });
    }
  },

  // 4. Delete Invoice
  deleteInvoice: async (call, callback) => {
    const { error, userRole } = getRequesterInfo(call);
    if (error) return callback(error);

    if (userRole !== 'admin') {
      return callback({ code: grpc.status.PERMISSION_DENIED, details: 'Solo los administradores pueden eliminar facturas.' });
    }

    try {
      const invoice = await Invoice.findByPk(call.request.id);

      if (!invoice) {
        return callback({ code: grpc.status.NOT_FOUND, details: 'Factura no encontrada.' });
      }

      if (invoice.status === 'Pagado') {
        return callback({ code: grpc.status.FAILED_PRECONDITION, details: 'No se puede eliminar una factura en estado pagado.' });
      }

      await invoice.destroy(); // Soft delete
      callback(null, { message: 'Factura eliminada correctamente.' });
    } catch (err) {

      callback({ code: grpc.status.INTERNAL, details: 'Error al eliminar la factura.' });
    }
  },

  // 5. List Invoices
  listInvoices: async (call, callback) => {
    const { error, userId, userRole } = getRequesterInfo(call);
    if (error) {
      return callback(error);
    }

    try {
      const where = {};

      if (userRole !== 'admin') {
        if (call.request.user_id && call.request.user_id !== userId) {
          return callback({
            code: grpc.status.PERMISSION_DENIED,
            details: 'No tiene permisos para consultar las facturas de otro usuario.',
          });
        }
        where.userId = userId;
      } else if (call.request.user_id) {
        where.userId = call.request.user_id;
      }

      if (call.request.status) {
        where.status = call.request.status;
      }

      const invoices = await Invoice.findAll({ where });
      const response = { invoices: invoices.map(toInvoiceResponse) };
      console.log(response);
      callback(null, response);
    } catch (err) {

      callback({ code: grpc.status.INTERNAL, details: 'Error al listar las facturas.' });
    }
  },
};

module.exports = billingService;
