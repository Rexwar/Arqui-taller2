const grpc = require('@grpc/grpc-js');
const bcrypt = require('bcryptjs');
const { mockDeep, mockReset } = require('jest-mock-extended');
const userService = require('../services/user');
const prisma = require('../config/prisma');

// --- Mocking Setup ---
jest.mock('../config/prisma', () => mockDeep());
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const mockPrisma = prisma;

// --- Mock Data and Helpers ---
const mockDate = new Date('2023-01-01T00:00:00.000Z');
const mockAdmin = {
  id: 1, name: 'Admin', lastname: 'User', email: 'admin@example.com',
  password: 'hashedpassword', role: 'Administrador', created_at: mockDate, updated_at: mockDate, deleted_at: null
};
const mockClient = {
  id: 2, name: 'Client', lastname: 'User', email: 'client@example.com',
  password: 'hashedpassword', role: 'Cliente', created_at: mockDate, updated_at: mockDate, deleted_at: null
};

const createMockCall = (request, metadata = {}) => {
  const call = { request };
  call.metadata = new grpc.Metadata();
  if (metadata['x-user-id']) call.metadata.add('x-user-id', String(metadata['x-user-id']));
  if (metadata['x-user-role']) call.metadata.add('x-user-role', metadata['x-user-role']);
  return call;
};

const adminCall = (request) => createMockCall(request, { 'x-user-id': mockAdmin.id, 'x-user-role': 'Administrador' });
const clientCall = (request) => createMockCall(request, { 'x-user-id': mockClient.id, 'x-user-role': 'Cliente' });
const unauthenticatedCall = (request) => createMockCall(request);

// --- Test Suite ---
describe('User Service (Prisma)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReset(mockPrisma);
  });

  // --- Tests for createUser ---
  describe('createUser', () => {
    it('should create a new client user successfully', (done) => {
      const newUserRequest = { name: 'New', lastname: 'User', email: 'new@test.com', password: 'password123', confirmPassword: 'password123', role: 'Cliente' };
      const createdUser = { ...newUserRequest, id: 3, created_at: mockDate, updated_at: mockDate };
      
      mockPrisma.user.findFirst.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue('hashedpassword');
      mockPrisma.user.create.mockResolvedValue(createdUser);

      userService.createUser(unauthenticatedCall(newUserRequest), (err, res) => {
        expect(err).toBeNull();
        expect(res.user.email).toBe(newUserRequest.email);
        expect(res.user.password).toBeUndefined();
        done();
      });
    });

    it('should fail if email already exists', (done) => {
        const newUserRequest = { name: 'New', lastname: 'User', email: 'client@example.com', password: 'password123', confirmPassword: 'password123' };
        mockPrisma.user.findFirst.mockResolvedValue(mockClient);
  
        userService.createUser(unauthenticatedCall(newUserRequest), (err, res) => {
          expect(err.code).toBe(grpc.status.ALREADY_EXISTS);
          done();
        });
      });
  });

  // --- Tests for getUserById ---
  describe('getUserById', () => {
    it('should allow an admin to get any user', (done) => {
      mockPrisma.user.findFirst.mockResolvedValue(mockClient);
      userService.getUserById(adminCall({ id: '2' }), (err, res) => {
        expect(err).toBeNull();
        expect(res.user.id).toBe(mockClient.id);
        done();
      });
    });

    it('should deny a client from getting another user', (done) => {
      userService.getUserById(clientCall({ id: '1' }), (err, res) => {
        expect(err.code).toBe(grpc.status.PERMISSION_DENIED);
        done();
      });
    });
  });

  // --- Tests for updateUser ---
  describe('updateUser', () => {
    it('should allow a client to update their own info', (done) => {
      const updateRequest = { id: '2', name: 'Updated Name' };
      const updatedUser = { ...mockClient, name: 'Updated Name' };
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      userService.updateUser(clientCall(updateRequest), (err, res) => {
        expect(err).toBeNull();
        expect(res.user.name).toBe('Updated Name');
        done();
      });
    });

    it('should deny a client from changing their role', (done) => {
        const updateRequest = { id: '2', role: 'Administrador' };
        userService.updateUser(clientCall(updateRequest), (err, res) => {
          expect(err.code).toBe(grpc.status.PERMISSION_DENIED);
          done();
        });
      });
  });

  // --- Tests for deleteUser ---
  describe('deleteUser', () => {
    it('should allow an admin to soft-delete a user', (done) => {
      mockPrisma.user.update.mockResolvedValue({ ...mockClient, deleted_at: new Date() });
      userService.deleteUser(adminCall({ id: '2' }), (err, res) => {
        expect(err).toBeNull();
        expect(res.message).toBe('Usuario eliminado correctamente.');
        expect(mockPrisma.user.update).toHaveBeenCalledWith({
          where: { id: 2 },
          data: { deleted_at: expect.any(Date) },
        });
        done();
      });
    });

    it('should deny a client from deleting a user', (done) => {
        userService.deleteUser(clientCall({ id: '1' }), (err, res) => {
          expect(err.code).toBe(grpc.status.PERMISSION_DENIED);
          done();
        });
      });
  });

  // --- Tests for listAllUsers ---
  describe('listAllUsers', () => {
    it('should return a list of users for an admin', (done) => {
      const users = [mockAdmin, mockClient];
      mockPrisma.user.findMany.mockResolvedValue(users);
      mockPrisma.user.count.mockResolvedValue(users.length);

      userService.listAllUsers(adminCall({ page: 1, limit: 10 }), (err, res) => {
        expect(err).toBeNull();
        expect(res.users).toHaveLength(2);
        expect(res.total).toBe(2);
        done();
      });
    });

    it('should apply filters when listing users', (done) => {
        mockPrisma.user.findMany.mockResolvedValue([mockClient]);
        mockPrisma.user.count.mockResolvedValue(1);
  
        userService.listAllUsers(adminCall({ page: 1, limit: 10, role: 'Cliente' }), (err, res) => {
          expect(err).toBeNull();
          expect(mockPrisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { deleted_at: null, role: 'Cliente' }
          }));
          done();
        });
      });
  });
});
