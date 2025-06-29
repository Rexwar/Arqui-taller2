const request = require('supertest');
const bcrypt = require('bcryptjs');
const { getUserByEmailAsync, status } = require('../src/grpcClient');

// --- Mocking Setup ---
jest.mock('../src/grpcClient', () => ({
  getUserByEmailAsync: jest.fn(),
  status: require('@grpc/grpc-js').status, // Provide the real status codes
}));

// IMPORTANT: app must be required *after* the mocks are set up.
const { app, pool } = require('../src/app');

// --- Test Suite ---
describe('Auth Service API', () => {
  // Close the database connection after all tests are done
  afterAll(() => {
    pool.end();
  });

  describe('POST /auth/login', () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      password: 'hashedpassword',
      role: 'user',
    };

    beforeEach(() => {
      // Reset mocks before each test to ensure isolation
      getUserByEmailAsync.mockClear();
      jest.spyOn(bcrypt, 'compare').mockClear();
    });

    it('should return a JWT token for valid credentials', async () => {
      // Arrange
      getUserByEmailAsync.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      // Act
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toEqual({ id: '1', email: 'test@example.com', role: 'user' });
    });

    it('should return 401 for invalid password', async () => {
      // Arrange
      getUserByEmailAsync.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      // Act
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'wrongpassword' });

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Credenciales inválidas');
    });

    it('should return 404 if user is not found', async () => {
      // Arrange
      const grpcError = {
        code: status.NOT_FOUND,
        details: 'User not found',
      };
      getUserByEmailAsync.mockRejectedValue(grpcError);

      // Act
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'password123' });

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Usuario no encontrado');
    });

    it('should return 400 if email or password are not provided', async () => {
      // Act
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com' }); // Missing password

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email y contraseña son requeridos');
    });

    it('should return 500 for other gRPC errors', async () => {
      // Arrange
      const grpcError = {
        code: status.INTERNAL,
        details: 'Internal server error',
      };
      getUserByEmailAsync.mockRejectedValue(grpcError);

      // Act
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Error interno del servidor');
    });
  });
});
