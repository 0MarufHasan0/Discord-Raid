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

      let roleDeleteInfo = '';
      if (deleteRoleOpt && item.roleId) {
        try {
          const role = interaction.guild.roles.cache.get(item.roleId) || await interaction.guild.roles.fetch(item.roleId).catch(() => null);
          if (role) {
            await role.delete(`Marketplace item '${item.name}' removed by ${interaction.user.tag}`);
            roleDeleteInfo = `\n🎭 **Associated Discord role ('${role.name}') server থেকে delete করা হয়েছে।**`;
          } else {
            roleDeleteInfo = `\n⚠️ **Associated Discord role (ID: ${item.roleId}) server-এ খুঁজে পাওয়া যায়নি।**`;
          }
        } catch (roleErr) {
          console.error(`❌ Failed to delete role ${item.roleId}:`, roleErr);
          roleDeleteInfo = `\n⚠️ **Associated Discord role delete করতে ব্যর্থ হয়েছে।** (বটের পারমিশন অথবা রোল পজিশন চেক করুন)`;
        }
      } else if (deleteRoleOpt && !item.roleId) {
        roleDeleteInfo = `\nℹ️ **এই item-টির সাথে কোনো Discord role যুক্ত ছিল না (এটি একটি Whitelist ticket item)।**`;
      }

      // Deactivate item
      item.isActive = false;
      await item.save();

      // Update live marketplace channel
      updateMarketplace(interaction.client);

      const replyEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Success green
        .setDescription(`✅ '${item.name}' marketplace থেকে remove করা হয়েছে।${roleDeleteInfo}`);

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
