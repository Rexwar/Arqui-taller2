const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const { sequelize } = require('./models');
const playlistService = require('./services/playlist');
require('dotenv').config();

const PROTO_PATH = path.join(__dirname, '../proto/playlist.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const playlist_proto = grpc.loadPackageDefinition(packageDefinition).playlist;

const server = new grpc.Server();

server.addService(playlist_proto.PlaylistService.service, playlistService);

const port = process.env.PORT || 50052;

sequelize.sync().then(() => {
  console.log('Conexión a la base de datos establecida.');
  server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
      console.error('Error al iniciar el servidor:', err);
      return;
    }
    console.log(`Servidor gRPC escuchando en el puerto ${port}`);
    server.start();
  });
}).catch(err => {
  console.error('No se pudo conectar a la base de datos:', err);
});
