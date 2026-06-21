import mongoose from 'mongoose';

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

// Attempt to recreate index safely
try {
  UserRoleExpirationSchema.index({ userId: 1, guildId: 1, roleId: 1 }, { unique: true });
} catch (e) {
  // Silent fallback if index compilation fails in hotreload
}

export default mongoose.models.UserRoleExpiration || mongoose.model('UserRoleExpiration', UserRoleExpirationSchema);
