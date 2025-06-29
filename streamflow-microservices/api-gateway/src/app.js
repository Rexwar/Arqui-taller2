const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const morgan = require('morgan');
require('dotenv').config();
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const app = express();

// Middlewares
app.use(morgan('dev'));
app.use(express.json()); // Middleware to parse JSON bodies

// --- gRPC Client Setup for User Service ---
try {
  console.log('Setting up gRPC client...');
  const PROTO_PATH = path.join(__dirname, 'proto', 'users.proto');
  console.log(`Loading proto file from: ${PROTO_PATH}`);
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });
  console.log('Proto file loaded successfully.');
  console.log('Inspecting package definition:', JSON.stringify(packageDefinition, null, 2));
  const userProto = grpc.loadPackageDefinition(packageDefinition).user;
  if (!userProto) {
      console.error('Failed to load user package from proto file.');
      process.exit(1);
  }
  console.log('User package loaded successfully.');
  var userServiceClient = new userProto.UserService(
    process.env.USER_SERVICE_URL || 'user-service:50051',
    grpc.credentials.createInsecure()
  );
  console.log('gRPC client for User Service created successfully.');
} catch (error) {
    console.error('Failed to setup gRPC client:', error);
    process.exit(1);
}

// --- HTTP Proxy Middlewares for other services ---
const services = [
  { route: '/auth', target: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001' },
  { route: '/playlists', target: process.env.PLAYLIST_SERVICE_URL || 'http://playlist-service:3002' },
  { route: '/videos', target: process.env.VIDEO_SERVICE_URL || 'http://video-service:3003' },
  { route: '/billing', target: process.env.BILLING_SERVICE_URL || 'http://billing-service:3005' },
  { route: '/monitoring', target: process.env.MONITORING_SERVICE_URL || 'http://monitoring-service:3006' },
  { route: '/social', target: process.env.SOCIAL_SERVICE_URL || 'http://social-service:3004' },
];

services.forEach(({ route, target }) => {
  app.use(route, createProxyMiddleware({ 
    target, 
    changeOrigin: true,
    onError: (err, req, res) => {
      console.error(`Proxy error for ${route}:`, err);
      res.status(500).send('Proxy error');
    }
  }));
});

// --- gRPC Routes for User Service ---
app.post('/usuarios', (req, res) => {
  console.log('Received POST /usuarios request');
  const { nombre, apellido, email, password, confirmacion_password, rol } = req.body;
  console.log('Request body:', req.body);
  
  const createUserRequest = {
    name: nombre,
    lastname: apellido,
    email: email,
    password: password,
    confirmPassword: confirmacion_password,
    role: rol
  };

  console.log('Calling gRPC createUser with:', createUserRequest);
  try {
    userServiceClient.createUser(createUserRequest, (error, response) => {
      if (error) {
        console.error('gRPC Error received:', error); // Log the full error object
        switch (error.code) {
          case grpc.status.INVALID_ARGUMENT:
            return res.status(400).json({ error: error.details });
          case grpc.status.ALREADY_EXISTS:
            return res.status(409).json({ error: error.details });
          default:
            return res.status(500).json({ error: 'Internal Server Error' });
        }
      } else {
        console.log('gRPC response received:', response);
        const { password, ...user } = response;
        return res.status(201).json(user);
      }
    });
  } catch (e) {
    console.error('Synchronous error during gRPC call:', e);
    res.status(500).json({ error: 'Failed to call user service.' });
  }
});


// Health and Root endpoints
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.get('/', (req, res) => {
    res.send('API Gateway is running');
});

const PORT = process.env.PORT || 8088;
app.listen(PORT, () => {
  console.log(`API Gateway escuchando en puerto ${PORT}`);
});
