const express = require('express');
const amqp = require('amqplib');
require('dotenv').config();

// --- Configuración del servidor Express ---
const app = express();
const PORT = process.env.PORT || 3007;

// Endpoint de salud para Docker
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`Servicio de email (HTTP) ejecutándose en puerto ${PORT}`);
  // Una vez que el servidor está listo, iniciamos el consumidor de RabbitMQ
  startConsumer();
});


// --- Lógica del consumidor de RabbitMQ ---
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://admin:password@rabbitmq:5672';

async function startConsumer() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();

    const queue = 'user_created_queue';
    await channel.assertQueue(queue, { durable: true });

    console.log(`[*] Esperando mensajes en la cola ${queue}.`);

    channel.consume(queue, (msg) => {
      if (msg !== null) {
        const userData = JSON.parse(msg.content.toString());
        console.log(`[x] Recibido: ${JSON.stringify(userData)}`);
        
        // Simulación de envío de correo
        console.log(`Enviando correo de bienvenida a ${userData.email}...`);
        
        // Aquí iría la lógica real para enviar el correo (usando Nodemailer, SendGrid, etc.)
        
        console.log(`Correo de bienvenida enviado a ${userData.email}.`);
        
        channel.ack(msg);
      }
    });
  } catch (error) {
    console.error('Error al conectar con RabbitMQ:', error);
    console.log('Reintentando conexión a RabbitMQ en 5 segundos...');
    setTimeout(startConsumer, 5000);
  }
}
