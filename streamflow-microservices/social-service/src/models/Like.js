const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema({
  videoId: {
    type: String,
    required: true,
  },
  userId: {
    type: String,
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('Like', likeSchema);
