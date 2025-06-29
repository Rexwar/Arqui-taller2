# Atlas de Bases de Datos - StreamFlow Microservices

Este documento centraliza la estructura y el esquema de todas las bases de datos utilizadas en el ecosistema de microservicios de StreamFlow. Sirve como una referencia única para desarrolladores para entender las entidades de datos, sus atributos y las tecnologías subyacentes.

---

## 1. User Service

- **Tecnología:** MySQL 8
- **Nombre de la Base de Datos:** `users_db`
- **Descripción:** Almacena la información fundamental de los usuarios.

### Tabla: `users`

| Columna      | Tipo                             | Restricciones                  |
|--------------|----------------------------------|--------------------------------|
| `id`         | `INT`                            | `PRIMARY KEY`, `AUTO_INCREMENT`|
| `name`       | `VARCHAR(255)`                   | `NOT NULL`                     |
| `lastname`   | `VARCHAR(255)`                   | `NOT NULL`                     |
| `email`      | `VARCHAR(255)`                   | `NOT NULL`, `UNIQUE`           |
| `password`   | `VARCHAR(255)`                   | `NOT NULL`                     |
| `role`       | `ENUM('Cliente', 'Administrador')`| `DEFAULT 'Cliente'`            |
| `created_at` | `TIMESTAMP`                      | `DEFAULT CURRENT_TIMESTAMP`    |
| `deleted_at` | `TIMESTAMP`                      | `NULL` (para Soft Delete)      |

---

## 2. Auth Service

- **Tecnología:** PostgreSQL 15
- **Nombre de la Base de Datos:** `auth_db`
- **Descripción:** Gestiona la blacklist de tokens JWT para invalidar sesiones.

### Tabla: `token_blacklist`

| Columna      | Tipo           | Restricciones           |
|--------------|----------------|-------------------------|
| `id`         | `SERIAL`       | `PRIMARY KEY`           |
| `token`      | `VARCHAR(512)` | `NOT NULL`, `UNIQUE`    |
| `expires_at` | `TIMESTAMP`    | `NOT NULL`              |

---

## 3. Playlist Service

- **Tecnología:** PostgreSQL 15
- **Nombre de la Base de Datos:** `playlist_db`
- **Descripción:** Almacena las listas de reproducción creadas por los usuarios.

### Tabla: `playlists`

| Columna     | Tipo           | Restricciones                |
|-------------|----------------|------------------------------|
| `id`        | `SERIAL`       | `PRIMARY KEY`                |
| `user_id`   | `INT`          | `NOT NULL`, `FOREIGN KEY (users.id)` |
| `name`      | `VARCHAR(100)` | `NOT NULL`                   |
| `video_ids` | `INT[]`        |                              |

---

## 4. Billing Service

- **Tecnología:** MariaDB 10
- **Nombre de la Base de Datos:** `billing_db`
- **Descripción:** Gestiona las facturas y pagos de los usuarios.

### Tabla: `invoices`

| Columna      | Tipo            | Restricciones                  |
|--------------|-----------------|--------------------------------|
| `id`         | `INT`           | `PRIMARY KEY`, `AUTO_INCREMENT`|
| `user_id`    | `INT`           | `NOT NULL`, `FOREIGN KEY (users.id)` |
| `amount`     | `DECIMAL(10, 2)`| `NOT NULL`                     |
| `due_date`   | `DATE`          | `NOT NULL`                     |
| `paid`       | `BOOLEAN`       | `DEFAULT false`                |
| `created_at` | `TIMESTAMP`     | `DEFAULT CURRENT_TIMESTAMP`    |

---

## 5. Video Service

- **Tecnología:** MongoDB 6
- **Nombre de la Base de Datos:** `video_db`
- **Descripción:** Contiene el catálogo de videos de la plataforma.

### Colección: `videos`

```json
{
  "_id": "ObjectId",
  "title": "String",
  "description": "String",
  "genre": "String",
  "url": "String",
  "likes": "Number",
  "createdAt": "Date",
  "deletedAt": "Date" // Para Soft Delete
}
```

---

## 6. Social Service

- **Tecnología:** MongoDB 6
- **Nombre de la Base de Datos:** `social_db`
- **Descripción:** Almacena interacciones sociales como likes y comentarios.

### Colección: `likes`

```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId", // Referencia al usuario
  "video_id": "ObjectId", // Referencia al video
  "createdAt": "Date"
}
```

### Colección: `comments`

```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId", // Referencia al usuario
  "video_id": "ObjectId", // Referencia al video
  "comment": "String",
  "createdAt": "Date"
}
```

---

## 7. Monitoring Service

- **Tecnología:** MongoDB 6
- **Nombre de la Base de Datos:** `monitoring_db`
- **Descripción:** Registra logs y métricas del sistema para monitoreo y auditoría.

### Colección: `service_logs`

```json
{
  "_id": "ObjectId",
  "service_name": "String",
  "level": "String", // e.g., 'info', 'error', 'warn'
  "message": "String",
  "timestamp": "Date"
}
```

### Colección: `api_gateway_logs`

```json
{
  "_id": "ObjectId",
  "endpoint": "String",
  "method": "String",
  "status_code": "Number",
  "response_time_ms": "Number",
  "timestamp": "Date"
}
```
