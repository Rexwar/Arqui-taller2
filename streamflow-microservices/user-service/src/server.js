const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { HealthImplementation, service: healthService } = require('grpc-health-check');
const userService = require('./services/user');
require('dotenv').config();

// --- Proto Loading ---
const PROTO_PATH = __dirname + '/proto/users.proto'; // Adjusted path
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});
const userProto = grpc.loadPackageDefinition(packageDefinition).user;

// --- Server Setup ---
const server = new grpc.Server();

// Health Check Service
const healthImpl = new HealthImplementation({
  '': 'SERVING',
  'user.UserService': 'SERVING'
});
server.addService(healthService, healthImpl);

// User Service
server.addService(userProto.UserService.service, userService);

// --- Start Server ---
const port = process.env.PORT || 50051;
server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
  if (err) {
    console.error('Failed to bind server:', err);
    return;
  }
  console.log(`User service running on port ${boundPort}`);
  server.start();
});
