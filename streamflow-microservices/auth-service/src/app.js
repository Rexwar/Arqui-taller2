const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const { getUserByEmailAsync, status } = require('./grpcClient');
require('dotenv').config();

const app = express();
app.use(express.json());

// --- Configuración de PostgreSQL ---
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres-auth',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'auth_db',
  port: process.env.DB_PORT || 5432,
});

// --- Middleware de Autenticación ---
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401); // No autorizado

  try {
    // 1. Verificar si el token está en la lista negra
    const blacklistResult = await pool.query('SELECT * FROM token_blacklist WHERE token = $1', [token]);
    if (blacklistResult.rows.length > 0) {
      return res.status(401).json({ error: 'Token inválido' }); // No autorizado porque está en lista negra
    }

    // 2. Verificar el JWT de forma síncrona
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    
    // 3. Adjuntar el payload decodificado a la solicitud
    req.user = { id: decoded.id, email: decoded.email, role: decoded.role };
    next();

  } catch (error) {
    // Si jwt.verify falla (token inválido, expirado, etc.), lanzará una excepción
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({ error: 'Token no válido o expirado' }); // Prohibido
    }
    // Otros errores (ej. DB)
    console.error('Error en middleware de autenticación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// --- Endpoints ---

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }

  try {
    const user = await getUserByEmailAsync({ email });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });

  } catch (error) {
    if (error.code === status.NOT_FOUND) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    console.error('Error durante el proceso de login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/auth/logout', authenticateToken, async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.decode(token);
    const expiresAt = new Date(decoded.exp * 1000);

    await pool.query('INSERT INTO token_blacklist (token, expires_at) VALUES ($1, $2)', [token, expiresAt]);
    
    res.json({ message: 'Sesión cerrada exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint de salud para Docker
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Endpoint de prueba para verificar la autenticación
app.get('/auth/profile', authenticateToken, (req, res) => {
  res.json({ message: 'Acceso concedido al perfil', user: req.user });
});

const PORT = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servicio de autenticación ejecutándose en puerto ${PORT}`);
  });
}

module.exports = { app, pool };
