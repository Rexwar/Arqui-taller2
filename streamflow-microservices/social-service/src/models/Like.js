const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema({
  videoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video',
    required: true,
  },
  userId: {
    type: String, // O podría ser ObjectId si los usuarios están en la misma DB
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Para asegurar que un usuario solo puede dar un 'like' por video
likeSchema.index({ videoId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Like', likeSchema);
