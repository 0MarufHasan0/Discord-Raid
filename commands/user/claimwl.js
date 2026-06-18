const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const MarketItem = require('../../database/models/MarketItem');
const User = require('../../database/models/User');
const updateMarketplace = require('../../utils/updateMarketplace');
const updateLeaderboard = require('../../utils/updateLeaderboard');

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
      const escapedItemName = itemName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Find item (case-insensitive and must be active)
      const item = await MarketItem.findOne({ 
        name: { $regex: new RegExp(`^${escapedItemName}$`, 'i') },
        isActive: true 
      });

      if (!item) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ No item found with the name '${itemName}'`)],
          ephemeral: true
        });
      }

      // Check if item has expired
      if (item.expiresAt && new Date() > item.expiresAt) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ The item '${item.name}' has expired! You can no longer claim it.`)],
          ephemeral: true
        });
      }

      // Check if slots are available
      if (item.claimedSlots >= item.totalSlots) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ All slots for '${item.name}' have been claimed!`)],
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
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ You do not have enough points!\nRequired: **${item.pointCost}** | You have: **${userDoc.points}**`)],
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
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ All slots for '${item.name}' have been claimed!`)],
          ephemeral: true
        });
      }

      // Deduct points from user
      userDoc.points -= item.pointCost;
      await userDoc.save();

      // Update live marketplace channel
      updateMarketplace(interaction.client);

      // Update live leaderboard channel
      updateLeaderboard(interaction.client);

      // Reply success
      const remainingPoints = userDoc.points;
      const successEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Success green
        .setDescription(
          `✅ You have claimed '**${item.name}**'!\n` +
          `💰 **${item.pointCost}** points deducted\n` +
          `💳 Remaining points: **${remainingPoints}**\n\n` +
          `🎟️ **After claiming the whitelist, please open a ticket to submit proof/screenshot.**`
        )
        .setTimestamp();

      await interaction.reply({ embeds: [successEmbed], ephemeral: true });

    } catch (error) {
      console.error('Error in /claimwl command:', error);
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
