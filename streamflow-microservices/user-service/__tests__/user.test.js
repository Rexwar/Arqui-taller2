const grpc = require('@grpc/grpc-js');
const bcrypt = require('bcryptjs');
const db = require('../src/db');
const { userService, server } = require('../src/app');

// --- Mocking Setup ---
jest.mock('../src/db', () => ({
  query: jest.fn(),
  close: jest.fn(),
}));
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const mockDate = new Date('2023-01-01T00:00:00.000Z');
const mockUser = {
  id: 1,
  name: 'Test',
  lastname: 'User',
  email: 'test@example.com',
  password: 'hashedpassword',
  role: 'Cliente',
  created_at: mockDate,
  updated_at: mockDate,
};

// --- Test Suite ---
describe('User Service', () => {
  afterAll((done) => {
    if (server) {
      server.tryShutdown(done);
    }
  });

  beforeEach(() => {
    db.query.mockClear();
    bcrypt.hash.mockClear();
    bcrypt.compare.mockClear();
  });

  // --- Tests for createUser ---
  describe('createUser', () => {
    it('should create a new user successfully', (done) => {
      const call = { request: { ...mockUser, password: 'password123', confirmPassword: 'password123' } };
      db.query
        .mockResolvedValueOnce([[]]) // No existing user
        .mockResolvedValueOnce([{ insertId: 1 }]) // Successful insertion
        .mockResolvedValueOnce([[mockUser]]); // Fetch created user
      bcrypt.hash.mockResolvedValue('hashedpassword');

      const callback = (error, response) => {
        expect(error).toBeNull();
        expect(db.query).toHaveBeenCalledWith('SELECT id FROM users WHERE email = ? AND deleted_at IS NULL', [mockUser.email]);
        expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
        expect(response).toEqual({
          ...response,
          id: '1',
          created_at: mockDate.toISOString(),
          updated_at: mockDate.toISOString(),
        });
        done();
      };
      userService.createUser(call, callback);
    });
  });

  // --- Tests for updateUser ---
  describe('updateUser', () => {
    it('should update a user successfully', (done) => {
      const updatedUser = { ...mockUser, name: 'Updated' };
      const call = { request: { id: '1', name: 'Updated', lastname: 'User', email: 'test@example.com' } };
      db.query
        .mockResolvedValueOnce([[]]) // No other user with same email
        .mockResolvedValueOnce([]) // Successful update
        .mockResolvedValueOnce([[updatedUser]]); // Fetch updated user

      const callback = (error, response) => {
        expect(error).toBeNull();
        expect(response.name).toBe('Updated');
        done();
      };
      userService.updateUser(call, callback);
    });
  });

  // --- Tests for deleteUser ---
  describe('deleteUser', () => {
    it('should soft delete a user successfully', (done) => {
      const call = { request: { id: '1' } };
      db.query.mockResolvedValueOnce([]); // Successful update

      const callback = (error, response) => {
        expect(error).toBeNull();
        expect(response).toEqual({});
        expect(db.query).toHaveBeenCalledWith('UPDATE users SET deleted_at = NOW() WHERE id = ?', ['1']);
        done();
      };
      userService.deleteUser(call, callback);
    });
  });

  // --- Tests for getUserById ---
  describe('getUserById', () => {
    it('should return a user for a valid ID', (done) => {
      const call = { request: { id: '1' } };
      db.query.mockResolvedValueOnce([[mockUser]]);

      const callback = (error, response) => {
        expect(error).toBeNull();
        expect(response.id).toBe('1');
        done();
      };
      userService.getUserById(call, callback);
    });

    it('should return NOT_FOUND for a non-existent ID', (done) => {
      const call = { request: { id: '999' } };
      db.query.mockResolvedValueOnce([[]]);

      const callback = (error, response) => {
        expect(response).toBeUndefined();
        expect(error.code).toBe(grpc.status.NOT_FOUND);
        done();
      };
      userService.getUserById(call, callback);
    });
  });

  // --- Tests for getUserByEmail ---
  describe('getUserByEmail', () => {
    it('should return user auth data for a valid email', (done) => {
      const call = { request: { email: mockUser.email } };
      db.query.mockResolvedValueOnce([[mockUser]]);

      const callback = (error, response) => {
        expect(error).toBeNull();
        expect(response.password).toBe('hashedpassword');
        done();
      };
      userService.getUserByEmail(call, callback);
    });
  });

  // --- Tests for listAllUsers ---
  describe('listAllUsers', () => {
    it('should return a list of all users', (done) => {
      const call = { request: {} };
      db.query.mockResolvedValueOnce([[mockUser, { ...mockUser, id: 2, email: 'test2@example.com' }]]);

      const callback = (error, response) => {
        expect(error).toBeNull();
        expect(response.users).toHaveLength(2);
        expect(response.users[0].id).toBe('1');
        done();
      };
      userService.listAllUsers(call, callback);
    });

    it('should return a filtered list of users when searching', (done) => {
      const call = { request: { search: 'Test' } };
      db.query.mockResolvedValueOnce([[mockUser]]);

      const callback = (error, response) => {
        expect(error).toBeNull();
        expect(response.users).toHaveLength(1);
        expect(db.query).toHaveBeenCalledWith(expect.stringContaining('LIKE'), ['%Test%', '%Test%', '%Test%']);
        done();
      };
      userService.listAllUsers(call, callback);
    });
  });
});
