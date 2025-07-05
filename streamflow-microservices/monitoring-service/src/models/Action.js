const mongoose = require('mongoose');

const actionSchema = new mongoose.Schema({
  userId: { type: String, required: false, default: '' },
  userEmail: { type: String, required: false, default: '' },
  action: { type: String, required: true },
  method: { type: String, required: true },
  url: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Action', actionSchema);
