const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const connectDB = require('./config/database');
const socialService = require('./services/social');
require('dotenv').config();

const PROTO_PATH = path.join(__dirname, '../proto/social.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const social_proto = grpc.loadPackageDefinition(packageDefinition).social;

const server = new grpc.Server();

server.addService(social_proto.SocialService.service, socialService);

const port = process.env.PORT || 50053;

connectDB().then(() => {
  server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
      console.error('Error al iniciar el servidor:', err);
      return;
    }
    console.log(`Servidor gRPC escuchando en el puerto ${port}`);
    server.start();
  });
});
