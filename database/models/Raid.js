const mongoose = require('mongoose');

const RaidSchema = new mongoose.Schema({
  raidId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  link: {
    type: String,
    required: true
  },
  tweetId: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  approvedAt: {
    type: Date
  },
  approvedBy: {
    type: String
  },
  rejectedReason: {
    type: String
  },
  points: {
    type: Number,
    default: 10
  }
});

module.exports = mongoose.model('Raid', RaidSchema);
