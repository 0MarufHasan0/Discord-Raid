const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const checkAdmin = require('../../utils/checkAdmin');
const Raid = require('../../database/models/Raid');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('raidlist')
    .setDescription('List recently submitted raids')
    .addStringOption(option =>
      option.setName('status')
        .setDescription('Filter raids by status')
        .setRequired(false)
        .addChoices(
          { name: 'Pending', value: 'pending' },
          { name: 'Approved', value: 'approved' },
          { name: 'Rejected', value: 'rejected' }
        )),
  async execute(interaction) {
    try {
      // Check admin permissions
      const isAdmin = await checkAdmin(interaction);
      if (!isAdmin) return;

      const statusFilter = interaction.options.getString('status');

      // Build query filter
      const filter = {};
      if (statusFilter) {
        filter.status = statusFilter;
      }

      // Fetch up to 10 raids sorted by submittedAt desc
      const raids = await Raid.find(filter).sort({ submittedAt: -1 }).limit(10);

      const titleSuffix = statusFilter ? ` — ${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}` : '';
      const embed = new EmbedBuilder()
        .setTitle(`📋 Raid List${titleSuffix}`)
        .setColor(0x5865F2) // Discord Blurple
        .setTimestamp();

      if (raids.length === 0) {
        embed.setDescription("📭 কোনো raid পাওয়া যায়নি");
        return interaction.reply({ embeds: [embed] });
      }

      raids.forEach(raid => {
        const formattedDate = raid.submittedAt ? new Date(raid.submittedAt).toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' }) : 'Unknown';
        embed.addFields({
          name: `${raid.raidId} | ${raid.username}`,
          value: `🔗 **Link:** ${raid.link}\n🔴 **Status:** ${raid.status}\n📅 **Date:** ${formattedDate}`
        });
      });

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in /raidlist command:', error);
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
