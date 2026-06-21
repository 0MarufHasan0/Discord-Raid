const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const MarketItem = require('../../database/models/MarketItem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('marketplace')
    .setDescription('Show all active marketplace items'),
  async execute(interaction) {
    try {
      // Fetch active items sorted by creation date (first listed first)
      const items = await MarketItem.find({ isActive: true }).sort({ createdAt: 1 });

      // Sort items: roles on top, whitelists below
      items.sort((a, b) => {
        const aIsRole = typeof a.roleId === 'string' && a.roleId.trim() !== '';
        const bIsRole = typeof b.roleId === 'string' && b.roleId.trim() !== '';
        if (aIsRole && !bIsRole) return -1;
        if (!aIsRole && bIsRole) return 1;
        return 0; // maintain relative creation-based order
      });

      const embed = new EmbedBuilder()
        .setTitle("🏪 Marketplace")
        .setColor(0x5865F2) // Discord Blurple
        .setTimestamp();

      if (items.length === 0) {
        embed.setDescription("🏪 There are currently no items in the marketplace.");
        return interaction.reply({ embeds: [embed] });
      }

      items.forEach(item => {
        let val = `📝 **Description:** ${item.description}\n`;
        val += `💰 **Cost:** \`${item.pointCost}\` points\n`;
        
        const availableSlots = Math.max(0, item.totalSlots - item.claimedSlots);
        const slotsText = availableSlots > 0 ? `\`${availableSlots}\` left` : `**SOLD OUT**`;
        val += `🎟️ **Slots:** ${item.claimedSlots}/${item.totalSlots} (${slotsText})\n`;
        
        if (item.roleId) {
          val += `🎭 **Role Reward:** <@&${item.roleId}>\n`;
          let durationStr = '30 days';
          if (item.claimDurationMs) {
            const totalMinutes = Math.floor(item.claimDurationMs / (60 * 1000));
            const d = Math.floor(totalMinutes / (24 * 60));
            const h = Math.floor((totalMinutes % (24 * 60)) / 60);
            const m = totalMinutes % 60;
            let parts = [];
            if (d > 0) parts.push(`${d} days`);
            if (h > 0) parts.push(`${h} hours`);
            if (m > 0) parts.push(`${m} minutes`);
            if (parts.length > 0) durationStr = parts.join(' ');
          } else if (item.claimDurationDays) {
            durationStr = `${item.claimDurationDays} days`;
          }
          val += `⏳ **Duration:** \`${durationStr}\`\n`;
        } else {
          val += `🎟️ **Type:** Whitelist Ticket (Opens private support channel)\n`;
        }

        if (item.expiresAt) {
          const unixTimestamp = Math.floor(item.expiresAt.getTime() / 1000);
          val += `⏰ **Ends:** <t:${unixTimestamp}:F> (<t:${unixTimestamp}:R>)\n`;
        }
        
        embed.addFields({
          name: `🏷️ ${item.name}`,
          value: val
        });
      });

      embed.setFooter({ text: "Click 'Claim Whitelist' or 'Claim Role' below to claim an item" });

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('open_marketplace_claim_menu_wl')
            .setLabel('Claim Whitelist')
            .setEmoji('🎟️')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('open_marketplace_claim_menu_role')
            .setLabel('Claim Role')
            .setEmoji('🎭')
            .setStyle(ButtonStyle.Primary)
        );

      await interaction.reply({ embeds: [embed], components: [row] });

    } catch (error) {
      console.error('Error in /marketplace command:', error);
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
