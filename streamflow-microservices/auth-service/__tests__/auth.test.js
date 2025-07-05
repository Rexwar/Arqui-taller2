const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { mockDeep, mockReset } = require('jest-mock-extended');

// --- Mocking Setup ---

// Mock the Prisma client
const mockPrisma = mockDeep();
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

// Mock the gRPC client
const { getUserByEmailAsync, status } = require('../src/grpcClient');
jest.mock('../src/grpcClient', () => ({
  getUserByEmailAsync: jest.fn(),
  status: require('@grpc/grpc-js').status,
}));

// IMPORTANT: app must be required *after* the mocks are set up.
const { app } = require('../src/app');

// --- Test Suite ---
describe('Auth Service API', () => {
  const mockUser = {
    id: '1',
    email: 'test@example.com',
    password: 'hashedpassword',
    role: 'Cliente',
  };

  const generateToken = (user, options = {}) => jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '1h', ...options }
  );

  beforeEach(() => {
    mockReset(mockPrisma); // Reset Prisma mock
    getUserByEmailAsync.mockClear(); // Reset gRPC mock
    jest.spyOn(bcrypt, 'compare').mockClear(); // Reset bcrypt spy
  });

  describe('POST /auth/login', () => {
    it('should return a JWT for valid credentials', async () => {
      getUserByEmailAsync.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const response = await request(app)
        .post('/auth/login')
        .send({ email: mockUser.email, password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toEqual({ id: mockUser.id, email: mockUser.email, role: mockUser.role });
    });

    it('should return 401 for invalid password', async () => {
      getUserByEmailAsync.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      const response = await request(app)
        .post('/auth/login')
        .send({ email: mockUser.email, password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Credenciales inválidas');
    });

    it('should return 404 if user is not found via gRPC', async () => {
      getUserByEmailAsync.mockRejectedValue({ code: status.NOT_FOUND });

      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'notfound@example.com', password: 'password' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Usuario no encontrado');
    });

    it('should return 503 if user-service is unavailable', async () => {
      getUserByEmailAsync.mockRejectedValue({ code: status.UNAVAILABLE });

      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password' });

      expect(response.status).toBe(503);
      expect(response.body.error).toBe('El servicio de usuarios no está disponible');
    });
  });

  describe('POST /auth/logout', () => {
    it('should add the token to the blacklist and return 200', async () => {
      const token = generateToken(mockUser);
      mockPrisma.tokenBlacklist.findUnique.mockResolvedValue(null); // Token is not yet blacklisted
      mockPrisma.tokenBlacklist.create.mockResolvedValue({}); // Mock successful creation

      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Sesión cerrada exitosamente');
      expect(mockPrisma.tokenBlacklist.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.tokenBlacklist.create).toHaveBeenCalledWith({
        data: {
          token: token,
          expiresAt: expect.any(Date),
        },
      });
    });

    it('should return 401 if no token is provided', async () => {
      const response = await request(app).post('/auth/logout');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /auth/profile (Protected Route)', () => {
    it('should grant access with a valid token', async () => {
      const token = generateToken(mockUser);
      mockPrisma.tokenBlacklist.findUnique.mockResolvedValue(null); // Token is not blacklisted

      const response = await request(app)
        .get('/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Acceso concedido al perfil');
      expect(response.body.user).toEqual({ id: mockUser.id, email: mockUser.email, role: mockUser.role });
    });

    it('should deny access if token is in the blacklist', async () => {
      const token = generateToken(mockUser);
      mockPrisma.tokenBlacklist.findUnique.mockResolvedValue({ id: 1, token, expiresAt: new Date() }); // Token IS blacklisted

      const response = await request(app)
        .get('/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token inválido');
    });

    it('should deny access with an invalid signature token', async () => {
      const invalidToken = jwt.sign({ id: '1' }, 'wrong-secret', { expiresIn: '1h' });
      
      const response = await request(app)
        .get('/auth/profile')
        .set('Authorization', `Bearer ${invalidToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Token no válido o expirado');
    });

    it('should deny access with an expired token', async () => {
      const expiredToken = generateToken(mockUser, { expiresIn: '-1s' }); // Expired!
      
      const response = await request(app)
        .get('/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Token no válido o expirado');
    });

    it('should deny access without a token', async () => {
      const response = await request(app).get('/auth/profile');

      expect(response.status).toBe(401);
    });
  });
});
