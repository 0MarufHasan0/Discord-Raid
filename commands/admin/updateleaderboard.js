const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
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

      await interaction.deferReply({ ephemeral: true });

      await updateLeaderboard(interaction.client);

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setDescription('✅ Live Leaderboard সফলভাবে আপডেট করা হয়েছে!');

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in /updateleaderboard command:', error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: '❌ একটা error হয়েছে। আবার চেষ্টা করো।', ephemeral: true });
        } else {
          await interaction.reply({ content: '❌ একটা error হয়েছে। আবার চেষ্টা করো।', ephemeral: true });
        }
      } catch (err) {
        // Silently catch
      }
    }
  }
};
