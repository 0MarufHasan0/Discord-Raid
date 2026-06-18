const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const checkAdmin = require('../../utils/checkAdmin');
const MarketItem = require('../../database/models/MarketItem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removewlitem')
    .setDescription('Deactivate/remove an item from the marketplace')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Name of the item to remove')
        .setRequired(true)),
  async execute(interaction) {
    try {
      // Check admin permissions
      const isAdmin = await checkAdmin(interaction);
      if (!isAdmin) return;

      const name = interaction.options.getString('name').trim();
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Find the item (case-insensitive)
      const item = await MarketItem.findOne({ name: { $regex: new RegExp(`^${escapedName}$`, 'i') } });
      if (!item) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ '${name}' নামে কোনো item নেই`)],
          ephemeral: true
        });
      }

      if (!item.isActive) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFFA500).setDescription(`⚠️ '${item.name}' item-টি ইতিমধ্যেই marketplace থেকে removed/inactive অবস্থায় আছে`)],
          ephemeral: true
        });
      }

      // Deactivate item
      item.isActive = false;
      await item.save();

      const replyEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Success green
        .setDescription(`✅ '${item.name}' marketplace থেকে remove করা হয়েছে`);

      await interaction.reply({ embeds: [replyEmbed], ephemeral: true });

    } catch (error) {
      console.error('Error in /removewlitem command:', error);
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
