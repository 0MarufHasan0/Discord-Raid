const mongoose = require('mongoose');

const BotCreatedRoleSchema = new mongoose.Schema({
  roleId: {
    type: String,
    required: true,
    unique: true
  },
  roleName: {
    type: String,
    required: true
  },
  itemName: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('BotCreatedRole', BotCreatedRoleSchema);
