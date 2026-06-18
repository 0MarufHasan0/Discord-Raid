const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Raid = require('../../database/models/Raid');
const User = require('../../database/models/User');
const updateLeaderboard = require('../../utils/updateLeaderboard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removemyraid')
    .setDescription('Remove a submitted raid to correct a mistake (deducts 10 points)')
    .addStringOption(option =>
      option.setName('tweet_id')
        .setDescription('The Tweet ID of the raid to remove')
        .setRequired(true)),
  async execute(interaction) {
    try {
      const tweetId = interaction.options.getString('tweet_id').trim();
      const escapedTweetId = tweetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Find the raid submission (using case-insensitive search for tweetId)
      const raid = await Raid.findOne({ 
        userId: interaction.user.id, 
        tweetId: { $regex: new RegExp(`^${escapedTweetId}$`, 'i') } 
      });
      if (!raid) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ No raid submission found for this Tweet ID (\`${tweetId}\`).`)],
          ephemeral: true
        });
      }

      // Delete the raid from database
      await Raid.deleteOne({ _id: raid._id });

      // Find user and deduct 10 points (if approved) and decrement raid counters, clamping at 0
      const userDoc = await User.findOne({ discordId: interaction.user.id });
      if (userDoc) {
        const wasApproved = raid.status === 'approved';
        if (wasApproved) {
          userDoc.points = Math.max(0, userDoc.points - 10);
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

      const replyEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Success green
        .setDescription(
          `✅ Your raid submission has been successfully deleted!\n\n` +
          `📋 **Tweet ID:** **${raid.tweetId || tweetId}**\n` +
          `💰 **Point Change:** **-10** (if it was approved)\n` +
          `💰 **Your current total points:** **${totalPoints}**\n\n` +
          `You can now submit a new raid for this Tweet ID.`
        )
        .setTimestamp();

      await interaction.reply({ embeds: [replyEmbed], ephemeral: true });

    } catch (error) {
      console.error('Error in /removemyraid command:', error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: "❌ An error occurred. Please try again.", ephemeral: true });
        } else {
          await interaction.reply({ content: "❌ An error occurred. Please try again.", ephemeral: true });
        }
      } catch (err) {
        // Silently catch errors if interaction already finished/closed
      }
    }
  }
};
