const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Raid = require('../../database/models/Raid');
const User = require('../../database/models/User');
const Tweet = require('../../database/models/Tweet');
const updateLeaderboard = require('../../utils/updateLeaderboard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removemyraid')
    .setDescription('Remove a submitted raid to correct a mistake (deducts rewarded points)')
    .addStringOption(option =>
      option.setName('tweet_id')
        .setDescription('The Tweet ID of the raid to remove')
        .setRequired(true)),
  async execute(interaction) {
    try {
      // Defer reply ephemerally to avoid timeouts on database calls
      await interaction.deferReply({ ephemeral: true });

      const tweetId = interaction.options.getString('tweet_id').trim();
      const escapedTweetId = tweetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // 1. Check if the Tweet has expired
      const tweetDoc = await Tweet.findOne({ 
        tweetId: { $regex: new RegExp(`^${escapedTweetId}$`, 'i') } 
      }).sort({ postedAt: -1 });

      if (tweetDoc && tweetDoc.expiresAt && new Date() > tweetDoc.expiresAt) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF0000)
              .setDescription(`❌ This raid has expired! You cannot remove your submission for an expired raid.`)
          ]
        });
      }

      // 2. Find the raid submission (using case-insensitive search for tweetId)
      const raid = await Raid.findOne({ 
        userId: interaction.user.id, 
        tweetId: { $regex: new RegExp(`^${escapedTweetId}$`, 'i') } 
      });

      if (!raid) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF0000)
              .setDescription(`❌ No raid submission found for this Tweet ID (\`${tweetId}\`).`)
          ]
        });
      }

      // 3. Delete the raid from database
      await Raid.deleteOne({ _id: raid._id });

      // 4. Find user and deduct points (if approved) and decrement raid counters, clamping at 0
      const userDoc = await User.findOne({ discordId: interaction.user.id });
      const deductPoints = (raid && typeof raid.points === 'number') ? raid.points : 1;
      if (userDoc) {
        const wasApproved = raid.status === 'approved';
        if (wasApproved) {
          userDoc.points = Math.max(0, userDoc.points - deductPoints);
          userDoc.raidsApproved = Math.max(0, userDoc.raidsApproved - 1);
        }
        userDoc.raidsSubmitted = Math.max(0, userDoc.raidsSubmitted - 1);
        await userDoc.save();

        if (wasApproved) {
          // Update live leaderboard channel
          updateLeaderboard(interaction.client);
        }
      }

      const totalPoints = userDoc ? userDoc.points : 0;
      const canonicalTweetId = tweetDoc ? tweetDoc.tweetId : raid.tweetId || tweetId;

      const replyEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Success green
        .setDescription(
          `✅ Your raid submission has been successfully deleted!\n\n` +
          `📋 **Tweet ID:** **${canonicalTweetId}**\n` +
          `💰 **Point Change:** **-${deductPoints}** (if it was approved)\n` +
          `💰 **Your current total points:** **${totalPoints}**\n\n` +
          `You can now submit a new raid for this Tweet ID.`
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [replyEmbed] });

    } catch (error) {
      console.error('Error in /removemyraid command:', error);
      try {
        await interaction.editReply({ content: "❌ An error occurred. Please try again." });
      } catch (err) {
        // Silently catch errors if interaction already finished/closed
      }
    }
  }
};
