const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const checkAdmin = require('../../utils/checkAdmin');
const MarketItem = require('../../database/models/MarketItem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addwlitem')
    .setDescription('Add a new item to the marketplace')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Name of the item/whitelist role')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Brief description of the item')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('point_cost')
        .setDescription('Points cost to claim this item')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('total_slots')
        .setDescription('Total number of slots available')
        .setRequired(true)),
  async execute(interaction) {
    try {
      // Check admin permissions
      const isAdmin = await checkAdmin(interaction);
      if (!isAdmin) return;

      const name = interaction.options.getString('name').trim();
      const description = interaction.options.getString('description').trim();
      const pointCost = interaction.options.getInteger('point_cost');
      const totalSlots = interaction.options.getInteger('total_slots');

      if (pointCost <= 0 || totalSlots <= 0) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ Cost এবং Slots অবশ্যই ০-এর চেয়ে বেশি হতে হবে।")],
          ephemeral: true
        });
      }

      // Check if item already exists (case-insensitive)
      const existingItem = await MarketItem.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
      if (existingItem) {
        // If it exists but is inactive, we can reactivate and update it
        if (!existingItem.isActive) {
          existingItem.description = description;
          existingItem.pointCost = pointCost;
          existingItem.totalSlots = totalSlots;
          existingItem.claimedSlots = 0; // reset claimed slots? Or keep them? Usually resetting is safer or keeping. Let's reset since it is re-added.
          existingItem.isActive = true;
          await existingItem.save();

          return interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0x00FF00) // Success green
              .setDescription(`✅ Inactive Marketplace item '${name}' পুনরায় active করা হয়েছে!\n💰 Cost: **${pointCost}** points\n🎟️ Slots: **${totalSlots}**`)
            ],
            ephemeral: true
          });
        }

        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ '${name}' নামে একটি active item ইতিমধ্যেই রয়েছে।`)],
          ephemeral: true
        });
      }

      // Create new MarketItem
      const newItem = new MarketItem({
        name,
        description,
        pointCost,
        totalSlots,
        claimedSlots: 0,
        isActive: true
      });
      await newItem.save();

      const replyEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Success green
        .setDescription(`✅ Marketplace এ '**${name}**' add হয়েছে!\n💰 Cost: **${pointCost}** points\n🎟️ Slots: **${totalSlots}**`);

      await interaction.reply({ embeds: [replyEmbed], ephemeral: true });

    } catch (error) {
      console.error('Error in /addwlitem command:', error);
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
