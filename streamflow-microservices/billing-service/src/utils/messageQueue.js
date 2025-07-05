const amqp = require('amqplib');
require('dotenv').config();

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://admin:password@rabbitmq:5672';
let channel = null;

const connectRabbitMQ = async () => {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    console.log('Conectado a RabbitMQ para publicación');
  } catch (error) {
    console.error('Error al conectar con RabbitMQ:', error);
    console.log('Reintentando conexión en 5 segundos...');
    setTimeout(connectRabbitMQ, 5000);
  }
};

const publishToQueue = async (queue, message) => {
  if (!channel) {
    console.error('El canal de RabbitMQ no está disponible.');
    return;
  }
  try {
    await channel.assertQueue(queue, { durable: true });
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), { persistent: true });
    console.log(`[x] Enviado a la cola ${queue}: ${JSON.stringify(message)}`);
  } catch (error) {
    console.error(`Error al publicar en la cola ${queue}:`, error);
  }
};

module.exports = {
  connectRabbitMQ,
  publishToQueue,
};
