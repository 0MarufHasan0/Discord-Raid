const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  discordId: {
    type: String,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true
  },
  points: {
    type: Number,
    default: 0
  },
  raidsSubmitted: {
    type: Number,
    default: 0
  },
  raidsApproved: {
    type: Number,
    default: 0
  },
  twitter: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', UserSchema);
