const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const Like = require('./models/Like');
const Comment = require('./models/Comment');

const app = express();
app.use(express.json());

// Configuración de MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb-social:27017/social_db';

mongoose.connect(MONGO_URI)
  .then(() => console.log('Conectado a MongoDB para interacciones sociales...'))
  .catch(err => console.error('No se pudo conectar a MongoDB', err));

// Endpoints de 'Likes'
app.post('/videos/:videoId/like', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId es requerido' });
    }
    const newLike = new Like({ videoId, userId });
    await newLike.save();
    res.status(201).json(newLike);
  } catch (error) {
    if (error.code === 11000) { // Error de índice duplicado
      return res.status(409).json({ error: 'El usuario ya ha dado like a este video' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/videos/:videoId/likes', async (req, res) => {
  try {
    const { videoId } = req.params;
    const likes = await Like.find({ videoId });
    res.json({ videoId, count: likes.length });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoints de Comentarios
app.post('/videos/:videoId/comments', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { userId, text } = req.body;
    if (!userId || !text) {
      return res.status(400).json({ error: 'userId y text son requeridos' });
    }
    const comment = new Comment({ videoId, userId, text });
    await comment.save();
    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/videos/:videoId/comments', async (req, res) => {
  try {
    const { videoId } = req.params;
    const comments = await Comment.find({ videoId }).sort({ createdAt: -1 });
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

const PORT = process.env.PORT || 3006;
app.listen(PORT, () => {
  console.log(`Servicio de interacciones sociales ejecutándose en puerto ${PORT}`);
});
