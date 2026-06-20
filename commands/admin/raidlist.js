const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const checkAdmin = require('../../utils/checkAdmin');
const Raid = require('../../database/models/Raid');
const User = require('../../database/models/User');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('raidlist')
    .setDescription('List recently submitted raids with detailed filters')
    .addStringOption(option =>
      option.setName('status')
        .setDescription('Filter raids by status')
        .setRequired(false)
        .addChoices(
          { name: 'Pending', value: 'pending' },
          { name: 'Approved', value: 'approved' },
          { name: 'Rejected', value: 'rejected' }
        ))
    .addStringOption(option =>
      option.setName('date')
        .setDescription('Filter by date (YYYY-MM-DD format, e.g. 2026-06-19)')
        .setRequired(false)),
  async execute(interaction) {
    try {
      // Check admin permissions
      const isAdmin = await checkAdmin(interaction);
      if (!isAdmin) return;

      await interaction.deferReply({ ephemeral: true });

      const statusFilter = interaction.options.getString('status');
      const dateStr = interaction.options.getString('date');

      // Build query filter
      const filter = {};
      if (statusFilter) {
        filter.status = statusFilter;
      }

      if (dateStr) {
        const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) {
          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription("❌ Invalid date format! Please use `YYYY-MM-DD` format (e.g. `2026-06-19`).")
            ]
          });
        }
        const [_, year, month, day] = match;
        
        // Dhaka is UTC+6, so to query a full Dhaka day:
        // Dhaka 00:00:00 is UTC 18:00:00 of the previous day
        // Dhaka 23:59:59 is UTC 17:59:59 of the current day
        const startDhaka = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0));
        startDhaka.setUTCHours(startDhaka.getUTCHours() - 6);
        
        const endDhaka = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 23, 59, 59, 999));
        endDhaka.setUTCHours(endDhaka.getUTCHours() - 6);

        filter.submittedAt = {
          $gte: startDhaka,
          $lte: endDhaka
        };
      }

      // Count total matching documents
      const totalCount = await Raid.countDocuments(filter);

      // Fetch up to 25 raids sorted by submittedAt desc
      const raids = await Raid.find(filter).sort({ submittedAt: -1 }).limit(25);

      const titleSuffix = statusFilter ? ` — ${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}` : '';
      const embed = new EmbedBuilder()
        .setTitle(`📋 Raid List${titleSuffix}`)
        .setColor(0x5865F2) // Discord Blurple
        .setTimestamp();

      let description = '';
      if (dateStr) {
        description += `📅 **Date Filter:** \`${dateStr}\` (Dhaka Timezone)\n`;
      }
      description += `📊 **Total Matching Raids:** **${totalCount}**\n`;
      if (raids.length > 0) {
        description += `📝 Showing newest **${raids.length}** raids:\n`;
      }
      embed.setDescription(description);

      if (raids.length === 0) {
        embed.setDescription((description + "\n📭 No raids found.").trim());
        return interaction.editReply({ embeds: [embed] });
      }

      // Fetch user docs to get Twitter handles
      const userIds = raids.map(r => r.userId);
      const users = await User.find({ discordId: { $in: userIds } });
      const userMap = new Map(users.map(u => [u.discordId, u]));

      raids.forEach(raid => {
        const formattedDate = raid.submittedAt ? new Date(raid.submittedAt).toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }) : 'Unknown';
        const userDoc = userMap.get(raid.userId);
        const twitterHandle = userDoc && userDoc.twitter ? `@${userDoc.twitter}` : 'N/A';

        let statusEmoji = '🟡';
        if (raid.status === 'approved') statusEmoji = '🟢';
        if (raid.status === 'rejected') statusEmoji = '🔴';

        embed.addFields({
          name: `🆔 Raid: ${raid.raidId}`,
          value: `👤 **Discord:** <@${raid.userId}> (${raid.username})\n` +
                 `🐦 **Twitter:** \`${twitterHandle}\`\n` +
                 `🔗 **Link:** [View Submission](${raid.link})\n` +
                 `${statusEmoji} **Status:** ${raid.status}\n` +
                 `📅 **Date:** ${formattedDate}\n` +
                 `❌ **Remove ID:** \`${raid.raidId}\` (Use \`/rejectraid raid_id:${raid.raidId}\` to reject & deduct ${(raid && typeof raid.points === 'number') ? raid.points : 1} points)`
        });
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in /raidlist command:', error);
      try {
        await interaction.editReply({ content: "❌ An error occurred. Please try again." });
      } catch (err) {
        // Silently catch errors if interaction already finished/closed
      }
    }
  }
};
