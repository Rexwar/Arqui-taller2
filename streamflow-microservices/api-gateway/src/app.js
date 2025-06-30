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
  //console.log('Inspecting package definition:', JSON.stringify(packageDefinition, null, 2));
  const userProto = grpc.loadPackageDefinition(packageDefinition).user;
  if (!userProto) {
      console.error('Failed to load user package from proto file.');
      process.exit(1);
  }
  console.log('User package loaded successfully.');
  const isTestEnv = process.env.NODE_ENV === 'test';
  const userServiceUrl = process.env.USER_SERVICE_URL || (isTestEnv ? 'localhost:50051' : 'user-service:50051');

  console.log(`Connecting to User Service at: ${userServiceUrl}`);

  var userServiceClient = new userProto.UserService(
    userServiceUrl,
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

// --- Authentication Middleware (Simulated) ---
const authenticate = (req, res, next) => {
  req.userId = req.headers['x-user-id'] || null;
  req.userRole = req.headers['x-user-role'] || 'Cliente'; // Default to 'Cliente' if not provided
  next();
};

app.use('/usuarios', authenticate); // Apply middleware to all user routes

// --- gRPC Metadata Helper ---
const createMetadata = (req) => {
  const metadata = new grpc.Metadata();
  if (req.userId) metadata.set('x-user-id', String(req.userId)); // Ensure it's a string
  if (req.userRole) metadata.set('x-user-role', req.userRole);
  return metadata;
};

// --- gRPC Error Handler ---
const handleGrpcError = (res, error) => {
  console.error('gRPC Error:', error.details || error.message);
  switch (error.code) {
    case grpc.status.INVALID_ARGUMENT:
      return res.status(400).json({ error: error.details });
    case grpc.status.NOT_FOUND:
      return res.status(404).json({ error: error.details });
    case grpc.status.ALREADY_EXISTS:
      return res.status(409).json({ error: error.details });
    case grpc.status.PERMISSION_DENIED:
      return res.status(403).json({ error: error.details });
    case grpc.status.UNAUTHENTICATED:
      return res.status(401).json({ error: error.details });
    default:
      return res.status(500).json({ error: 'Internal Server Error' });
  }
};


// --- gRPC Routes for User Service ---

// Create User
app.post('/usuarios', (req, res) => {
  const { nombre, apellido, email, password, confirmacion_password, rol } = req.body;
  const metadata = createMetadata(req);
  const request = {
    name: nombre,
    lastname: apellido,
    email,
    password,
    confirmPassword: confirmacion_password,
    role: rol
  };

  userServiceClient.createUser(request, metadata, (error, response) => {
    if (error) return handleGrpcError(res, error);
    const { password, ...user } = response;
    res.status(201).json(user);
  });
});

// Get User by ID
app.get('/usuarios/:id', (req, res) => {
  const metadata = createMetadata(req);
  const request = { id: req.params.id };

  userServiceClient.getUserById(request, metadata, (error, response) => {
    if (error) return handleGrpcError(res, error);
    const { password, ...user } = response;
    res.status(200).json(user);
  });
});

// List All Users
app.get('/usuarios', (req, res) => {
  const { name_lastname, email } = req.query;
  const metadata = createMetadata(req);
  const request = { name_lastname, email };

  userServiceClient.listAllUsers(request, metadata, (error, response) => {
    if (error) return handleGrpcError(res, error);
    // Sanitize password from all users in the list
    const users = response.users.map(u => {
      const { password, ...user } = u;
      return user;
    });
    res.status(200).json({ users });
  });
});

// Update User
app.put('/usuarios/:id', (req, res) => {
  const { nombre, apellido, email, password } = req.body;
  const metadata = createMetadata(req);
  const request = {
    id: req.params.id,
    name: nombre,
    lastname: apellido,
    email,
    password
  };

  userServiceClient.updateUser(request, metadata, (error, response) => {
    if (error) return handleGrpcError(res, error);
    const { password, ...user } = response;
    res.status(200).json(user);
  });
});

// Delete User
app.delete('/usuarios/:id', (req, res) => {
  const metadata = createMetadata(req);
  const request = { id: req.params.id };

  userServiceClient.deleteUser(request, metadata, (error, response) => {
    if (error) return handleGrpcError(res, error);
    res.status(200).json(response);
  });
});


// Health and Root endpoints
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.get('/', (req, res) => {
    res.send('API Gateway is running');
});

const PORT = process.env.PORT || 8088;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`API Gateway escuchando en puerto ${PORT}`);
  });
}

module.exports = app;
