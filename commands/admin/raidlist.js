const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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

      // Fetch up to 100 raids sorted by submittedAt desc
      const raids = await Raid.find(filter).sort({ submittedAt: -1 }).limit(100);

      const titleSuffix = statusFilter ? ` — ${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}` : '';

      if (raids.length === 0) {
        const emptyEmbed = new EmbedBuilder()
          .setTitle(`📋 Raid List${titleSuffix}`)
          .setDescription("📭 No raids found matching the filters.")
          .setColor(0x5865F2)
          .setTimestamp();
        return interaction.editReply({ embeds: [emptyEmbed] });
      }

      // Fetch user docs to get Twitter handles
      const userIds = raids.map(r => r.userId);
      const users = await User.find({ discordId: { $in: userIds } });
      const userMap = new Map(users.map(u => [u.discordId, u]));

      // Pagination setup
      const pageSize = 5;
      const totalPages = Math.ceil(raids.length / pageSize);
      let currentPage = 0;

      // Defensive Date Formatter
      const formatDhakaDate = (date) => {
        if (!date) return 'Unknown';
        try {
          return new Date(date).toLocaleString('en-US', { timeZone: 'Asia/Dhaka' });
        } catch (tzError) {
          return new Date(date).toLocaleString('en-US');
        }
      };

      // Function to build embed for a specific page
      const buildPageEmbed = (pageIndex) => {
        const start = pageIndex * pageSize;
        const pageRaids = raids.slice(start, start + pageSize);

        // Determine embed color dynamically based on filter
        let embedColor = 0x5865F2; // Default blurple
        if (statusFilter === 'pending') embedColor = 0xF1C40F; // Yellow
        else if (statusFilter === 'approved') embedColor = 0x2ECC71; // Green
        else if (statusFilter === 'rejected') embedColor = 0xE74C3C; // Red

        const embed = new EmbedBuilder()
          .setTitle(`📋 Raid List${titleSuffix}`)
          .setColor(embedColor)
          .setTimestamp();

        let description = '';
        if (dateStr) {
          description += `📅 **Date Filter:** \`${dateStr}\` (Dhaka Timezone)\n`;
        }
        description += `📊 **Total Matching Raids:** **${totalCount}**\n`;
        description += `📝 Showing page **${pageIndex + 1}** of **${totalPages}** (newest **${raids.length}** loaded):\n`;
        description += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

        pageRaids.forEach((raid, index) => {
          const globalIndex = start + index + 1;
          const formattedDate = formatDhakaDate(raid.submittedAt);
          const userDoc = userMap.get(raid.userId);
          const twitterHandle = userDoc && userDoc.twitter ? `@${userDoc.twitter}` : 'N/A';

          let statusEmoji = '🟡';
          let statusText = 'Pending';
          if (raid.status === 'approved') {
            statusEmoji = '🟢';
            statusText = 'Approved';
          } else if (raid.status === 'rejected') {
            statusEmoji = '🔴';
            statusText = 'Rejected';
          }

          let actionText = '';
          if (raid.status === 'pending') {
            actionText = `👍 **Approve:** \`/approveraid raid_id:${raid.raidId}\`\n❌ **Reject:** \`/rejectraid raid_id:${raid.raidId} reason:\``;
          } else if (raid.status === 'approved') {
            actionText = `✅ **Approved by:** \`${raid.approvedBy || 'System'}\`\n❌ **Reject & Deduct:** \`/rejectraid raid_id:${raid.raidId} reason:\``;
          } else if (raid.status === 'rejected') {
            actionText = `🚫 **Rejected Reason:** \`${raid.rejectedReason || 'No reason specified'}\`\n👍 **Approve & Reward:** \`/approveraid raid_id:${raid.raidId}\``;
          }

          description += `**#${globalIndex}** — **Raid ID:** \`${raid.raidId}\` | ${statusEmoji} **${statusText}**\n` +
                         `👤 **User:** <@${raid.userId}> (${raid.username}) | 🐦 **Twitter:** \`${twitterHandle}\`\n` +
                         `🔗 **Link:** [View Submission](${raid.link})\n` +
                         `📅 **Submitted:** \`${formattedDate}\` | 💰 \`${raid.points || 1} pts\`\n` +
                         `${actionText}\n` +
                         `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        });

        embed.setDescription(description.trim());
        return embed;
      };

      // Function to generate action buttons
      const getButtons = (pageIndex, totalPages) => {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('raidlist_prev')
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(pageIndex === 0),
          new ButtonBuilder()
            .setCustomId('raidlist_page')
            .setLabel(`Page ${pageIndex + 1} of ${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('raidlist_next')
            .setEmoji('▶️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(pageIndex === totalPages - 1)
        );
      };

      const response = await interaction.editReply({
        embeds: [buildPageEmbed(currentPage)],
        components: totalPages > 1 ? [getButtons(currentPage, totalPages)] : []
      });

      if (totalPages > 1) {
        // Collect button interactions for 2 minutes
        const collector = response.createMessageComponentCollector({
          time: 120000
        });

        collector.on('collect', async i => {
          if (i.user.id !== interaction.user.id) {
            return i.reply({ content: '❌ You cannot interact with this menu.', flags: MessageFlags.Ephemeral });
          }

          if (i.customId === 'raidlist_prev') {
            currentPage = Math.max(0, currentPage - 1);
          } else if (i.customId === 'raidlist_next') {
            currentPage = Math.min(totalPages - 1, currentPage + 1);
          }

          await i.update({
            embeds: [buildPageEmbed(currentPage)],
            components: [getButtons(currentPage, totalPages)]
          });
        });

        collector.on('end', () => {
          // Disable all buttons after timeout
          const disabledRow = new ActionRowBuilder().addComponents(
            getButtons(currentPage, totalPages).components.map(button => 
              ButtonBuilder.from(button).setDisabled(true)
            )
          );
          interaction.editReply({ components: [disabledRow] }).catch(() => {});
        });
      }

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
