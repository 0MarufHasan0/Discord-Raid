const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../database/models/User');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mypoints')
    .setDescription('Check your points and raid statistics'),
  async execute(interaction) {
    try {
      // Find user
      let userDoc = await User.findOne({ discordId: interaction.user.id });
      if (!userDoc) {
        userDoc = new User({
          discordId: interaction.user.id,
          username: interaction.user.username,
          points: 0,
          raidsSubmitted: 0,
          raidsApproved: 0
        });
        await userDoc.save();
      }

      // Build embed
      const embed = new EmbedBuilder()
        .setTitle(`💰 Your Points — ${interaction.user.username}`)
        .setColor(0x00FF00) // Success green
        .addFields(
          { name: 'Total Points', value: String(userDoc.points), inline: true },
          { name: 'Raids Submitted', value: String(userDoc.raidsSubmitted), inline: true },
          { name: 'Raids Approved', value: String(userDoc.raidsApproved), inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

    } catch (error) {
      console.error('Error in /mypoints command:', error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: "❌ An error occurred. Please try again.", flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ content: "❌ An error occurred. Please try again.", flags: MessageFlags.Ephemeral });
        }
      } catch (err) {
        // Silently catch errors if interaction already finished/closed
      }
    }
  }
};
