const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const User = require('../database/models/User');

/**
 * Updates the live leaderboard embed message in the configured channel.
 * If a message exists, it edits it. Otherwise, it sends a new one.
 * @param {import('discord.js').Client} client 
 */
async function updateLeaderboard(client) {
  try {
    const channelId = config.leaderboardChannelId;
    if (!channelId) {
      console.warn('⚠️ Warning: leaderboardChannelId is not configured.');
      return;
    }

    let channel = client.channels.cache.get(channelId);
    if (!channel) {
      try {
        channel = await client.channels.fetch(channelId);
      } catch (err) {
        console.error(`❌ Error fetching leaderboard channel (${channelId}):`, err.message);
        return;
      }
    }

    if (!channel || !channel.isTextBased()) {
      console.warn(`⚠️ Warning: Leaderboard channel (${channelId}) is not a text-based channel.`);
      return;
    }

    // Fetch top 10 users sorted by points descending
    const topUsers = await User.find({}).sort({ points: -1 }).limit(10);

    const embed = new EmbedBuilder()
      .setTitle("🏆 Live Leaderboard — Top Raiders")
      .setColor(0xFFD700) // Gold
      .setTimestamp();

    if (topUsers.length === 0) {
      embed.setDescription("📭 **লিডারবোর্ডে এখনো কোনো ব্যবহারকারী নেই।**\nপয়েন্ট অর্জন করার সাথে সাথে এখানে নাম চলে আসবে!");
    } else {
      let desc = "রেইড সম্পন্ন করে পয়েন্ট অর্জন করো এবং লিডারবোর্ডের শীর্ষে উঠে আসো!\n\n";
      const rankEmojis = ['🥇', '🥈', '🥉'];
      
      topUsers.forEach((user, index) => {
        const rank = index + 1;
        const emoji = rank <= 3 ? rankEmojis[index] : `\`#${rank.toString().padStart(2, '0')}\``;
        desc += `${emoji} | **${user.username}**\n`;
        desc += `> 💰 **Points:** \`${user.points}\` | 📋 **Raids:** \`${user.raidsApproved || 0}\` approved\n\n`;
      });
      
      embed.setDescription(desc);
    }

    embed.setFooter({ text: "🔴 Updates automatically when points change" });

    // Fetch the last 50 messages to find the bot's previous leaderboard embed
    let messages;
    try {
      messages = await channel.messages.fetch({ limit: 50 });
    } catch (err) {
      console.error(`❌ Error fetching messages from leaderboard channel:`, err.message);
      if (err.code === 50001 || err.code === 50013) {
        console.warn(`⚠️ Warning: Bot does not have permission (Missing Access/Permissions) to read/send in leaderboard channel.`);
        return;
      }
      // Fallback: try to send a new message
      try {
        await channel.send({ embeds: [embed] });
      } catch (sendErr) {
        console.error(`❌ Fallback leaderboard send failed:`, sendErr.message);
      }
      return;
    }

    const botMessage = messages.find(msg => 
      msg.author.id === client.user.id && 
      msg.embeds.length > 0 && 
      (msg.embeds[0].title === "🏆 Live Leaderboard — Top Raiders" || msg.embeds[0].title === "🏆 Leaderboard — Top Raiders")
    );

    try {
      if (botMessage) {
        await botMessage.edit({ embeds: [embed] });
        console.log(`✅ Live Leaderboard message updated in #${channel.name}`);
      } else {
        await channel.send({ embeds: [embed] });
        console.log(`✅ New Live Leaderboard message sent in #${channel.name}`);
      }
    } catch (sendOrEditError) {
      console.error(`❌ Error sending or editing message in leaderboard channel:`, sendOrEditError.message);
    }

  } catch (error) {
    console.error('❌ Error updating live leaderboard:', error);
  }
}

module.exports = updateLeaderboard;
