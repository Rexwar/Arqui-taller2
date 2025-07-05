const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

let userServiceClient;
let billingServiceClient;

try {
    console.log('Setting up gRPC clients...');

    // --- User Service Client ---
    const USER_PROTO_PATH = path.join(__dirname, 'proto', 'users.proto');
    const userPackageDefinition = protoLoader.loadSync(USER_PROTO_PATH, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
    });
    const userProto = grpc.loadPackageDefinition(userPackageDefinition).user;
    if (!userProto) {
        throw new Error('Failed to load user package from proto file.');
    }
    const isTestEnv = process.env.NODE_ENV === 'test';
    const userServiceUrl = process.env.USER_SERVICE_URL || (isTestEnv ? 'localhost:50051' : 'user-service:50051');
    console.log(`Connecting to User Service at: ${userServiceUrl}`);
    userServiceClient = new userProto.UserService(
        userServiceUrl,
        grpc.credentials.createInsecure()
    );
    console.log('gRPC client for User Service created successfully.');

    // --- Billing Service Client ---
    const BILLING_PROTO_PATH = path.join(__dirname, 'proto', 'billing.proto');
    const billingPackageDefinition = protoLoader.loadSync(BILLING_PROTO_PATH, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
    });
    const billingProto = grpc.loadPackageDefinition(billingPackageDefinition).billing;
    if (!billingProto) {
        throw new Error('Failed to load billing package from proto file.');
    }
    const billingServiceUrl = process.env.BILLING_SERVICE_URL || (isTestEnv ? 'localhost:50054' : 'billing-service:50054');
    console.log(`Connecting to Billing Service at: ${billingServiceUrl}`);
    billingServiceClient = new billingProto.BillingService(
        billingServiceUrl,
        grpc.credentials.createInsecure()
    );
    console.log('gRPC client for Billing Service created successfully.');

} catch (error) {
    console.error('Failed to setup gRPC clients:', error);
    process.exit(1);
}

module.exports = { userServiceClient, billingServiceClient };
