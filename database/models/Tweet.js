const mongoose = require('mongoose');

const TweetSchema = new mongoose.Schema({
  tweetId: {
    type: String
  },
  content: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String
  },
  postedBy: {
    type: String,
    required: true
  },
  postedAt: {
    type: Date,
    default: Date.now
  },
  channelId: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date
  },
  points: {
    type: Number,
    default: 10
  },
  messageId: {
    type: String
  }
});

module.exports = mongoose.model('Tweet', TweetSchema);
