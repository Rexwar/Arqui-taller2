const express = require('express');
const morgan = require('morgan');
require('dotenv').config();

// Import modular components
const { userServiceClient, billingServiceClient } = require('./grpcClient');
const { authenticate } = require('./middleware/auth');
const { createMetadata, handleGrpcError } = require('./grpcHelpers');
const createProxyRoutes = require('./routes/proxy.routes');
const createAuthRoutes = require('./routes/auth.routes');
const createUserRoutes = require('./routes/user.routes');
const createBillingRoutes = require('./routes/billingRoutes');

const app = express();

// Middlewares
app.use(morgan('dev'));
app.use(express.json());

// --- Route Setup ---

// Initialize and mount proxy routes for other services
const proxyRouter = createProxyRoutes();
app.use('/', proxyRouter);

// Initialize and mount auth routes with explicit validation
const authRouter = createAuthRoutes(authenticate);
app.use('/auth', authRouter);

// Initialize and mount gRPC user routes
const userRouter = createUserRoutes(userServiceClient, createMetadata, handleGrpcError, authenticate);
app.use('/usuarios', userRouter);

// Initialize and mount gRPC billing routes
const billingRouter = createBillingRoutes(billingServiceClient, authenticate);
app.use('/facturas', billingRouter);

// --- Health and Root Endpoints ---
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.get('/', (req, res) => {
    res.send('API Gateway is running and routing traffic.');
});

// --- Server Startup ---
const PORT = process.env.PORT || 8088;
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`API Gateway escuchando en puerto ${PORT}`);
    });
}

module.exports = app;
