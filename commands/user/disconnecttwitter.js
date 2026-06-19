const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../database/models/User');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('disconnecttwitter')
    .setDescription('Disconnect/unlink your Twitter/X account from the bot'),
  async execute(interaction) {
    try {
      // Find user
      const userDoc = await User.findOne({ discordId: interaction.user.id });

      if (!userDoc || !userDoc.twitter) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF0000)
              .setDescription("❌ You don't have a Twitter/X account connected to disconnect!")
          ],
          ephemeral: true
        });
      }

      const connectedHandle = userDoc.twitter;

      // Update database
      userDoc.twitter = null;
      await userDoc.save();

      const successEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Success Green
        .setTitle("🐦 Twitter Account Disconnected")
        .setDescription(`✅ Successfully disconnected **@${connectedHandle}** from your profile.`)
        .setTimestamp();

      return interaction.reply({ embeds: [successEmbed] });

    } catch (error) {
      console.error('Error in /disconnecttwitter command:', error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: "❌ An error occurred while disconnecting your Twitter account.", ephemeral: true });
        } else {
          await interaction.reply({ content: "❌ An error occurred while disconnecting your Twitter account.", ephemeral: true });
        }
      } catch (err) {
        // Silently catch errors if interaction already finished/closed
      }
    }
  }
};
