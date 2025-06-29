# Guía de Pruebas para StreamFlow Microservices

Este documento proporciona instrucciones paso a paso para probar cada microservicio de forma individual y el sistema completo a través del API Gateway.

## Prerrequisitos

- Docker y Docker Compose instalados.
- Un cliente de terminal como `curl` o una herramienta como Postman.
- Un cliente gRPC como `grpcurl` para probar el `user-service` (opcional).

## 1. Iniciar el Sistema Completo

Antes de realizar cualquier prueba, asegúrate de que todos los servicios estén en ejecución. Desde la raíz del proyecto, ejecuta:

```bash
docker-compose up -d --build
```

## 2. Pruebas Individuales de Microservicios

A continuación se muestran los comandos para probar cada servicio directamente, accediendo a sus puertos expuestos.

### a. Auth Service (Puerto 3000)

**Login (simulado):**
```bash
curl -X POST -H "Content-Type: application/json" -d '{"username": "admin", "password": "password"}' http://localhost:3000/login
```

### b. Playlist Service (Puerto 3001)

**Crear una playlist:**
```bash
curl -X POST -H "Content-Type: application/json" -d '{"userId": 1, "name": "Mi Playlist Favorita"}' http://localhost:3001/playlists
```

**Obtener playlists de un usuario:**
```bash
curl http://localhost:3001/playlists/user/1
```

### c. Video Service (Puerto 3003)

**Crear un video:**
```bash
curl -X POST -H "Content-Type: application/json" -d '{"title": "Mi Primer Video", "description": "Una descripción", "url": "http://example.com/video.mp4"}' http://localhost:3003/videos
```

**Listar todos los videos:**
```bash
curl http://localhost:3003/videos
```

### d. Billing Service (Puerto 3004)

**Crear una factura:**
```bash
curl -X POST -H "Content-Type: application/json" -d '{"userId": 1, "amount": 9.99, "dueDate": "2025-12-31"}' http://localhost:3004/invoices
```

**Obtener facturas de un usuario:**
```bash
curl http://localhost:3004/invoices/user/1
```

### e. Monitoring Service (Puerto 3005)

**Registrar un log:**
```bash
curl -X POST -H "Content-Type: application/json" -d '{"service": "test-service", "level": "info", "message": "Prueba de log"}' http://localhost:3005/logs
```

**Obtener los últimos logs:**
```bash
curl http://localhost:3005/logs
```

### f. Social Service (Puerto 3006)

**Dar 'like' a un video (reemplaza `VIDEO_ID` con un ID real de la base de datos):**
```bash
curl -X POST -H "Content-Type: application/json" -d '{"userId": "user123"}' http://localhost:3006/videos/VIDEO_ID/like
```

**Añadir un comentario (reemplaza `VIDEO_ID`):**
```bash
curl -X POST -H "Content-Type: application/json" -d '{"userId": "user123", "text": "¡Gran video!"}' http://localhost:3006/videos/VIDEO_ID/comments
```

### g. User Service (gRPC en Puerto 50051)

Este servicio usa gRPC y no puede ser probado directamente con `curl`. Se necesita un cliente gRPC. Si tienes `grpcurl`, puedes usarlo así:

**Crear un usuario:**

El siguiente comando crea un nuevo usuario. Asegúrate de que `grpcurl` esté instalado en tu sistema.

```bash
grpcurl -plaintext -d '{"name": "test", "lastname": "user", "email": "test@example.com", "password": "password123", "confirmPassword": "password123"}' localhost:50051 user.UserService/CreateUser
```

### h. Email Service (RabbitMQ)

Este servicio no expone un puerto HTTP. Escucha mensajes en RabbitMQ. Para probarlo, puedes publicar un mensaje en la cola `email_queue` usando la interfaz de RabbitMQ en `http://localhost:15672` (user: `guest`, pass: `guest`).

## 3. Pruebas del Sistema Completo (vía API Gateway)

Una vez que el `api-gateway` esté funcionando correctamente (actualmente en depuración), podrás probar los servicios a través de su puerto (ej. `8088`). Las rutas se mapean de la siguiente manera:

- `http://localhost:8088/auth/login` -> `auth-service`
- `http://localhost:8088/playlists` -> `playlist-service`
- `http://localhost:8088/videos` -> `video-service`
- etc.

**Ejemplo: Listar videos a través del Gateway:**
```bash
curl http://localhost:8088/videos
```

## 4. Ver Logs y Detener el Sistema

**Para ver los logs de todos los servicios:**
```bash
docker-compose logs -f
```

**Para ver los logs de un servicio específico (ej. `api-gateway`):**
```bash
docker-compose logs -f api-gateway
```

**Para detener todos los servicios:**
```bash
docker-compose down
```
