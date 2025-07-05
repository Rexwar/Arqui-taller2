const express = require('express');
const { check, validationResult } = require('express-validator');


const createUserRoutes = (userServiceClient, createMetadata, handleGrpcError, authenticate) => {
    const router = express.Router();

    // Create User
    router.post('/', [
        check('nombre').notEmpty().withMessage('El nombre es requerido.'),
        check('apellido').notEmpty().withMessage('El apellido es requerido.'),
        check('email').isEmail().withMessage('El email debe ser válido.'),
        check('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres.'),
        check('confirmacion_password').custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Las contraseñas no coinciden.');
            }
            return true;
        }),
        check('rol').isIn(['Cliente', 'Admin']).withMessage('El rol debe ser Cliente o Admin.')
    ], (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { nombre, apellido, email, password, confirmacion_password, rol } = req.body;
        const metadata = createMetadata(req);
        const request = {
            name: nombre,
            lastname: apellido,
            email,
            password,
            confirmPassword: confirmacion_password,
            role: rol
        };

        userServiceClient.createUser(request, metadata, (error, response) => {
            if (error) return handleGrpcError(res, error);
            const { password, ...user } = response.user || response; // Handle potential nesting
            res.status(201).json(user);
        });
    });

    // Get User by ID (Protected)
    router.get('/:id', authenticate, [
        check('id').isMongoId().withMessage('ID de usuario inválido.')
    ], (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const metadata = createMetadata(req);
        const request = { id: req.params.id };

        userServiceClient.getUserById(request, metadata, (error, response) => {
            if (error) return handleGrpcError(res, error);
            const { password, ...user } = response.user || response;
            res.status(200).json(user);
        });
    });

    // List All Users (Protected)
    router.get('/', authenticate, (req, res) => {
        const { name_lastname, email } = req.query;
        const metadata = createMetadata(req);
        const request = { name_lastname, email };

        userServiceClient.listAllUsers(request, metadata, (error, response) => {
            if (error) return handleGrpcError(res, error);
            // Sanitize password from all users in the list
            const users = response.users.map(u => {
                const { password, ...user } = u;
                return user;
            });
            res.status(200).json({ users });
        });
    });

    // Update User (Protected)
    router.put('/:id', authenticate, [
        check('id').isMongoId().withMessage('ID de usuario inválido.'), // Assuming MongoId format for user IDs
        check('nombre').optional().notEmpty().withMessage('El nombre no puede estar vacío si se proporciona.'),
        check('apellido').optional().notEmpty().withMessage('El apellido no puede estar vacío si se proporciona.'),
        check('email').optional().isEmail().withMessage('El email debe ser válido si se proporciona.'),
        check('password').optional().isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres si se proporciona.')
    ], (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { nombre, apellido, email, password } = req.body;
        const metadata = createMetadata(req);
        const request = {
            id: req.params.id,
            name: nombre,
            lastname: apellido,
            email,
            password
        };

        userServiceClient.updateUser(request, metadata, (error, response) => {
            if (error) return handleGrpcError(res, error);
            const { password, ...user } = response.user || response;
            res.status(200).json(user);
        });
    });

    // Delete User (Protected)
    router.delete('/:id', authenticate, [
        check('id').isMongoId().withMessage('ID de usuario inválido.')
    ], (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const metadata = createMetadata(req);
        const request = { id: req.params.id };

        userServiceClient.deleteUser(request, metadata, (error, response) => {
            if (error) return handleGrpcError(res, error);
            res.status(200).json(response);
        });
    });

    return router;
};

module.exports = createUserRoutes;
