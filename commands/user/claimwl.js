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
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ '${itemName}' নামে কোনো item নেই`)],
          ephemeral: true
        });
      }

      // Check if item has expired
      if (item.expiresAt && new Date() > item.expiresAt) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ '${item.name}' আইটেমটির মেয়াদ শেষ হয়ে গেছে! তুমি আর এটি ক্লেইম করতে পারবে না।`)],
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

      // Update live marketplace channel
      updateMarketplace(interaction.client);

      // Update live leaderboard channel
      updateLeaderboard(interaction.client);

      // Reply success
      const remainingPoints = userDoc.points;
      const successEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Success green
        .setDescription(
          `✅ তুমি '**${item.name}**' claim করেছো!\n` +
          `💰 **${item.pointCost}** points কাটা হয়েছে\n` +
          `💳 বাকি points: **${remainingPoints}**\n\n` +
          `🎟️ **Whitelist-টি ক্লেইম করার পর, অনুগ্রহ করে একটি ticket ওপেন করে প্রুফ/স্ক্রিনশট জমা দাও।**`
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
