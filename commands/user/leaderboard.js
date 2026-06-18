const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../database/models/User');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Display the top 10 users ranked by points'),
  async execute(interaction) {
    try {
      // Fetch top 10 users sorted by points descending
      const topUsers = await User.find({}).sort({ points: -1 }).limit(10);

      const embed = new EmbedBuilder()
        .setTitle("🏆 Leaderboard — Top Raiders")
        .setColor(0xFFD700) // Gold
        .setTimestamp();

      if (topUsers.length === 0) {
        embed.setDescription("📭 No users found on the leaderboard.");
        return interaction.reply({ embeds: [embed] });
      }

      const rankEmojis = ['🥇', '🥈', '🥉'];

      topUsers.forEach((user, index) => {
        const rank = index + 1;
        const emoji = rank <= 3 ? rankEmojis[index] : `#${rank}`;
        
        embed.addFields({
          name: `${emoji} Position ${rank}`,
          value: `${user.username} — ${user.points} points`
        });
      });

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in /leaderboard command:', error);
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
