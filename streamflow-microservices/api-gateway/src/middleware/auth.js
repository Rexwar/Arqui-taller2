const axios = require('axios');

const authenticate = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ error: 'Acceso no autorizado: Token no proporcionado' });
    }

    try {
        const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
        const response = await axios.post(`${authServiceUrl}/auth/validate-token`, { token });

        if (response.data.valid) {
            req.user = response.data.user;
            req.userId = response.data.user.id;
            req.userRole = response.data.user.role;
            next();
        } else {
            res.status(403).json({ error: 'Acceso prohibido: Token inválido' });
        }
    } catch (error) {
        if (error.response) {
            return res.status(error.response.status).json({
                error: 'Autenticación fallida',
                details: error.response.data.error || 'Token no válido o expirado'
            });
        }
        console.error('Error de conexión con el servicio de autenticación:', error.message);
        return res.status(503).json({ error: 'Servicio de autenticación no disponible' });
    }
};

module.exports = { authenticate };
