const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Tweet = require('../database/models/Tweet');

async function updateActiveRaidButtons(client) {
  try {
    // Get tweets posted in the last 7 days or non-expired
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const activeTweets = await Tweet.find({
      $or: [
        { expiresAt: { $gt: new Date() } },
        { expiresAt: null },
        { postedAt: { $gt: sevenDaysAgo } }
      ]
    });

    for (const tweet of activeTweets) {
      if (!tweet.messageId || !tweet.channelId) continue;
      
      const channel = await client.channels.fetch(tweet.channelId).catch(() => null);
      if (!channel) continue;

      const message = await channel.messages.fetch(tweet.messageId).catch(() => null);
      if (!message) continue;

      // Check if there is already a Reply button
      let hasReplyButton = false;
      for (const row of message.components) {
        for (const comp of row.components) {
          if (comp.label === 'Reply' || (comp.url && comp.url.includes('in_reply_to='))) {
            hasReplyButton = true;
            break;
          }
        }
        if (hasReplyButton) break;
      }

      if (hasReplyButton) continue;

      console.log(`Adding Reply button to active raid message: ${tweet.messageId}`);

      // Reconstruct rows
      const newComponents = [];

      // Look for the row that has Like/Retweet (we check if it has buttons with style Link)
      let twitterRowIndex = -1;
      for (let i = 0; i < message.components.length; i++) {
        const row = message.components[i];
        const hasLikeOrRetweet = row.components.some(comp => 
          comp.label === 'Like' || comp.label === 'Retweet'
        );
        if (hasLikeOrRetweet) {
          twitterRowIndex = i;
          break;
        }
      }

      if (twitterRowIndex !== -1) {
        // We found the twitter row. Let's add Reply button there.
        const oldRow = message.components[twitterRowIndex];
        const newRow = new ActionRowBuilder();
        
        let originalTweetLink = `https://x.com/i/status/${tweet.tweetId}`;
        // Reconstruct old components for this row and extract original link
        for (const comp of oldRow.components) {
          newRow.addComponents(ButtonBuilder.from(comp));
          if (comp.url && (comp.label === 'Like' || comp.label === 'Retweet')) {
            originalTweetLink = comp.url;
          }
        }

        // Add the Reply button to the row
        newRow.addComponents(
          new ButtonBuilder()
            .setLabel('Reply')
            .setEmoji('💬')
            .setURL(originalTweetLink)
            .setStyle(ButtonStyle.Link)
        );
        
        // Reconstruct the full components array for the message
        for (let i = 0; i < message.components.length; i++) {
          if (i === twitterRowIndex) {
            newComponents.push(newRow);
          } else {
            const rowBuilder = new ActionRowBuilder();
            for (const comp of message.components[i].components) {
              rowBuilder.addComponents(ButtonBuilder.from(comp));
            }
            newComponents.push(rowBuilder);
          }
        }

        await message.edit({ components: newComponents }).catch(err => {
          console.error(`Error editing message components for ${tweet.messageId}:`, err);
        });
      }
    }
  } catch (error) {
    console.error('Error in updateActiveRaidButtons:', error);
  }
}

module.exports = updateActiveRaidButtons;
