# Usar una imagen base de Node.js
FROM node:18-alpine

# Establecer el directorio de trabajo en el contenedor
WORKDIR /usr/src/app

# Copiar archivos de dependencias del servicio específico
COPY api-gateway/package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el código fuente del servicio
# Esto incluye el directorio 'src' y cualquier subdirectorio, como 'proto'
COPY api-gateway/src ./src

# Exponer el puerto del API Gateway
EXPOSE 8088

# Comando para iniciar la aplicación
CMD [ "npm", "start" ]
