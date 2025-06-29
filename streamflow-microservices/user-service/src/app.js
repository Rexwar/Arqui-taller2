const grpc = require('@grpc/grpc-js');
const { HealthImplementation } = require('grpc-health-check');
const protoLoader = require('@grpc/proto-loader');
const db = require('./db');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const path = require('path');

// Cargar definición gRPC
const PROTO_PATH = path.join(__dirname, '..', 'proto', 'users.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});
const userProto = grpc.loadPackageDefinition(packageDefinition).user;



// Implementación de servicios gRPC
const userService = {
  createUser: async (call, callback) => {
    try {
      const { name, lastname, email, password, confirmPassword, role } = call.request;

      if (password !== confirmPassword) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          details: 'Las contraseñas no coinciden'
        });
      }

      const [existing] = await db.query(
        'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL',
        [email]
      );

      if (existing.length > 0) {
        return callback({
          code: grpc.status.ALREADY_EXISTS,
          details: 'El email ya está registrado'
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const [result] = await db.query(
        'INSERT INTO users (name, lastname, email, password, role) VALUES (?, ?, ?, ?, ?)',
        [name, lastname, email, hashedPassword, role || 'Cliente']
      );

      const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId]);

      callback(null, {
        id: String(rows[0].id),
        name: rows[0].name,
        lastname: rows[0].lastname,
        email: rows[0].email,
        role: rows[0].role,
        created_at: rows[0].created_at.toISOString(),
        updated_at: rows[0].updated_at.toISOString(),
      });
    } catch (error) {
      console.error(error);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Error interno del servidor'
      });
    }
  },

  updateUser: async (call, callback) => {
    try {
      const { id, name, lastname, email } = call.request;

      const [existing] = await db.query(
        'SELECT id FROM users WHERE email = ? AND id != ? AND deleted_at IS NULL',
        [email, id]
      );

      if (existing.length > 0) {
        return callback({
          code: grpc.status.ALREADY_EXISTS,
          details: 'El email ya está en uso por otro usuario.'
        });
      }

      await db.query(
        'UPDATE users SET name = ?, lastname = ?, email = ? WHERE id = ?',
        [name, lastname, email, id]
      );

      const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);

      callback(null, {
        id: String(rows[0].id),
        name: rows[0].name,
        lastname: rows[0].lastname,
        email: rows[0].email,
        role: rows[0].role,
        created_at: rows[0].created_at.toISOString(),
        updated_at: rows[0].updated_at.toISOString(),
      });
    } catch (error) {
      console.error(error);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Error interno del servidor'
      });
    }
  },

  deleteUser: async (call, callback) => {
    try {
      const { id } = call.request;
      await db.query('UPDATE users SET deleted_at = NOW() WHERE id = ?', [id]);
      callback(null, {});
    } catch (error) {
      console.error(error);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Error interno del servidor'
      });
    }
  },

  getUserById: async (call, callback) => {
    try {
      const { id } = call.request;
      const [rows] = await db.query(
        'SELECT * FROM users WHERE id = ? AND deleted_at IS NULL',
        [id]
      );

      if (rows.length === 0) {
        return callback({
          code: grpc.status.NOT_FOUND,
          details: 'Usuario no encontrado'
        });
      }

      const user = rows[0];
      callback(null, {
        id: String(user.id),
        name: user.name,
        lastname: user.lastname,
        email: user.email,
        role: user.role,
        created_at: user.created_at.toISOString(),
        updated_at: user.updated_at.toISOString(),
      });
    } catch (error) {
      console.error(error);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Error interno del servidor'
      });
    }
  },

  getUserByEmail: async (call, callback) => {
    try {
      const { email } = call.request;

      const [rows] = await db.query(
        'SELECT * FROM users WHERE email = ? AND deleted_at IS NULL',
        [email]
      );

      if (rows.length === 0) {
        return callback({
          code: grpc.status.NOT_FOUND,
          details: 'User not found'
        });
      }

      const user = rows[0];
      callback(null, {
        id: String(user.id),
        name: user.name,
        lastname: user.lastname,
        email: user.email,
        password: user.password,
        role: user.role,
        created_at: user.created_at.toISOString(),
        updated_at: user.updated_at.toISOString(),
      });
    } catch (error) {
      console.error(error);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Error interno del servidor'
      });
    }
  },

  listAllUsers: async (call, callback) => {
    try {
      const { search } = call.request;
      let query = 'SELECT id, name, lastname, email, role, created_at, updated_at FROM users WHERE deleted_at IS NULL';
      const params = [];

      if (search) {
        query += ' AND (name LIKE ? OR lastname LIKE ? OR email LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      const [rows] = await db.query(query, params);

      const users = rows.map(user => ({
        id: String(user.id),
        name: user.name,
        lastname: user.lastname,
        email: user.email,
        role: user.role,
        created_at: user.created_at.toISOString(),
        updated_at: user.updated_at.toISOString(),
      }));

      callback(null, { users });
    } catch (error) {
      console.error(error);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Error interno del servidor'
      });
    }
  }
};

// Crear y arrancar el servidor gRPC

if (require.main === module) {
  const server = new grpc.Server();

  const healthImpl = new HealthImplementation({
    '': 'SERVING',
    'user.UserService': 'SERVING'
  });
  server.addService(healthImpl.service, healthImpl);

  server.addService(userProto.UserService.service, userService);

  const port = process.env.PORT || 50051;
  server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log(`User service running on port ${port}`);
    server.start();
  });
}
