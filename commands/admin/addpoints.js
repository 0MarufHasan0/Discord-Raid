const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const checkAdmin = require('../../utils/checkAdmin');
const User = require('../../database/models/User');
const updateLeaderboard = require('../../utils/updateLeaderboard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addpoints')
    .setDescription('Give points to a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to award points to')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('The number of points to award')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for giving points')
        .setRequired(false)),
  async execute(interaction) {
    try {
      // Check admin permissions
      const isAdmin = await checkAdmin(interaction);
      if (!isAdmin) return;

      const targetUser = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      const reason = interaction.options.getString('reason') || 'Admin Awarded';

      if (amount <= 0) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ Point amount must be greater than 0.")],
          ephemeral: true
        });
      }

      // Find or create user and increment points
      const userDoc = await User.findOneAndUpdate(
        { discordId: targetUser.id },
        {
          $inc: { points: amount },
          $set: { username: targetUser.username },
          $setOnInsert: { discordId: targetUser.id, createdAt: new Date() }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Update live leaderboard channel
      updateLeaderboard(interaction.client);

      /*
      // Attempt to DM the user
      const dmEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Success green
        .setDescription(`🎉 You have received **${amount}** points!\n**Reason:** ${reason}\n**Your total points:** ${userDoc.points}`)
        .setTimestamp();

      try {
        await targetUser.send({ embeds: [dmEmbed] });
      } catch (dmError) {
        // Silently ignore if user has DMs closed
        console.log(`[DM Fail] Could not DM user ${targetUser.username} (${targetUser.id}). DMs might be closed.`);
      }
      */

      // Reply to admin
      const replyEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Success green
        .setDescription(`✅ **${targetUser.username}** has been given **${amount}** points. Total: **${userDoc.points}**`);

      await interaction.reply({ embeds: [replyEmbed], ephemeral: true });

      // Send admin log
      const sendAdminLog = require('../../utils/sendAdminLog');
      await sendAdminLog(interaction.client, {
        action: 'Manual Add Points',
        executor: interaction.user.tag,
        target: `${targetUser.username} (${targetUser.id})`,
        details: `Awarded **${amount}** points.\n**Reason:** *${reason}*`,
        fields: [{ name: 'New Balance', value: `${userDoc.points} pts`, inline: true }],
        color: 0x2ECC71 // Green
      });

    } catch (error) {
      console.error('Error in /addpoints command:', error);
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
