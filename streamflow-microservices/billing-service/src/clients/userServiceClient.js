const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
require('dotenv').config();

const USER_PROTO_PATH = path.join(__dirname, '../../..', 'user-service', 'src', 'proto', 'users.proto');

const packageDefinition = protoLoader.loadSync(USER_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const user_proto = grpc.loadPackageDefinition(packageDefinition).user;

const USER_SERVICE_ADDR = process.env.USER_SERVICE_ADDR || 'user-service:50051';

const userServiceClient = new user_proto.UserService(USER_SERVICE_ADDR, grpc.credentials.createInsecure());

module.exports = userServiceClient;
