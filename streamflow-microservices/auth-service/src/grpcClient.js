const { promisify } = require('util');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'user-service:50051';
const PROTO_PATH = __dirname + '/../proto/users.proto';

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const userProto = grpc.loadPackageDefinition(packageDefinition).user;
const userClient = new userProto.UserService(USER_SERVICE_URL, grpc.credentials.createInsecure());

const getUserByEmailAsync = promisify(userClient.getUserByEmail).bind(userClient);

module.exports = {
  getUserByEmailAsync,
  status: grpc.status,
};
