const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const checkAdmin = require('../../utils/checkAdmin');
const MarketItem = require('../../database/models/MarketItem');
const updateMarketplace = require('../../utils/updateMarketplace');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removewlitem')
    .setDescription('Deactivate/remove an item from the marketplace')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Name of the item to remove')
        .setRequired(true))
    .addBooleanOption(option =>
      option.setName('delete_role')
        .setDescription('Also delete the associated Discord role from the server? (optional)')
        .setRequired(false)),
  async execute(interaction) {
    try {
      // Check admin permissions
      const isAdmin = await checkAdmin(interaction);
      if (!isAdmin) return;

      const name = interaction.options.getString('name').trim();
      const deleteRoleOpt = interaction.options.getBoolean('delete_role') || false;
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Find the item (case-insensitive)
      const item = await MarketItem.findOne({ name: { $regex: new RegExp(`^${escapedName}$`, 'i') } });
      if (!item) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ No item found with the name '${name}'.`)],
          ephemeral: true
        });
      }

      if (!item.isActive) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFFA500).setDescription(`⚠️ The item '${item.name}' is already inactive or removed from the marketplace.`)],
          ephemeral: true
        });
      }

      let roleDeleteInfo = '';
      if (deleteRoleOpt && item.roleId) {
        try {
          const role = interaction.guild.roles.cache.get(item.roleId) || await interaction.guild.roles.fetch(item.roleId).catch(() => null);
          if (role) {
            await role.delete(`Marketplace item '${item.name}' removed by ${interaction.user.tag}`);
            roleDeleteInfo = `\n🎭 **Associated Discord role ('${role.name}') has been deleted from the server.**`;
          } else {
            roleDeleteInfo = `\n⚠️ **Associated Discord role (ID: ${item.roleId}) was not found on the server.**`;
          }
        } catch (roleErr) {
          console.error(`❌ Failed to delete role ${item.roleId}:`, roleErr);
          roleDeleteInfo = `\n⚠️ **Failed to delete associated Discord role.** (Please check bot permissions and role hierarchy)`;
        }
      } else if (deleteRoleOpt && !item.roleId) {
        roleDeleteInfo = `\nℹ️ **No Discord role was associated with this item (this is a Whitelist Ticket item).**`;
      }

      // Deactivate item
      item.isActive = false;
      await item.save();

      // Update live marketplace channel
      updateMarketplace(interaction.client);

      const replyEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Success green
        .setDescription(`✅ '${item.name}' has been removed from the marketplace.${roleDeleteInfo}`);

      await interaction.reply({ embeds: [replyEmbed], ephemeral: true });

      // Send admin log
      const sendAdminLog = require('../../utils/sendAdminLog');
      await sendAdminLog(interaction.client, {
        action: 'Market Item Removed',
        executor: interaction.user.tag,
        target: item.name,
        details: `Deactivated and removed a marketplace item.`,
        fields: [
          { name: 'Role Deleted?', value: deleteRoleOpt ? 'Yes' : 'No', inline: true },
          { name: 'Point Cost', value: `${item.pointCost} pts`, inline: true }
        ],
        color: 0xE74C3C // Red
      });

    } catch (error) {
      console.error('Error in /removewlitem command:', error);
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
