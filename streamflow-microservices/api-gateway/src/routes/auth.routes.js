const express = require('express');
const axios = require('axios');
const { check, validationResult } = require('express-validator');

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';

const createAuthRoutes = (authenticate) => { // Passing authenticate for protected routes
    const router = express.Router();

    // Helper to handle validation errors
    const validate = (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    };

    // Helper to forward requests to auth-service
    const forwardToAuthService = async (req, res, endpoint) => {
        try {
            const response = await axios.post(`${AUTH_SERVICE_URL}${endpoint}`, req.body, {
                headers: {
                    Authorization: req.headers.authorization // Forward token if present
                }
            });
            res.status(response.status).json(response.data);
        } catch (error) {
            console.error(`Error forwarding request to auth-service ${endpoint}:`, error.message);
            if (error.response) {
                res.status(error.response.status).json(error.response.data);
            } else {
                res.status(500).json({ error: 'Error interno del servidor al comunicarse con el servicio de autenticación.' });
            }
        }
    };

    // Login Route
    router.post('/login', [
        check('email').isEmail().withMessage('El email debe ser válido.'),
        check('password').notEmpty().withMessage('La contraseña es requerida.')
    ], validate, async (req, res) => {
        await forwardToAuthService(req, res, '/auth/login');
    });

    // Logout Route (Protected)
    router.post('/logout', authenticate, async (req, res) => {
        await forwardToAuthService(req, res, '/auth/logout');
    });

    // Validate Token Route
    router.post('/validate-token', [
        check('token').notEmpty().withMessage('El token es requerido.')
    ], validate, async (req, res) => {
        await forwardToAuthService(req, res, '/auth/validate-token');
    });

    // Change Password Route (Protected)
    router.post('/change-password', authenticate, [
        check('newPassword').isLength({ min: 6 }).withMessage('La nueva contraseña debe tener al menos 6 caracteres.'),
        check('confirmPassword').custom((value, { req }) => {
            if (value !== req.body.newPassword) {
                throw new Error('Las contraseñas nuevas no coinciden.');
            }
            return true;
        }),
        // Optional validations for admin changing other user's password
        check('userId').optional().isMongoId().withMessage('ID de usuario de destino inválido.'),
        check('email').optional().isEmail().withMessage('Email de destino inválido.')
    ], validate, async (req, res) => {
        // The auth-service handles the logic for admin vs. regular user.
        // We just need to ensure the request body is valid.
        await forwardToAuthService(req, res, '/auth/change-password');
    });

    return router;
};

module.exports = createAuthRoutes;
