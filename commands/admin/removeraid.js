const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const checkAdmin = require('../../utils/checkAdmin');
const Tweet = require('../../database/models/Tweet');
const Raid = require('../../database/models/Raid');
const User = require('../../database/models/User');
const updateLeaderboard = require('../../utils/updateLeaderboard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removeraid')
    .setDescription('Delete a raid announcement and remove its database records')
    .addStringOption(option =>
      option.setName('tweet_id')
        .setDescription('The Tweet ID of the raid to remove (e.g., status ID or TWT-xxxxxx)')
        .setRequired(true))
    .addBooleanOption(option =>
      option.setName('delete_message')
        .setDescription('Whether to delete the announcement message from the server (default: True)')
        .setRequired(false)),
  async execute(interaction) {
    try {
      // Check admin permissions
      const isAdmin = await checkAdmin(interaction);
      if (!isAdmin) return;

      await interaction.deferReply({ ephemeral: true });

      const tweetId = interaction.options.getString('tweet_id').trim();
      const deleteMessage = interaction.options.getBoolean('delete_message') !== false; // defaults to true

      const escapedTweetId = tweetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Find all tweet documents matching this tweetId (case-insensitive)
      const tweetDocs = await Tweet.find({
        tweetId: { $regex: new RegExp(`^${escapedTweetId}$`, 'i') }
      });

      if (tweetDocs.length === 0) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF0000)
              .setDescription(`❌ No raid announcement found in the database with Tweet ID \`${tweetId}\`.`)
          ]
        });
      }

      const canonicalTweetId = tweetDocs[0].tweetId;
      const escapedCanonicalTweetId = canonicalTweetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      let deletedMessagesCount = 0;

      // 1. Delete Discord messages and remove Tweet documents
      for (const doc of tweetDocs) {
        if (deleteMessage && doc.channelId && doc.messageId) {
          try {
            const channel = interaction.client.channels.cache.get(doc.channelId)
              || await interaction.client.channels.fetch(doc.channelId).catch(() => null);
            if (channel) {
              const message = await channel.messages.fetch(doc.messageId).catch(() => null);
              if (message) {
                await message.delete();
                deletedMessagesCount++;
              }
            }
          } catch (err) {
            console.error(`[RemoveRaid] Failed to delete Discord message ${doc.messageId} in channel ${doc.channelId}:`, err.message);
          }
        }
        // Delete Tweet document from database
        await Tweet.deleteOne({ _id: doc._id });
      }

      // 2. Fetch all user submissions for this tweet to deduct points
      const associatedRaids = await Raid.find({
        tweetId: { $regex: new RegExp(`^${escapedCanonicalTweetId}$`, 'i') }
      });

      let affectedUsersCount = 0;
      let totalDeductedPoints = 0;

      for (const raid of associatedRaids) {
        if (raid.status === 'approved') {
          const userDoc = await User.findOne({ discordId: raid.userId });
          const deductPoints = (typeof raid.points === 'number') ? raid.points : 1;
          if (userDoc) {
            userDoc.points = Math.max(0, userDoc.points - deductPoints);
            userDoc.raidsApproved = Math.max(0, userDoc.raidsApproved - 1);
            userDoc.raidsSubmitted = Math.max(0, userDoc.raidsSubmitted - 1);
            await userDoc.save();
            affectedUsersCount++;
            totalDeductedPoints += deductPoints;
          }
        }
      }

      // 3. Delete all raid submissions from database
      const deletedRaidsResult = await Raid.deleteMany({
        tweetId: { $regex: new RegExp(`^${escapedCanonicalTweetId}$`, 'i') }
      });

      // 4. Update the live leaderboard since points changed
      if (affectedUsersCount > 0) {
        updateLeaderboard(interaction.client);
      }

      const successEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Success green
        .setTitle("🗑️ Raid Announcement Removed")
        .setDescription(
          `✅ Successfully removed the raid announcement for Tweet ID: **${canonicalTweetId}**\n\n` +
          `📊 **Summary of Changes:**\n` +
          `• **Tweet Announcements Deleted:** \`${tweetDocs.length}\` database record(s)\n` +
          `• **Discord Messages Deleted:** \`${deletedMessagesCount}\` message(s)\n` +
          `• **User Submissions Deleted:** \`${deletedRaidsResult.deletedCount}\` submission(s)\n` +
          `• **Points Reverted:** Deducted \`${totalDeductedPoints}\` points from \`${affectedUsersCount}\` user(s)`
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [successEmbed] });

      // Send admin log
      const sendAdminLog = require('../../utils/sendAdminLog');
      await sendAdminLog(interaction.client, {
        action: 'Raid Deleted',
        executor: interaction.user.tag,
        target: `Tweet ID: ${canonicalTweetId}`,
        details: `Deleted raid announcement and all associated database records.`,
        fields: [
          { name: 'Deleted Announcements', value: `${tweetDocs.length}`, inline: true },
          { name: 'Deleted Discord Messages', value: `${deletedMessagesCount}`, inline: true },
          { name: 'Deleted Submissions', value: `${deletedRaidsResult.deletedCount}`, inline: true },
          { name: 'Points Deducted (Total)', value: `${totalDeductedPoints} pts from ${affectedUsersCount} users`, inline: false }
        ],
        color: 0xE74C3C // Red
      });

    } catch (error) {
      console.error('Error in /removeraid command:', error);
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ content: "❌ An error occurred while removing the raid announcement.", ephemeral: true });
        } else {
          await interaction.reply({ content: "❌ An error occurred while removing the raid announcement.", ephemeral: true });
        }
      } catch (err) {}
    }
  }
};
