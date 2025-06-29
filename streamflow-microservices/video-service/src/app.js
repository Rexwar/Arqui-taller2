const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const Video = require('./models/Video');

const app = express();
app.use(express.json());

// Configuración de MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb-video:27017/video_db';

mongoose.connect(MONGO_URI)
  .then(() => console.log('Conectado a MongoDB para videos...'))
  .catch(err => console.error('No se pudo conectar a MongoDB', err));

// Endpoints de Videos
app.post('/', async (req, res) => {
  try {
    const { title, description, url } = req.body;
    if (!title || !description || !url) {
      return res.status(400).json({ error: 'title, description, y url son requeridos' });
    }
    const video = new Video({ title, description, url });
    await video.save();
    res.status(201).json(video);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/', async (req, res) => {
  try {
    const videos = await Video.find();
    res.json(videos);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`Servicio de videos ejecutándose en puerto ${PORT}`);
});
