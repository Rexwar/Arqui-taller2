const mongoose = require('mongoose');

const errorSchema = new mongoose.Schema({
  userId: { type: String, required: false, default: '' },
  userEmail: { type: String, required: false, default: '' },
  errorMessage: { type: String, required: true },
  service: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Error', errorSchema);
