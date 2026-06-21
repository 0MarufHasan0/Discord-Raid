const { EmbedBuilder } = require('discord.js');
const config = require('../config');

/**
 * Reusable utility to check if the interacting member has the admin role.
 * Replies ephemerally with a red embed if unauthorized.
 * 
 * @param {import('discord.js').ChatInputCommandInteraction} interaction 
 * @returns {Promise<boolean>} Resolves to true if admin, false otherwise
 */
async function checkAdmin(interaction) {
  const adminRoleIdString = config.adminRoleId || '';
  const adminRoleIds = adminRoleIdString.split(',').map(id => id.trim()).filter(Boolean);
  
  if (!interaction.member || !interaction.member.roles) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setDescription("❌ You do not have permission to use this command.");
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
    } catch (err) {}
    return false;
  }

  const hasRole = adminRoleIds.some(roleId => {
    if (Array.isArray(interaction.member.roles)) {
      return interaction.member.roles.includes(roleId);
    }
    if (interaction.member.roles.cache) {
      return interaction.member.roles.cache.has(roleId);
    }
    return false;
  });

  if (!hasRole) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000) // Red
      .setDescription("❌ You do not have permission to use this command.");
    
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
    } catch (err) {}
    return false;
  }
  
  return true;
}

module.exports = checkAdmin;
