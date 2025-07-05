require('dotenv').config();
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { connectDB, sequelize } = require('./config/database');
const billingService = require('./services/billing');
const { connectRabbitMQ } = require('./utils/messageQueue');

const PROTO_PATH = __dirname + '/../proto/billing.proto';

// Load proto definition
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const billingProto = grpc.loadPackageDefinition(packageDefinition).billing;

const server = new grpc.Server();

// Add Billing Service
server.addService(billingProto.BillingService.service, billingService);

const PORT = process.env.PORT || 50054;

const startServer = async () => {
  try {
    await connectDB();
    await sequelize.sync(); // Sincroniza los modelos con la base de datos
    console.log('Modelos sincronizados con la base de datos.');
    await connectRabbitMQ(); // Conectar a RabbitMQ

    server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
      if (err) {
        console.error(' Failed to bind server:', err);
        return;
      }
      console.log(` Billing service running on port ${port}`);
      server.start();
    });
    //console.log(`Billing service running on port ${PORT}`);
  } catch (error) {
    console.error(' No se pudo iniciar el servidor:', error);
    process.exit(1);
  }
};

startServer();
