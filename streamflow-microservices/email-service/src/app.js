const amqp = require('amqplib');
require('dotenv').config();

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://admin:password@rabbitmq:5672';

async function startWorker() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    console.log('Conectado a RabbitMQ');

    // Consumidor para correos de bienvenida
    const userQueue = 'user_created_queue';
    await channel.assertQueue(userQueue, { durable: true });
    console.log(`[*] Esperando mensajes en ${userQueue}.`);
    channel.consume(userQueue, (msg) => {
      if (msg !== null) {
        try {
            const userData = JSON.parse(msg.content.toString());
            console.log(`[x] Recibido mensaje de creación de usuario: ${JSON.stringify(userData)}`);
            // Simulación de envío de correo de bienvenida
            console.log(`Enviando correo de bienvenida a ${userData.email}...`);
            console.log(`Correo de bienvenida enviado a ${userData.email}.`);
        } catch (e) {
            console.error("Error al procesar el mensaje de creación de usuario:", e);
        } finally {
            channel.ack(msg);
        }
      }
    });

    // Consumidor para correos de actualización de facturas
    const invoiceQueue = 'invoice_updated_queue';
    await channel.assertQueue(invoiceQueue, { durable: true });
    console.log(`[*] Esperando mensajes en ${invoiceQueue}.`);
    channel.consume(invoiceQueue, (msg) => {
      if (msg !== null) {
        try {
            const invoiceData = JSON.parse(msg.content.toString());
            console.log(`[x] Recibido mensaje de actualización de factura: ${JSON.stringify(invoiceData)}`);
            // Simulación de envío de correo de actualización de factura
            console.log(`Enviando correo de actualización de factura a ${invoiceData.userEmail}...`);
            console.log(`Correo enviado para la factura ${invoiceData.id} con monto ${invoiceData.amount} y estado ${invoiceData.status}.`);
        } catch(e) {
            console.error("Error al procesar el mensaje de actualización de factura:", e);
        } finally {
            channel.ack(msg);
        }
      }
    });

  } catch (error) {
    console.error('Error al conectar con RabbitMQ:', error);
    console.log('Reintentando conexión en 5 segundos...');
    setTimeout(startWorker, 5000);
  }
}

startWorker();
