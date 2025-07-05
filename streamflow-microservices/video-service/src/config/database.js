const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = 'mongodb://localhost:27017/video_db';

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Conectado a MongoDB para videos...');
  } catch (err) {
    console.error('❌ No se pudo conectar a MongoDB', err);
    process.exit(1);
  }
};

module.exports = connectDB;
