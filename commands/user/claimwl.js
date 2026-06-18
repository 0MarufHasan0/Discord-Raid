const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const MarketItem = require('../../database/models/MarketItem');
const User = require('../../database/models/User');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('claimwl')
    .setDescription('Claim an item from the marketplace')
    .addStringOption(option =>
      option.setName('item_name')
        .setDescription('Name of the item you want to claim')
        .setRequired(true)),
  async execute(interaction) {
    try {
      const itemName = interaction.options.getString('item_name').trim();

      // Find item (case-insensitive and must be active)
      const item = await MarketItem.findOne({ 
        name: { $regex: new RegExp(`^${itemName}$`, 'i') },
        isActive: true 
      });

      if (!item) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ '${itemName}' নামে কোনো item নেই`)],
          ephemeral: true
        });
      }

      // Check if slots are available
      if (item.claimedSlots >= item.totalSlots) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ '${item.name}' এর সব slots শেষ!`)],
          ephemeral: true
        });
      }

      // Find user
      let userDoc = await User.findOne({ discordId: interaction.user.id });
      if (!userDoc) {
        userDoc = new User({
          discordId: interaction.user.id,
          username: interaction.user.username,
          points: 0
        });
        await userDoc.save();
      }

      // Check points balance
      if (userDoc.points < item.pointCost) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ তোমার কাছে যথেষ্ট points নেই!\nদরকার: **${item.pointCost}** | তোমার কাছে: **${userDoc.points}**`)],
          ephemeral: true
        });
      }

      // Atomically increment claimedSlots to avoid race conditions
      const updatedItem = await MarketItem.findOneAndUpdate(
        { _id: item._id, claimedSlots: { $lt: item.totalSlots } },
        { $inc: { claimedSlots: 1 } },
        { new: true }
      );

      if (!updatedItem) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ '${item.name}' এর সব slots শেষ!`)],
          ephemeral: true
        });
      }

      // Deduct points from user
      userDoc.points -= item.pointCost;
      await userDoc.save();

      // Reply success
      const remainingPoints = userDoc.points;
      const successEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Success green
        .setDescription(
          `✅ তুমি '**${item.name}**' claim করেছো!\n` +
          `💰 **${item.pointCost}** points কাটা হয়েছে\n` +
          `💳 বাকি points: **${remainingPoints}**`
        )
        .setTimestamp();

      await interaction.reply({ embeds: [successEmbed], ephemeral: true });

    } catch (error) {
      console.error('Error in /claimwl command:', error);
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
