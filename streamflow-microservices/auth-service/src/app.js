const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const { getUserByEmailAsync, changePasswordAsync, status } = require('./grpcClient');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

// --- Middleware de Autenticación ---
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401); // No autorizado

  try {
    // 1. Verificar si el token está en la lista negra con Prisma
    const blacklistedToken = await prisma.tokenBlacklist.findUnique({
      where: { token },
    });

    if (blacklistedToken) {
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
    console.log(user);

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
    if (error.code === status.UNAVAILABLE) {
      console.error('Error de conexión gRPC con user-service:', error); // <-- Log de depuración
      return res.status(503).json({ error: 'El servicio de usuarios no está disponible' });
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
    // console.log(expiresAt);
    // Añadir token a la lista negra con Prisma
    await prisma.tokenBlacklist.create({
      data: {
        token,
        expiresAt,
      },
    });
    
    res.json({ message: 'Sesión cerrada exitosamente' });
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint para que la API Gateway valide un token
app.post('/auth/validate-token', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(401).json({ valid: false, error: 'Token no proporcionado' });
  }

  try {
    // 1. Verificar si el token está en la lista negra
    const blacklistedToken = await prisma.tokenBlacklist.findUnique({
      where: { token },
    });

    if (blacklistedToken) {
      return res.status(401).json({ valid: false, error: 'Token inválido' });
    }

    // 2. Verificar el JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');

    // 3. Si es válido, devolver los datos del usuario
    res.status(200).json({
      valid: true,
      user: { id: decoded.id, email: decoded.email, role: decoded.role },
    });

  } catch (error) {
    // Si jwt.verify falla (token inválido, expirado, etc.)
    let errorMessage = 'Token inválido o expirado';
    if (error instanceof jwt.TokenExpiredError) {
        errorMessage = 'Token expirado';
    } else if (error instanceof jwt.JsonWebTokenError) {
        errorMessage = 'Token no válido';
    }
    return res.status(401).json({ valid: false, error: errorMessage });
  }
});

// Endpoint de salud para Docker
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Endpoint de prueba para verificar la autenticación
// Endpoint para cambiar la contraseña
app.post('/auth/change-password', authenticateToken, async (req, res) => {
  const { id: requesterId, role: requesterRole, email: requesterEmail } = req.user;
  const { userId: destinationUserId, email: destinationEmail, oldPassword, newPassword, confirmPassword } = req.body;
  
  
  if (!newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'La nueva contraseña y su confirmación son requeridas.' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Las contraseñas nuevas no coinciden.' });
  }

  try {
    // --- Flujo para Administrador ---
    // Un administrador puede cambiar la contraseña de cualquier usuario sin la contraseña antigua.
    if (requesterRole === 'Administrador' && (destinationUserId || destinationEmail)) {
      console.log(requesterRole);
      let targetUserId = destinationUserId;

      // Si se proporciona el email, buscar al usuario para obtener su ID.
      if (!targetUserId) {
        const targetUser = await getUserByEmailAsync({ destinationEmail });
        if (!targetUser) {
          return res.status(404).json({ error: 'Usuario a modificar no encontrado.' });
        }
        targetUserId = targetUser.id;
      }
      
      // Llamar al servicio de usuario para cambiar la contraseña.
      await changePasswordAsync({ id: targetUserId, password: newPassword });
      return res.json({ message: `Contraseña para el usuario ${targetUserId} actualizada exitosamente.` });
    }

    // --- Flujo para Usuario normal (o administrador cambiando su propia contraseña) ---
    // Se requiere la contraseña antigua.
    if (!oldPassword) {
      return res.status(400).json({ error: 'La contraseña antigua es requerida.' });
    }

    // Obtener los datos del propio usuario para verificar la contraseña.
    const user = await getUserByEmailAsync({ email: requesterEmail });

    // Comparar la contraseña antigua.
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'La contraseña antigua es incorrecta.' });
    }

    // Llamar al servicio de usuario para cambiar la contraseña.
    await changePasswordAsync({ id: requesterId, password: newPassword });
    res.json({ message: 'Contraseña actualizada exitosamente.' });

  } catch (error) {
    if (error.code === status.NOT_FOUND) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    if (error.code === status.UNAVAILABLE) {
      return res.status(503).json({ error: 'El servicio de usuarios no está disponible.' });
    }
    console.error('Error al cambiar la contraseña:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

app.get('/auth/profile', authenticateToken, (req, res) => {
  res.json({ message: 'Acceso concedido al perfil', user: req.user });
});

const PORT = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servicio de autenticación ejecutándose en puerto ${PORT}`);
  });
}

module.exports = { app };
