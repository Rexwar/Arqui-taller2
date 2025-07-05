const grpc = require('@grpc/grpc-js');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { publishToQueue } = require('../utils/messageQueue');

// --- Helper Functions ---
const getRequesterInfo = (call) => {
  const metadata = call.metadata.getMap();
  return {
    id: metadata['x-user-id'],
    role: metadata['x-user-role']
  };
};

// --- Service Implementation ---
const userService = {
  createUser: async (call, callback) => {
    try {
      const { name, lastname, email, password, confirmPassword, role = 'Cliente' } = call.request;

      if (!['Administrador', 'Cliente'].includes(role)) {
        return callback({ code: grpc.status.INVALID_ARGUMENT, details: 'Rol inválido. Debe ser Administrador o Cliente.' });
      }

      if (role === 'Administrador') {
        const requester = getRequesterInfo(call);
        //console.log('Requester:', requester);
        if (!requester.id || requester.role !== 'Administrador') {
          return callback({ code: grpc.status.PERMISSION_DENIED, details: 'No tiene permisos para crear un administrador.' });
        }
      }

      if (password !== confirmPassword) {
        return callback({ code: grpc.status.INVALID_ARGUMENT, details: 'Las contraseñas no coinciden' });
      }

      const existing = await prisma.user.findFirst({ where: { email } });

      if (existing) {
        return callback({ code: grpc.status.ALREADY_EXISTS, details: 'El correo electrónico ya está en uso.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await prisma.user.create({
        data: { name, lastname, email, password: hashedPassword, role }
      });
      
            // Publicar mensaje en RabbitMQ para notificar a otros servicios
      const message = { id: newUser.id, email: newUser.email, name: newUser.name };
      publishToQueue('user_created_queue', message);

      const { password: _, ...userResponse } = newUser;
      // debe retornar los datos del usuario creado
      callback(null, userResponse);

    } catch (error) {
      console.error('Error creating user:', error);
      callback({ code: grpc.status.INTERNAL, details: 'Error interno al crear el usuario.' });
    }
  },

  getUserById: async (call, callback) => {
    try {
      const userId = parseInt(call.request.id, 10);
      const requester = getRequesterInfo(call);

      if (requester.role === 'Cliente' && requester.id != userId) {
        return callback({ code: grpc.status.PERMISSION_DENIED, details: 'No tiene permisos para ver este usuario.' });
      }

      const user = await prisma.user.findFirst({ 
        where: { id: userId },
        select: { id: true, name: true, lastname: true, email: true, role: true, created_at: true}
      });

      if (!user) {
        return callback({ code: grpc.status.NOT_FOUND, details: 'Usuario no encontrado.' });
      }
      //response
      callback(null, {
        ...user,
        created_at: user.created_at.toISOString(), // si es Date
      });
    } catch (error) {
      console.error('Error getting user by ID:', error);
      callback({ code: grpc.status.INTERNAL, details: 'Error interno al obtener el usuario.' });
    }
  },

  getUserByEmail: async (call, callback) => {
    try {
      const { email } = call.request;
      const user = await prisma.user.findFirst({
        where: { email },
        select: { id: true, name: true, lastname: true, email: true, role: true, password: true, created_at: true}
      });

      if (!user) {
        return callback({ code: grpc.status.NOT_FOUND, details: 'Usuario no encontrado.' });
      }

      callback(null, user);
    } catch (error) {
      console.error('Error getting user by email:', error);
      callback({ code: grpc.status.INTERNAL, details: 'Error interno al obtener el usuario.' });
    }
  },

  updateUser: async (call, callback) => {
    try {
      const userId = parseInt(call.request.id, 10);
      const { name, lastname, email, role } = call.request;
      const requester = getRequesterInfo(call);

      if (requester.role === 'Cliente' && requester.id != userId) {
        return callback({ code: grpc.status.PERMISSION_DENIED, details: 'No tiene permisos para actualizar este usuario.' });
      }
      
      if (role && requester.role !== 'Administrador') {
        return callback({ code: grpc.status.PERMISSION_DENIED, details: 'No tiene permisos para cambiar el rol del usuario.' });
      }

      const updateData = {};
      if (name) updateData.name = name;
      if (lastname) updateData.lastname = lastname;
      if (email) {
        const existing = await prisma.user.findFirst({ where: { email, id: { not: userId } } });
        if (existing) {
          return callback({ code: grpc.status.ALREADY_EXISTS, details: 'El correo electrónico ya está en uso.' });
        }
        updateData.email = email;
      }
      if (role) updateData.role = role;

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: { id: true, name: true, lastname: true, email: true, role: true }
      });

      callback(null, updatedUser);
    } catch (error) {
      if (error.code === 'P2025') {
        return callback({ code: grpc.status.NOT_FOUND, details: 'Usuario no encontrado.' });
      }
      if (error.code === 'P2002') {
        return callback({ code: grpc.status.ALREADY_EXISTS, details: 'El correo electrónico ya está en uso.' });
      }
      console.error('Error updating user:', error);
      callback({ code: grpc.status.INTERNAL, details: 'Error interno al actualizar el usuario.' });
    }
  },

  deleteUser: async (call, callback) => {
    try {
      const userId = parseInt(call.request.id, 10);
      const requester = getRequesterInfo(call);

      if (requester.role !== 'Administrador') {
        return callback({ code: grpc.status.PERMISSION_DENIED, details: 'No tiene permisos para eliminar usuarios.' });
      }
      
      await prisma.user.delete({
        where: { id: userId }
      });

      callback(null, { message: 'Usuario eliminado correctamente.' });
    } catch (error) {
      if (error.code === 'P2025') {
        return callback({ code: grpc.status.NOT_FOUND, details: 'Usuario no encontrado.' });
      }
      console.error('Error deleting user:', error);
      callback({ code: grpc.status.INTERNAL, details: 'Error interno al eliminar el usuario.' });
    }
  },

  listAllUsers: async (call, callback) => {
    try {
      const requester = getRequesterInfo(call);
      const { page = 1, limit = 10, role, name } = call.request;
      const skip = (page - 1) * limit;

      if (requester.role !== 'Administrador') {
        return callback({ code: grpc.status.PERMISSION_DENIED, details: 'No tiene permisos para listar usuarios.' });
      }

      const where = {};
      if (role) where.role = role;
      if (name) {
        where.OR = [
          { name: { contains: name } },
          { lastname: { contains: name } },
        ];
      }

      const users = await prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit, 10),
        select: { id: true, name: true, lastname: true, email: true, role: true, created_at: true}
      });

      const total = await prisma.user.count({ where });

      callback(null, { users, total: total, page: page, limit: limit });
    } catch (error) {
      console.error('Error listing users:', error);
      callback({ code: grpc.status.INTERNAL, details: 'Error interno al listar los usuarios.' });
    }
  },

  changePassword: async (call, callback) => {
    try {
      const { id, password } = call.request;
      const userId = parseInt(id, 10);

      if (!password) {
        return callback({ code: grpc.status.INVALID_ARGUMENT, details: 'La nueva contraseña es requerida.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      callback(null, {});
    } catch (error) {
      if (error.code === 'P2025') {
        return callback({ code: grpc.status.NOT_FOUND, details: 'Usuario no encontrado.' });
      }
      console.error('Error changing password:', error);
      callback({ code: grpc.status.INTERNAL, details: 'Error interno al cambiar la contraseña.' });
    }
  }
};

module.exports = userService;
