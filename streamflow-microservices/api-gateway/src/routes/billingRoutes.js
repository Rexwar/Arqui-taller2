const express = require('express');
const {
  createMetadata,
  handleGrpcError,
} = require('../grpcHelpers');

const createBillingRoutes = (billingServiceClient, authenticate) => {
  const router = express.Router();

  // 1. Create Invoice
  router.post('/', authenticate, (req, res) => {
    const { userId, status, amount } = req.body;
    const metadata = createMetadata(req);

    billingServiceClient.createInvoice({ user_id: userId, status, amount }, metadata, (error, response) => {
      if (error) return handleGrpcError(res, error);
      res.status(201).json(response);
    });
  });

  // 2. Get Invoice by ID
  router.get('/:id', authenticate, (req, res) => {
    const metadata = createMetadata(req);
    billingServiceClient.getInvoiceById({ id: req.params.id }, metadata, (error, response) => {
      if (error) return handleGrpcError(res, error);
      res.json(response);
    });
  });

  // 3. Update Invoice Status
  router.patch('/:id', authenticate, (req, res) => {
    const { status } = req.body;
    const metadata = createMetadata(req);
    billingServiceClient.updateInvoiceStatus({ id: req.params.id, status }, metadata, (error, response) => {
      if (error) return handleGrpcError(res, error);
      res.json(response);
    });
  });

  // 4. Delete Invoice
  router.delete('/:id', authenticate, (req, res) => {
    const metadata = createMetadata(req);
    billingServiceClient.deleteInvoice({ id: req.params.id }, metadata, (error, response) => {
      if (error) return handleGrpcError(res, error);
      res.json(response);
    });
  });

  // 5. List Invoices (for a specific user or all)
  router.get('/', authenticate, (req, res) => {
    const { userId, status } = req.query;
    const metadata = createMetadata(req);
    const request = { user_id: userId, status };

    billingServiceClient.listInvoices(request, metadata, (error, response) => {
      if (error) return handleGrpcError(res, error);
      res.json(response);
    });
  });

  return router;
};

module.exports = createBillingRoutes;
