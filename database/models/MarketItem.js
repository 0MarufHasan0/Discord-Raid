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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('MarketItem', MarketItemSchema);
