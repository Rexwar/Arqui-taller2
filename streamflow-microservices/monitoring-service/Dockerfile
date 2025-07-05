# Usar una imagen base de Node.js
FROM node:18-alpine

# Instalar grpc-health-probe y wget
RUN apk --no-cache add wget curl && \
    GRPC_HEALTH_PROBE_VERSION=v0.4.15 && \
    wget -q -O/bin/grpc-health-probe https://github.com/grpc-ecosystem/grpc-health-probe/releases/download/${GRPC_HEALTH_PROBE_VERSION}/grpc-health-probe-linux-amd64 && \
    chmod +x /bin/grpc-health-probe

# Establecer el directorio de trabajo en el contenedor
WORKDIR /usr/src/app

# Copiar package.json y package-lock.json
COPY monitoring-service/package*.json ./

# Instalar dependencias de producción
RUN npm install --production

# Copiar el resto de los archivos de la aplicación
COPY monitoring-service/ .

# Exponer el puerto que usa la aplicación
EXPOSE 50055

# Comando para iniciar la aplicación
CMD [ "npm", "start" ]
