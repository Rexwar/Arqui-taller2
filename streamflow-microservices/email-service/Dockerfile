# Usar una imagen base de Node.js
FROM node:18-alpine

# Instalar curl para el healthcheck
RUN apk --no-cache add curl

# Establecer el directorio de trabajo en el contenedor
WORKDIR /usr/src/app

# Copiar package.json y package-lock.json
COPY email-service/package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto de los archivos de la aplicación
COPY email-service/src ./src

# Comando para iniciar la aplicación
CMD [ "npm", "start" ]
