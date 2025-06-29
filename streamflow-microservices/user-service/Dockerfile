# Usar una imagen base de Node.js
FROM node:18-alpine

# Establecer el directorio de trabajo en el contenedor
WORKDIR /usr/src/app

# 1. Copiar solo los archivos de dependencias
COPY package*.json ./

# 2. Instalar dependencias
# Esta capa solo se reconstruirá si los archivos package*.json cambian.
RUN npm install

# 3. Copiar el resto del código fuente y los archivos proto
COPY src ./src
COPY __tests__ ./__tests__
COPY proto ./proto

# Instalar grpc-health-probe para los chequeos de salud de Docker
RUN wget -q -O /bin/grpc-health-probe https://github.com/grpc-ecosystem/grpc-health-probe/releases/download/v0.4.39/grpc_health_probe-linux-amd64 && \
    chmod +x /bin/grpc-health-probe

# Exponer el puerto gRPC
EXPOSE 50051

# Comando para iniciar la aplicación
CMD ["npm", "start"]
