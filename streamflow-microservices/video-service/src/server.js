require('dotenv').config();
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const videoService = require('./services/video');
const { service: healthService, HealthImplementation } = require('grpc-health-check');
const connectDB = require('./config/database');

const PROTO_PATH = path.join(__dirname, 'proto/videos.proto');

// Cargar definición del proto
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const videoProto = grpc.loadPackageDefinition(packageDefinition).videos;

const server = new grpc.Server();

// Health Check Service
const healthImpl = new HealthImplementation();
// Esto ahora sí está bien:
server.addService(healthService, healthImpl);

// Video Service
server.addService(videoProto.VideoService.service, videoService);

const port = process.env.PORT || 50053;

// Conectar a la base de datos
connectDB();

server.bindAsync(
  `0.0.0.0:${port}`,
  grpc.ServerCredentials.createInsecure(),
  (err, actualPort) => {
    if (err) {
      console.error('❌ Failed to bind server:', err);
      return;
    }
    console.log(`✅ Video service running on port ${actualPort}`);
    server.start();
  }
);
