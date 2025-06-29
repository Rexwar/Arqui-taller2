# Usar una imagen base de Node.js
FROM node:18-alpine

# Instalar curl para el healthcheck
RUN apk --no-cache add curl

# Establecer el directorio de trabajo en el contenedor
WORKDIR /usr/src/app

# Copiar package.json y package-lock.json
COPY monitoring-service/package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto de los archivos de la aplicación
COPY monitoring-service/src ./src

# Exponer el puerto que usa la aplicación
EXPOSE 3005

# Comando para iniciar la aplicación
CMD [ "npm", "start" ]
