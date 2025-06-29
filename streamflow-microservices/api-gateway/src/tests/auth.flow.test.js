const axios = require('axios');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { check } = require('grpc-health-check');

// --- Configuración de Conexiones ---
const API_GATEWAY_URL = 'http://localhost:8080';
const USER_SERVICE_URL = 'user-service:50051';

// --- Cliente gRPC para User-Service ---
const packageDefinition = protoLoader.loadSync(__dirname + '/../../proto/users.proto', {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});
const userProto = grpc.loadPackageDefinition(packageDefinition).user;
const userClient = new userProto.UserService(
    USER_SERVICE_URL,
    grpc.credentials.createInsecure(),
    { 'grpc.service_config_disable_resolution': 1 } // Deshabilitar resolución DNS
);

// --- Instancia de Axios para el API Gateway ---
const api = axios.create({
    baseURL: API_GATEWAY_URL,
});

// --- Suite de Pruebas para el Flujo de Autenticación ---
describe('Flujo de Autenticación E2E', () => {
    let testUser;
    let authToken;

    // Función de ayuda para esperar a que el gateway esté listo
    const waitForGateway = async () => {
        const maxRetries = 10;
        const retryDelay = 1000; // 1 segundo
        for (let i = 0; i < maxRetries; i++) {
            try {
                await api.get('/health');
                console.log('API Gateway está listo.');
                return;
            } catch (error) {
                console.log(`Intento ${i + 1}: API Gateway no está listo, reintentando en ${retryDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
        throw new Error('API Gateway no estuvo listo a tiempo.');
    };

    // 1. Esperar a los servicios y crear un usuario único antes de todas las pruebas
    const waitForUserService = async () => {
        try {
            const status = await check(USER_SERVICE_URL, 'user.UserService');
            if (status === 'SERVING') {
                console.log('User-service está listo.');
                return;
            }
            throw new Error('User-service no está listo.');
        } catch (error) {
            console.log('Error en health check de gRPC:', error.message);
            throw error;
        }
    };

    beforeAll(async () => {
        await waitForGateway();
        await waitForUserService();

        // Jest esperará a que esta promesa se resuelva
        return new Promise((resolve, reject) => {
            const userData = {
                username: `testuser_${Date.now()}`,
                email: `test_${Date.now()}@example.com`,
                password: 'password123',
                confirmPassword: 'password123',
            };

            userClient.createUser(userData, (err, response) => {
                if (err) {
                    console.error('Error detallado al crear usuario:', err);
                    return reject(err);
                }
                testUser = { ...userData, id: response.id };
                console.log('Usuario de prueba creado:', testUser.email);
                resolve();
            });
        });
    }, 30000); // Aumentar el timeout para beforeAll

    // 2. Probar el flujo completo
    it('Debe permitir a un usuario iniciar sesión, acceder a una ruta protegida, cerrar sesión y luego denegar el acceso', async () => {
        // Paso 1: Iniciar sesión
        const loginResponse = await api.post('/auth/login', {
            email: testUser.email,
            password: testUser.password,
        });

        expect(loginResponse.status).toBe(200);
        expect(loginResponse.data.token).toBeDefined();
        authToken = loginResponse.data.token;
        console.log('Login exitoso.');

        // Paso 2: Acceder a una ruta protegida con el token
        const profileResponse = await api.get('/auth/profile', {
            headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(profileResponse.status).toBe(200);
        expect(profileResponse.data.user.email).toBe(testUser.email);
        console.log('Acceso a ruta protegida exitoso.');

        // Paso 3: Cerrar sesión
        const logoutResponse = await api.post('/auth/logout', null, {
            headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(logoutResponse.status).toBe(200);
        expect(logoutResponse.data.message).toBe('Sesión cerrada exitosamente');
        console.log('Logout exitoso.');

        // Paso 4: Intentar acceder de nuevo con el token invalidado
        try {
            // Esperamos que esta llamada falle
            await api.get('/auth/profile', {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            // Si llegamos aquí, la prueba falla porque el acceso no fue denegado
            fail('El acceso con un token invalidado debería haber fallado.');
        } catch (error) {
            console.log('Error capturado en el último paso (esperado).');
            expect(error.response).toBeDefined();
            expect(error.response.status).toBe(401);
            expect(error.response.data.error).toContain('Token inválido');
            console.log('Acceso denegado con token invalidado, como se esperaba.');
        }
    });
});
