const { promisify } = require('util');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const USER_SERVICE_URL =  '0.0.0.0:50051';
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

const changePasswordAsync = (request) => {
  return new Promise((resolve, reject) => {
    userClient.ChangePassword(request, (error, response) => {
      if (error) {
        return reject(error);
      }
      resolve(response);
    });
  });
};

module.exports = { getUserByEmailAsync, changePasswordAsync, status: grpc.status };
