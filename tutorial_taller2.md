# Tutorial Completo - Taller 2 Microservicios StreamFlow

## 📋 Requisitos Previos

### Herramientas Necesarias
- **Docker** y **Docker Compose**
- **Node.js** (v16+) o **Python** (3.8+) o **Java** (11+)
- **Git**
- **Postman**
- **DBDiagram** (para modelos ER)
- **Editor de código** (VS Code recomendado)

### Conocimientos Base
- Fundamentos de microservicios
- Bases de datos (PostgreSQL, MongoDB, MariaDB)
- APIs REST y gRPC
- RabbitMQ
- JWT para autenticación

## 🎯 Fase 1: Planificación y Configuración Inicial

### Paso 1.1: Definir Roles del Equipo
1. **Decidir quién será Desarrollador A y B**
2. **Asignar responsabilidades:**
   - **Desarrollador A**: Autenticación, Usuarios, Listas de Reproducción, Envío de Correos
   - **Desarrollador B**: Videos, Facturación, Monitoreo, Interacciones Sociales
   - **Ambos**: API Gateway

### Paso 1.2: Crear Estructura del Proyecto
```bash
mkdir streamflow-microservices
cd streamflow-microservices

# Crear directorios para cada microservicio
mkdir auth-service
mkdir user-service
mkdir billing-service
mkdir video-service
mkdir monitoring-service
mkdir playlist-service
mkdir social-service
mkdir email-service
mkdir api-gateway
mkdir nginx
mkdir docs
```

### Paso 1.3: Configurar Git y README
```bash
git init
touch README.md
touch .gitignore
touch docker-compose.yml
```

**Contenido inicial del README.md:**
```markdown
# StreamFlow - Sistema de Microservicios

## Integrantes
- [Nombre Desarrollador A] - [RUT] - Desarrollador A
- [Nombre Desarrollador B] - [RUT] - Desarrollador B

## Arquitectura
Sistema de streaming con 8 microservicios + API Gateway

## Instalación
[Se completará durante el desarrollo]

## Credenciales de Administrador
Usuario: admin@streamflow.com
Contraseña: admin123
```

## 🏗️ Fase 2: Configuración de Infraestructura

### Paso 2.1: Configurar Docker Compose Base
**docker-compose.yml:**
```yaml
version: '3.8'

services:
  # Bases de datos
  postgres-auth:
    image: postgres:15
    environment:
      POSTGRES_DB: auth_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_auth_data:/var/lib/postgresql/data

  postgres-playlist:
    image: postgres:15
    environment:
      POSTGRES_DB: playlist_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5433:5432"
    volumes:
      - postgres_playlist_data:/var/lib/postgresql/data

  mariadb-billing:
    image: mariadb:10
    environment:
      MYSQL_ROOT_PASSWORD: password
      MYSQL_DATABASE: billing_db
    ports:
      - "3306:3306"
    volumes:
      - mariadb_data:/var/lib/mysql

  mongodb-video:
    image: mongo:6
    ports:
      - "27017:27017"
    volumes:
      - mongodb_video_data:/data/db

  mongodb-monitoring:
    image: mongo:6
    ports:
      - "27018:27017"
    volumes:
      - mongodb_monitoring_data:/data/db

  mongodb-social:
    image: mongo:6
    ports:
      - "27019:27017"
    volumes:
      - mongodb_social_data:/data/db

  # Para el microservicio de usuarios (elige MySQL)
  mysql-users:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: password
      MYSQL_DATABASE: users_db
    ports:
      - "3307:3306"
    volumes:
      - mysql_users_data:/var/lib/mysql

  # RabbitMQ
  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: password

volumes:
  postgres_auth_data:
  postgres_playlist_data:
  mariadb_data:
  mongodb_video_data:
  mongodb_monitoring_data:
  mongodb_social_data:
  mysql_users_data:
```

### Paso 2.2: Levantar Infraestructura Base
```bash
docker-compose up -d
```

## 🔧 Fase 3: Desarrollo de Microservicios (Node.js/Express)

### Paso 3.1: Configuración Base para Cada Microservicio

**Estructura común para cada microservicio:**
```
service-name/
├── src/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── config/
│   └── app.js
├── proto/
├── package.json
├── Dockerfile
└── .env
```

**package.json base:**
```json
{
  "name": "service-name",
  "version": "1.0.0",
  "scripts": {
    "start": "node src/app.js",
    "dev": "nodemon src/app.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "@grpc/grpc-js": "^1.8.0",
    "@grpc/proto-loader": "^0.7.0",
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3",
    "amqplib": "^0.10.0",
    "mongoose": "^7.0.0",
    "mysql2": "^3.2.0",
    "pg": "^8.10.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "nodemon": "^2.0.0"
  }
}
```

### Paso 3.2: Microservicio de Autenticación (Desarrollador A)

**auth-service/src/app.js:**
```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(express.json());

// Configuración de PostgreSQL
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'auth_db',
  user: 'postgres',
  password: 'password'
});

// Blacklist de tokens
const tokenBlacklist = new Set();

// Middleware de autenticación
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  if (tokenBlacklist.has(token)) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

// Endpoints
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Verificar usuario en base de datos de usuarios (simulado)
    // En implementación real, consultar microservicio de usuarios
    
    const token = jwt.sign(
      { id: 1, email, role: 'Cliente' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );
    
    res.json({
      token,
      user: { id: 1, email, role: 'Cliente' }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.patch('/auth/usuarios/:id', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.params.id;
    
    // Validaciones
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Las contraseñas no coinciden' });
    }
    
    // Verificar permisos
    if (req.user.role !== 'Administrador' && req.user.id !== parseInt(userId)) {
      return res.status(403).json({ error: 'No tiene permisos para esta acción' });
    }
    
    // Actualizar contraseña (implementar lógica real)
    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/auth/logout', authenticate, (req, res) => {
  const token = req.headers.authorization.split(' ')[1];
  tokenBlacklist.add(token);
  res.json({ message: 'Sesión cerrada exitosamente' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servicio de autenticación ejecutándose en puerto ${PORT}`);
});
```

### Paso 3.3: Microservicio de Usuarios (Desarrollador A)

**user-service/src/app.js:**
```javascript
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// Cargar definición gRPC
const packageDefinition = protoLoader.loadSync('proto/users.proto');
const userProto = grpc.loadPackageDefinition(packageDefinition);

// Configuración MySQL
const dbConfig = {
  host: 'localhost',
  port: 3307,
  user: 'root',
  password: 'password',
  database: 'users_db'
};

// Implementación de servicios gRPC
const userService = {
  createUser: async (call, callback) => {
    try {
      const { name, lastname, email, password, confirmPassword, role } = call.request;
      
      // Validaciones
      if (password !== confirmPassword) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          details: 'Las contraseñas no coinciden'
        });
      }
      
      const connection = await mysql.createConnection(dbConfig);
      
      // Verificar email único
      const [existing] = await connection.execute(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );
      
      if (existing.length > 0) {
        return callback({
          code: grpc.status.ALREADY_EXISTS,
          details: 'El email ya está registrado'
        });
      }
      
      // Hash de contraseña
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Insertar usuario
      const [result] = await connection.execute(
        'INSERT INTO users (name, lastname, email, password, role, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [name, lastname, email, hashedPassword, role || 'Cliente']
      );
      
      await connection.end();
      
      callback(null, {
        id: result.insertId,
        name,
        lastname,
        email,
        role: role || 'Cliente',
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      callback({
        code: grpc.status.INTERNAL,
        details: 'Error interno del servidor'
      });
    }
  },
  
  getUserById: async (call, callback) => {
    try {
      const { id } = call.request;
      const connection = await mysql.createConnection(dbConfig);
      
      const [rows] = await connection.execute(
        'SELECT id, name, lastname, email, role, created_at FROM users WHERE id = ? AND deleted_at IS NULL',
        [id]
      );
      
      await connection.end();
      
      if (rows.length === 0) {
        return callback({
          code: grpc.status.NOT_FOUND,
          details: 'Usuario no encontrado'
        });
      }
      
      const user = rows[0];
      callback(null, {
        id: user.id,
        name: user.name,
        lastname: user.lastname,
        email: user.email,
        role: user.role,
        createdAt: user.created_at.toISOString()
      });
    } catch (error) {
      callback({
        code: grpc.status.INTERNAL,
        details: 'Error interno del servidor'
      });
    }
  }
  
  // Implementar resto de métodos: updateUser, deleteUser, listUsers
};

// Crear servidor gRPC
const server = new grpc.Server();
server.addService(userProto.UserService.service, userService);

const PORT = process.env.PORT || 50051;
server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), () => {
  console.log(`Servicio de usuarios ejecutándose en puerto ${PORT}`);
  server.start();
});
```

### Paso 3.4: API Gateway

**api-gateway/src/app.js:**
```javascript
const express = require('express');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();
app.use(express.json());

// Cargar definiciones gRPC
const userPackageDefinition = protoLoader.loadSync('../user-service/proto/users.proto');
const userProto = grpc.loadPackageDefinition(userPackageDefinition);

// Clientes gRPC
const userClient = new userProto.UserService('localhost:50051', grpc.credentials.createInsecure());

// Middleware de autenticación
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

// Rutas de usuarios
app.post('/usuarios', (req, res) => {
  userClient.createUser(req.body, (error, response) => {
    if (error) {
      return res.status(400).json({ error: error.details });
    }
    res.status(201).json(response);
  });
});

app.get('/usuarios/:id', authenticate, (req, res) => {
  userClient.getUserById({ id: req.params.id }, (error, response) => {
    if (error) {
      return res.status(404).json({ error: error.details });
    }
    res.json(response);
  });
});

// Rutas de autenticación (proxy a microservicio de auth)
app.post('/auth/login', async (req, res) => {
  try {
    const response = await axios.post('http://localhost:3001/auth/login', req.body);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Error interno' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API Gateway ejecutándose en puerto ${PORT}`);
});
```

## 📊 Fase 4: Bases de Datos y Modelos

### Paso 4.1: Crear Esquemas de Base de Datos

**Usuarios (MySQL):**
```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  lastname VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('Cliente', 'Administrador') DEFAULT 'Cliente',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);
```

**Autenticación (PostgreSQL):**
```sql
CREATE TABLE token_blacklist (
  id SERIAL PRIMARY KEY,
  token TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Paso 4.2: Modelos ER en DBDiagram

1. Ir a [dbdiagram.io](https://dbdiagram.io)
2. Crear diagramas para cada base de datos
3. Exportar como imagen para el informe

## 🔧 Fase 5: Configuración de RabbitMQ y Comunicación

### Paso 5.1: Configurar Cola de Mensajería

**config/rabbitmq.js:**
```javascript
const amqp = require('amqplib');

class RabbitMQ {
  constructor() {
    this.connection = null;
    this.channel = null;
  }

  async connect() {
    try {
      this.connection = await amqp.connect('amqp://admin:password@localhost:5672');
      this.channel = await this.connection.createChannel();
      console.log('Conectado a RabbitMQ');
    } catch (error) {
      console.error('Error conectando a RabbitMQ:', error);
    }
  }

  async publishMessage(queue, message) {
    await this.channel.assertQueue(queue, { durable: true });
    this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)));
  }

  async consumeMessage(queue, callback) {
    await this.channel.assertQueue(queue, { durable: true });
    this.channel.consume(queue, (msg) => {
      if (msg) {
        const content = JSON.parse(msg.content.toString());
        callback(content);
        this.channel.ack(msg);
      }
    });
  }
}

module.exports = new RabbitMQ();
```

## 🐳 Fase 6: Dockerización

### Paso 6.1: Dockerfile Base para Servicios Node.js

**Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

### Paso 6.2: Actualizar docker-compose.yml

Agregar servicios de microservicios al docker-compose.yml:

```yaml
  # Microservicios
  auth-service:
    build: ./auth-service
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres-auth:5432/auth_db
    depends_on:
      - postgres-auth
      - rabbitmq

  user-service:
    build: ./user-service
    ports:
      - "50051:50051"
    environment:
      - DATABASE_URL=mysql://root:password@mysql-users:3306/users_db
    depends_on:
      - mysql-users
      - rabbitmq

  api-gateway:
    build: ./api-gateway
    ports:
      - "3000:3000"
    depends_on:
      - auth-service
      - user-service
```

## 🔒 Fase 7: Configuración de Nginx

### Paso 7.1: Configuración de Nginx

**nginx/nginx.conf:**
```nginx
events {
    worker_connections 1024;
}

http {
    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$request_body"';

    access_log /var/log/nginx/access.log main;

    # Upstream para balanceador de carga
    upstream api_gateway {
        server api-gateway-1:3000;
        server api-gateway-2:3000;
        server api-gateway-3:3000;
    }

    # Redirección HTTP a HTTPS
    server {
        listen 80;
        server_name localhost;
        return 301 https://$server_name$request_uri;
    }

    # Servidor HTTPS
    server {
        listen 443 ssl;
        server_name localhost;

        ssl_certificate /etc/nginx/ssl/nginx.crt;
        ssl_certificate_key /etc/nginx/ssl/nginx.key;

        # Endpoint de comedia
        location /comedia {
            return 200 "¿Por qué los programadores prefieren el modo oscuro? Porque la luz atrae bugs! 🐛😄";
            add_header Content-Type text/plain;
        }

        # Proxy a API Gateway
        location / {
            proxy_pass http://api_gateway;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
```

### Paso 7.2: Generar Certificados SSL

```bash
mkdir nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/ssl/nginx.key \
    -out nginx/ssl/nginx.crt \
    -subj "/C=CL/ST=Antofagasta/L=Antofagasta/O=UCN/CN=localhost"
```

## 📝 Fase 8: Testing con Postman

### Paso 8.1: Crear Colecciones Base

**Flujo 1 (Desarrollador A):**
1. GET /videos (listar videos)
2. POST /usuarios (registrar cliente)
3. POST /auth/login (iniciar sesión)
4. GET /videos/{id} (obtener video específico)
5. POST /interacciones/{id}/likes (dar like)

**Variables de entorno en Postman:**
- `base_url`: https://localhost
- `token`: {{auth_token}}
- `user_id`: {{user_id}}
- `video_id`: {{video_id}}

### Paso 8.2: Scripts de Pre/Post Request

**Pre-request Script para login:**
```javascript
// Limpiar token anterior
pm.environment.unset("auth_token");
```

**Post-request Script para login:**
```javascript
// Guardar token de respuesta
if (pm.response.code === 200) {
    const response = pm.response.json();
    pm.environment.set("auth_token", response.token);
    pm.environment.set("user_id", response.user.id);
}
```

## 🌱 Fase 9: Seeder de Datos

### Paso 9.1: Script de Seeder

**seeder/seed.js:**
```javascript
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

async function runSeeder() {
  console.log('Iniciando seeder...');
  
  // Configuraciones de bases de datos
  const mysqlConfig = {
    host: 'localhost',
    port: 3307,
    user: 'root',
    password: 'password',
    database: 'users_db'
  };

  try {
    // Usuarios
    console.log('Creando usuarios...');
    const connection = await mysql.createConnection(mysqlConfig);
    
    // Usuario administrador
    const adminPassword = await bcrypt.hash('admin123', 10);
    await connection.execute(
      'INSERT INTO users (name, lastname, email, password, role) VALUES (?, ?, ?, ?, ?)',
      ['Admin', 'Sistema', 'admin@streamflow.com', adminPassword, 'Administrador']
    );
    
    // Usuarios clientes (100-200)
    for (let i = 1; i <= 150; i++) {
      const password = await bcrypt.hash('password123', 10);
      await connection.execute(
        'INSERT INTO users (name, lastname, email, password, role) VALUES (?, ?, ?, ?, ?)',
        [`Usuario${i}`, `Apellido${i}`, `user${i}@example.com`, password, 'Cliente']
      );
    }
    
    await connection.end();
    console.log('Usuarios creados exitosamente');
    
    // Videos (MongoDB)
    console.log('Creando videos...');
    const mongoClient = new MongoClient('mongodb://localhost:27017');
    await mongoClient.connect();
    const videosDb = mongoClient.db('video_db');
    
    const videos = [];
    const genres = ['Acción', 'Comedia', 'Drama', 'Thriller', 'Ciencia Ficción'];
    
    for (let i = 1; i <= 500; i++) {
      videos.push({
        title: `Video ${i}`,
        description: `Descripción del video ${i}`,
        genre: genres[Math.floor(Math.random() * genres.length)],
        likes: Math.floor(Math.random() * 100),
        createdAt: new Date(),
        deletedAt: null
      });
    }
    
    await videosDb.collection('videos').insertMany(videos);
    console.log('Videos creados exitosamente');
    
    // Continuar con facturas, likes, comentarios...
    
    await mongoClient.close();
    console.log('Seeder completado exitosamente');
    
  } catch (error) {
    console.error('Error en seeder:', error);
  }
}

runSeeder();
```

## 📄 Fase 10: Documentación e Informe

### Paso 10.1: Completar README.md

```markdown
# StreamFlow - Sistema de Microservicios

## Instalación

### Prerrequisitos
- Docker y Docker Compose
- Node.js 18+

### Pasos de instalación
1. Clonar repositorio
2. Ejecutar `docker-compose up -d`
3. Esperar que todos los servicios estén listos
4. Ejecutar seeder: `npm run seed`

### Credenciales de Administrador
- Email: admin@streamflow.com
- Contraseña: admin123

## Arquitectura
- 8 Microservicios independientes
- API Gateway como punto único de entrada
- RabbitMQ para comunicación asíncrona
- Nginx como balanceador de carga

## Endpoints
[Documentar todos los endpoints]
```

### Paso 10.2: Estructura del Informe

1. **Portada**: Logo UCN, fecha, integrantes
2. **Índice**
3. **Modelos ER**: Diagramas de cada BD
4. **Diagrama C4**: Arquitectura completa
5. **Análisis de Arquitectura**:
   - ¿Por qué microservicios?
   - Beneficios y desventajas
   - Alternativas consideradas
6. **Migración**:
   - Patrón Strangler Fig
   - Orden de migración recomendado
7. **API Gateway**: Beneficios
8. **gRPC**: Ventajas sobre REST
9. **Mejoras futuras** (opcional)

## ✅ Fase 11: Testing y Entrega

### Paso 11.1: Lista de Verificación Final

- [ ] Todos los microservicios funcionan independientemente
- [ ] API Gateway rutea correctamente
- [ ] Autenticación JWT funciona
- [ ] Bases de datos conectadas y pobladas
- [ ] RabbitMQ configurado
- [ ] Nginx balanceando carga
- [ ] Certificados SSL funcionando
- [ ] Colecciones Postman completas
- [ ] Seeder ejecutable
- [ ] README.md completo
- [ ] Informe terminado
- [ ] Repositorio público

### Paso 11.2: Comandos de Prueba

```bash
# Levantar todo el sistema
docker-compose up -d

# Verificar servicios
docker-compose ps

# Ejecutar seeder
npm run seed

# Probar endpoint de comedia
curl -k https://localhost/comedia

# Probar autenticación
curl -X POST https://localhost/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@streamflow.com","password":"admin123"}' \
  -k
```

## 🚀 Consejos Adicionales

### Gestión de Tiempo
- **Semana 1**: Configuración base e infraestructura
- **Semana 2**: Desarrollo de microservicios del desarrollador A
- **Semana 3**: Desarrollo de microservicios del desarrollador B
- **Semana 4**: API Gateway, integración y testing
- **Semana 5**: Nginx, seeder e informe

### Buenas Prácticas
- Commits frecuentes con mensajes descriptivos
- Documentar decisiones técnicas
- Probar cada microservicio independientemente
- Usar variables de entorno para configuración
- Implementar logging adecuado

### Errores Comunes a Evitar
- No usar PostgreSQL para usuarios
- Olvidar soft delete
- No implementar blacklist de tokens
- Comunicación directa entre microservicios
- No validar permisos correctamente

## 📞 Recursos de Ayuda

- [Documentación gRPC](https://grpc.io/docs/)
- [Guía RabbitMQ](https://www.rabbitmq.com/tutorials/)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [Nginx Configuration](https://nginx.org/en/docs/)
- [JWT.io](https://jwt.io/) para debuggear tokens

¡Éxito en el desarrollo del taller! 🎯