const mongoose = require('mongoose');

const MarketItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: true
  },
  pointCost: {
    type: Number,
    required: true
  },
  totalSlots: {
    type: Number,
    required: true
  },
  claimedSlots: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date
  },
  roleId: {
    type: String,
    default: null
  },
  claimDurationDays: {
    type: Number,
    default: 30
  },
  claimDurationMs: {
    type: Number,
    default: 30 * 24 * 60 * 60 * 1000
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('MarketItem', MarketItemSchema);
