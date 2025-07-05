const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const connectDB = require('./config/database');
const monitoringService = require('./services/monitoring');
require('dotenv').config();

const PROTO_PATH = __dirname + '/../proto/monitoring.proto';

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const monitoring_proto = grpc.loadPackageDefinition(packageDefinition).monitoring;

const server = new grpc.Server();

server.addService(monitoring_proto.MonitoringService.service, monitoringService);

const port = process.env.PORT || 50055;

server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error(`Failed to bind server: ${err.message}`);
    return;
  }
  console.log(`Server running on port ${port}`);
  connectDB();
  server.start();
});
