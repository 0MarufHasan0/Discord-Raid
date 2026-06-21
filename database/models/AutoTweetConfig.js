const mongoose = require('mongoose');

const AutoTweetConfigSchema = new mongoose.Schema({
  twitterUsernames: {
    type: [String],
    default: []
  },
  isEnabled: {
    type: Boolean,
    default: true
  },
  lastCheckedTweets: {
    type: Map,
    of: String, // username -> lastStatusId
    default: {}
  }
});

module.exports = mongoose.model('AutoTweetConfig', AutoTweetConfigSchema);
