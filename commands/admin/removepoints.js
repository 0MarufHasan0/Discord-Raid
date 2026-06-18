const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const checkAdmin = require('../../utils/checkAdmin');
const User = require('../../database/models/User');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removepoints')
    .setDescription('Remove points from a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to deduct points from')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('The number of points to deduct')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for removing points')
        .setRequired(false)),
  async execute(interaction) {
    try {
      // Check admin permissions
      const isAdmin = await checkAdmin(interaction);
      if (!isAdmin) return;

      const targetUser = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      const reason = interaction.options.getString('reason') || 'Admin কর্তৃক কর্তন';

      if (amount <= 0) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ points-এর পরিমাণ অবশ্যই ০-এর চেয়ে বেশি হতে হবে।")],
          ephemeral: true
        });
      }

      // Find user
      let userDoc = await User.findOne({ discordId: targetUser.id });
      if (!userDoc) {
        // Create user with 0 points if they don't exist
        userDoc = new User({
          discordId: targetUser.id,
          username: targetUser.username,
          points: 0
        });
        await userDoc.save();
      }

      const pointsBefore = userDoc.points;
      const newTotal = Math.max(0, pointsBefore - amount);
      const actualDeducted = pointsBefore - newTotal;

      userDoc.points = newTotal;
      userDoc.username = targetUser.username;
      await userDoc.save();

      // Attempt to DM the user
      const dmEmbed = new EmbedBuilder()
        .setColor(0xFFA500) // Warning Orange
        .setDescription(`⚠️ তোমার **${amount}** points কাটা হয়েছে\n**কারণ:** ${reason}\n**বাকি points:** ${newTotal}`)
        .setTimestamp();

      try {
        await targetUser.send({ embeds: [dmEmbed] });
      } catch (dmError) {
        console.log(`[DM Fail] Could not DM user ${targetUser.username} (${targetUser.id}). DMs might be closed.`);
      }

      // Reply to admin
      const replyEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Success green
        .setDescription(`✅ **${targetUser.username}** এর **${amount}** points কাটা হয়েছে। বাকি points: **${newTotal}**`);

      await interaction.reply({ embeds: [replyEmbed], ephemeral: true });

    } catch (error) {
      console.error('Error in /removepoints command:', error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: "❌ একটা error হয়েছে। আবার চেষ্টা করো।", ephemeral: true });
        } else {
          await interaction.reply({ content: "❌ একটা error হয়েছে। আবার চেষ্টা করো।", ephemeral: true });
        }
      } catch (err) {
        // Silently catch errors if interaction already finished/closed
      }
    }
  }
};
