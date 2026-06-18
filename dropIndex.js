const mongoose = require('mongoose');
const config = require('./config');

(async () => {
  try {
    await mongoose.connect(config.mongodbUrl);
    console.log('Connected to MongoDB.');
    const db = mongoose.connection.db;
    
    // Drop the index
    await db.collection('tweets').dropIndex('tweetId_1');
    console.log('Successfully dropped tweetId_1 unique index!');
    process.exit(0);
  } catch (error) {
    console.error('Error dropping index:', error.message);
    process.exit(1);
  }
})();
