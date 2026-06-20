const mongoose = require('mongoose');

const UserRoleExpirationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  guildId: {
    type: String,
    required: true
  },
  roleId: {
    type: String,
    required: true
  },
  itemName: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to quickly query expired roles and avoid duplicate roles per user in a guild
UserRoleExpirationSchema.index({ userId: 1, guildId: 1, roleId: 1 }, { unique: true });

module.exports = mongoose.model('UserRoleExpiration', UserRoleExpirationSchema);
