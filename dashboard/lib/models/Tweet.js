import mongoose from 'mongoose';

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
    default: 1
  },
  messageId: {
    type: String
  }
});

export default mongoose.models.Tweet || mongoose.model('Tweet', TweetSchema);
