const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const MarketItem = require('../../database/models/MarketItem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('marketplace')
    .setDescription('Show all active marketplace items'),
  async execute(interaction) {
    try {
      // Fetch active items
      const items = await MarketItem.find({ isActive: true });

      const embed = new EmbedBuilder()
        .setTitle("🏪 Marketplace")
        .setColor(0x5865F2) // Discord Blurple
        .setTimestamp();

      if (items.length === 0) {
        embed.setDescription("🏪 There are currently no items in the marketplace.");
        return interaction.reply({ embeds: [embed] });
      }

      items.forEach(item => {
        embed.addFields({
          name: item.name,
          value: `${item.description}\n💰 **Cost:** ${item.pointCost} points\n🎟️ **Slots:** ${item.claimedSlots}/${item.totalSlots}`
        });
      });

      embed.setFooter({ text: "Use the button below or /claimwl to claim an item" });

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('open_marketplace_claim_menu')
            .setLabel('Claim Whitelist')
            .setEmoji('🎟️')
            .setStyle(ButtonStyle.Success)
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
