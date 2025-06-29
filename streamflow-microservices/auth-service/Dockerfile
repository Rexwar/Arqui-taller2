# Usar una imagen base de Node.js
FROM node:18-alpine

# Instalar curl para el healthcheck
RUN apk --no-cache add curl

# Establecer el directorio de trabajo
WORKDIR /usr/src/app

# Copiar archivos de dependencias del servicio específico
COPY auth-service/package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el directorio de proto compartido
COPY auth-service/proto ./proto/

# Copiar el código fuente del servicio
COPY auth-service/src ./src

# Copiar los archivos de prueba
COPY auth-service/__tests__ ./__tests__/

# Exponer el puerto de la aplicación
EXPOSE 3001

# Comando para iniciar la aplicación
CMD [ "npm", "start" ]
