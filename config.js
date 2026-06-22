const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env
dotenv.config({ path: path.join(__dirname, '.env') });

const config = {
  discordToken: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  mongodbUrl: process.env.MONGODB_URL,
  adminRoleId: process.env.ADMIN_ROLE_ID,
  tweetChannelId: process.env.TWEET_CHANNEL_ID,
  marketplaceChannelId: process.env.MARKETPLACE_CHANNEL_ID || '',
  leaderboardChannelId: process.env.LEADERBOARD_CHANNEL_ID || '',
  ticketCategoryId: process.env.TICKET_CATEGORY_ID || '',
};

// Check for missing configurations
const missingKeys = Object.keys(config).filter(key => !config[key]);
if (missingKeys.length > 0) {
  console.warn(`⚠️ Warning: Missing configurations in .env: ${missingKeys.map(k => k.replace(/[A-Z]/g, letter => `_${letter.toUpperCase()}`)).join(', ')}`);
}

module.exports = config;
