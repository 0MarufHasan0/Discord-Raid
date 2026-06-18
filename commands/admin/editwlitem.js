const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const checkAdmin = require('../../utils/checkAdmin');
const MarketItem = require('../../database/models/MarketItem');
const updateMarketplace = require('../../utils/updateMarketplace');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editwlitem')
    .setDescription('Edit an existing item in the marketplace')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('The name of the item you want to edit')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('new_name')
        .setDescription('New name for the item (optional)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('description')
        .setDescription('New description for the item (optional)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('point_cost')
        .setDescription('New point cost to claim this item (optional)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('total_slots')
        .setDescription('New total number of slots (optional)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('duration_days')
        .setDescription('Set new duration: number of days from now (optional)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('duration_hours')
        .setDescription('Set new duration: number of hours from now (optional)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('duration_minutes')
        .setDescription('Set new duration: number of minutes from now (optional)')
        .setRequired(false)),
  async execute(interaction) {
    try {
      // Check admin permissions
      const isAdmin = await checkAdmin(interaction);
      if (!isAdmin) return;

      const name = interaction.options.getString('name').trim();
      const newName = interaction.options.getString('new_name')?.trim();
      const description = interaction.options.getString('description')?.trim();
      const pointCost = interaction.options.getInteger('point_cost');
      const totalSlots = interaction.options.getInteger('total_slots');
      
      const durationDays = interaction.options.getInteger('duration_days') || 0;
      const durationHours = interaction.options.getInteger('duration_hours') || 0;
      const durationMinutes = interaction.options.getInteger('duration_minutes') || 0;

      // Find the item (case-insensitive and active)
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const item = await MarketItem.findOne({ 
        name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
        isActive: true
      });

      if (!item) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ '${name}' নামে কোনো active marketplace item পাওয়া যায়নি।`)],
          ephemeral: true
        });
      }

      // Validations and Updates
      if (newName) {
        // Check duplicate name
        const escapedNewName = newName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const duplicate = await MarketItem.findOne({ 
          name: { $regex: new RegExp(`^${escapedNewName}$`, 'i') },
          _id: { $ne: item._id }
        });
        if (duplicate && duplicate.isActive) {
          return interaction.reply({
            embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ '${newName}' নামে ইতিমধ্যেই আরেকটি active item রয়েছে।`)],
            ephemeral: true
          });
        }
        item.name = newName;
      }

      if (description) {
        item.description = description;
      }

      if (pointCost !== null && pointCost !== undefined) {
        if (pointCost <= 0) {
          return interaction.reply({
            embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ Point cost অবশ্যই ০-এর চেয়ে বেশি হতে হবে।")],
            ephemeral: true
          });
        }
        item.pointCost = pointCost;
      }

      if (totalSlots !== null && totalSlots !== undefined) {
        if (totalSlots <= 0) {
          return interaction.reply({
            embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ Slots অবশ্যই ০-এর চেয়ে বেশি হতে হবে।")],
            ephemeral: true
          });
        }
        if (totalSlots < item.claimedSlots) {
          return interaction.reply({
            embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ Total slots ইতিমধ্যে ক্লেইম হওয়া slots (${item.claimedSlots}) এর চেয়ে কম হতে পারে না।`)],
            ephemeral: true
          });
        }
        item.totalSlots = totalSlots;
      }

      // Handle duration/expiration updates
      const durationMs = (durationDays * 24 * 60 * 60 * 1000) +
                       (durationHours * 60 * 60 * 1000) +
                       (durationMinutes * 60 * 1000);
      
      if (durationMs > 0) {
        item.expiresAt = new Date(Date.now() + durationMs);
      } else if (
        interaction.options.getInteger('duration_days') !== null ||
        interaction.options.getInteger('duration_hours') !== null ||
        interaction.options.getInteger('duration_minutes') !== null
      ) {
        // If explicitly set but equals 0, we can clear the expiration
        item.expiresAt = undefined;
      }

      await item.save();

      // Trigger live update
      updateMarketplace(interaction.client);

      // Reply
      let successMsg = `✅ Marketplace item '**${name}**' সফলভাবে আপডেট করা হয়েছে!\n`;
      successMsg += `🏷️ **Name:** ${item.name}\n`;
      successMsg += `📝 **Description:** ${item.description}\n`;
      successMsg += `💰 **Cost:** **${item.pointCost}** points\n`;
      successMsg += `🎟️ **Slots:** **${item.claimedSlots}/${item.totalSlots}**`;
      if (item.expiresAt) {
        const unixTimestamp = Math.floor(item.expiresAt.getTime() / 1000);
        successMsg += `\n⏰ **Expires:** <t:${unixTimestamp}:F> (<t:${unixTimestamp}:R>)`;
      } else {
        successMsg += `\n⏰ **Expires:** Never`;
      }

      const replyEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setDescription(successMsg)
        .setTimestamp();

      await interaction.reply({ embeds: [replyEmbed], ephemeral: true });

    } catch (error) {
      console.error('Error in /editwlitem command:', error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: "❌ একটা error হয়েছে। আবার চেষ্টা করো।", ephemeral: true });
        } else {
          await interaction.reply({ content: "❌ একটা error হয়েছে। আবার চেষ্টা করো।", ephemeral: true });
        }
      } catch (err) {
        // Silently catch errors
      }
    }
  }
};
