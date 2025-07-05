const grpc = require('@grpc/grpc-js');
const Action = require('../models/Action');
const ErrorModel = require('../models/Error');

const getRequesterInfo = (call) => {
  const metadata = call.metadata.getMap();
  const userId = metadata['user-id'];
  const userRole = metadata['user-role'];

  if (!userId) {
    return { error: { code: grpc.status.UNAUTHENTICATED, details: 'El usuario debe haber iniciado sesión.' } };
  }
  return { userId, userRole };
};

const monitoringService = {
  async recordAction(call, callback) {
    try {
      const { user_id, user_email, action, method, url } = call.request;
      await Action.create({ userId: user_id, userEmail: user_email, action, method, url });
      callback(null, { message: 'Action recorded successfully' });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, details: 'Failed to record action' });
    }
  },

  async recordError(call, callback) {
    try {
      const { user_id, user_email, error_message, service } = call.request;
      await ErrorModel.create({ userId: user_id, userEmail: user_email, errorMessage: error_message, service });
      callback(null, { message: 'Error recorded successfully' });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, details: 'Failed to record error' });
    }
  },

  async listActions(call, callback) {
    const { error, userRole } = getRequesterInfo(call);
    if (error) return callback(error);

    if (userRole !== 'admin') {
      return callback({ code: grpc.status.PERMISSION_DENIED, details: 'Solo los administradores pueden ver las acciones.' });
    }

    try {
      const actions = await Action.find().sort({ timestamp: -1 });
      callback(null, { actions: actions.map(a => ({...a.toObject(), id: a._id.toString(), timestamp: a.timestamp.toISOString()})) });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, details: 'Failed to retrieve actions' });
    }
  },

  async listErrors(call, callback) {
    const { error, userRole } = getRequesterInfo(call);
    if (error) return callback(error);

    if (userRole !== 'admin') {
      return callback({ code: grpc.status.PERMISSION_DENIED, details: 'Solo los administradores pueden ver los errores.' });
    }

    try {
      const errors = await ErrorModel.find().sort({ timestamp: -1 });
      callback(null, { errors: errors.map(e => ({...e.toObject(), id: e._id.toString(), timestamp: e.timestamp.toISOString()})) });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, details: 'Failed to retrieve errors' });
    }
  },
};

module.exports = monitoringService;
