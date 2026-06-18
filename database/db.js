const mongoose = require('mongoose');
const config = require('../config');

const connectDB = async () => {
  try {
    if (!config.mongodbUrl || config.mongodbUrl.includes('your_mongodb_atlas_url_here')) {
      throw new Error("MongoDB URL is not configured or contains placeholder in .env file.");
    }
    await mongoose.connect(config.mongodbUrl);
    console.log('✅ Connected to MongoDB Atlas successfully.');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
