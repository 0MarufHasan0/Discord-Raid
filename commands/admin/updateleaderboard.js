const { SlashCommandBuilder, EmbedBuilder, MessageFlags} = require('discord.js');
const checkAdmin = require('../../utils/checkAdmin');
const updateLeaderboard = require('../../utils/updateLeaderboard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('updateleaderboard')
    .setDescription('Force update the live leaderboard channel embed'),
  async execute(interaction) {
    try {
      const isAdmin = await checkAdmin(interaction);
      if (!isAdmin) return;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      await updateLeaderboard(interaction.client);

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setDescription('✅ Live Leaderboard successfully updated!');

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in /updateleaderboard command:', error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: '❌ An error occurred. Please try again.', flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ content: '❌ An error occurred. Please try again.', flags: MessageFlags.Ephemeral });
        }
      } catch (err) {
        // Silently catch
      }
    }
  }
};
