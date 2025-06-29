const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const Log = require('./models/Log');

const app = express();
app.use(express.json());

// Configuración de MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb-monitoring:27017/monitoring_db';

mongoose.connect(MONGO_URI)
  .then(() => console.log('Conectado a MongoDB para monitoreo...'))
  .catch(err => console.error('No se pudo conectar a MongoDB', err));

// Endpoints de Monitoreo
app.post('/', async (req, res) => {
  try {
    const { service, level, message } = req.body;
    if (!service || !level || !message) {
      return res.status(400).json({ error: 'service, level, y message son requeridos' });
    }
    const log = new Log({ service, level, message });
    await log.save();
    res.status(201).json(log);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/', async (req, res) => {
  try {
    const logs = await Log.find().sort({ timestamp: -1 }).limit(100);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint de salud para Docker
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`Servicio de monitoreo ejecutándose en puerto ${PORT}`);
});
