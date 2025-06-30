const request = require('supertest');
const app = require('../src/app'); // Assuming your express app is exported from src/app.js

describe('User Service Integration Tests', () => {
  let adminId = '1'; // Mock admin ID
  let clienteId = '2'; // Mock client ID
  let createdUserId;

  // --- Test User Creation (POST /usuarios) ---
  test('Admin should be able to create a new Client user', async () => {
    const response = await request(app)
      .post('/usuarios')
      .set('x-user-id', adminId)
      .set('x-user-role', 'Administrador')
      .send({
        nombre: 'Test',
        apellido: 'User',
        email: `testuser_${Date.now()}@example.com`,
        password: 'password123',
        confirmacion_password: 'password123',
        rol: 'Cliente'
      });

    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.email).toContain('@example.com');
    createdUserId = response.body.id; // Save for later tests
  });

  test('Client should NOT be able to create a new user', async () => {
    const response = await request(app)
      .post('/usuarios')
      .set('x-user-id', clienteId)
      .set('x-user-role', 'Cliente')
      .send({
        nombre: 'Another',
        apellido: 'User',
        email: `another_${Date.now()}@example.com`,
        password: 'password123',
        confirmacion_password: 'password123',
        rol: 'Cliente'
      });

    expect(response.statusCode).toBe(403); // Forbidden
  });

  // --- Test Get User (GET /usuarios/:id) ---
  test('Admin should be able to get any user by ID', async () => {
    const response = await request(app)
      .get(`/usuarios/${createdUserId}`)
      .set('x-user-id', adminId)
      .set('x-user-role', 'Administrador');

    expect(response.statusCode).toBe(200);
    expect(response.body.id).toBe(createdUserId);
  });

  test('Client should be able to get their own user data', async () => {
    const response = await request(app)
      .get(`/usuarios/${createdUserId}`)
      .set('x-user-id', createdUserId)
      .set('x-user-role', 'Cliente');

    expect(response.statusCode).toBe(200);
    expect(response.body.id).toBe(createdUserId);
  });

  test('Client should NOT be able to get another user`s data', async () => {
    const response = await request(app)
      .get(`/usuarios/${adminId}`)
      .set('x-user-id', createdUserId) // Authenticated as the new user
      .set('x-user-role', 'Cliente');

    expect(response.statusCode).toBe(403); // Forbidden
  });

  // --- Test List Users (GET /usuarios) ---
  test('Admin should be able to list all users', async () => {
    const response = await request(app)
      .get('/usuarios')
      .set('x-user-id', adminId)
      .set('x-user-role', 'Administrador');

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('users');
    expect(Array.isArray(response.body.users)).toBe(true);
  });

  test('Client should NOT be able to list users', async () => {
    const response = await request(app)
      .get('/usuarios')
      .set('x-user-id', clienteId)
      .set('x-user-role', 'Cliente');

    expect(response.statusCode).toBe(403); // Forbidden
  });

  // --- Test Update User (PUT /usuarios/:id) ---
  test('Admin should be able to update any user', async () => {
    const response = await request(app)
      .put(`/usuarios/${createdUserId}`)
      .set('x-user-id', adminId)
      .set('x-user-role', 'Administrador')
      .send({ nombre: 'Updated Name' });

    expect(response.statusCode).toBe(200);
    expect(response.body.name).toBe('Updated Name');
  });

  // --- Test Delete User (DELETE /usuarios/:id) ---
  test('Client should NOT be able to delete a user', async () => {
    const response = await request(app)
      .delete(`/usuarios/${createdUserId}`)
      .set('x-user-id', clienteId)
      .set('x-user-role', 'Cliente');

    expect(response.statusCode).toBe(403); // Forbidden
  });

  test('Admin should be able to delete any user', async () => {
    const response = await request(app)
      .delete(`/usuarios/${createdUserId}`)
      .set('x-user-id', adminId)
      .set('x-user-role', 'Administrador');

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('User deleted successfully');
  });

  test('Should get 404 when trying to get a deleted user', async () => {
    const response = await request(app)
      .get(`/usuarios/${createdUserId}`)
      .set('x-user-id', adminId)
      .set('x-user-role', 'Administrador');

    expect(response.statusCode).toBe(404);
  });
});
