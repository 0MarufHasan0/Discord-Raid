const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
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
        embed.setDescription("🏪 Marketplace এ এখন কোনো item নেই");
        return interaction.reply({ embeds: [embed] });
      }

      items.forEach(item => {
        embed.addFields({
          name: item.name,
          value: `${item.description}\n💰 **Cost:** ${item.pointCost} points\n🎟️ **Slots:** ${item.claimedSlots}/${item.totalSlots}`
        });
      });

      embed.setFooter({ text: "/claimwl [item name] দিয়ে claim করো" });

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in /marketplace command:', error);
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
