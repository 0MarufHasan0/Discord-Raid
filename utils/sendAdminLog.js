const { EmbedBuilder } = require('discord.js');
const config = require('../config');

/**
 * Sends a detailed audit log to the configured admin logs channel.
 * @param {import('discord.js').Client} client - The Discord Client instance.
 * @param {Object} options - Log configuration.
 * @param {string} options.action - The administrative action name.
 * @param {string} options.executor - Username or tag of the admin who did it.
 * @param {string} [options.target] - Target user username or ID.
 * @param {string} [options.details] - Description or key details of the action.
 * @param {Array<Object>} [options.fields] - Additional embed fields { name, value, inline }.
 * @param {number} [options.color] - Color of the embed card (hex).
 */
async function sendAdminLog(client, { action, executor, target, details, fields = [], color = 0x5865F2 }) {
  const logChannelId = process.env.ADMIN_LOG_CHANNEL_ID || config.adminLogChannelId;
  if (!logChannelId) return;

  try {
    const channel = await client.channels.fetch(logChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      console.warn(`[AdminLog] Log channel with ID ${logChannelId} not found or is not a text channel.`);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`🛡️ Audit Log: ${action}`)
      .addFields(
        { name: 'Admin / Executor', value: executor || 'Unknown Admin', inline: true },
        { name: 'Target', value: target || 'N/A', inline: true }
      )
      .setTimestamp();

    if (details) {
      embed.setDescription(details);
    }

    if (fields && fields.length > 0) {
      embed.addFields(fields);
    }

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error sending admin log embed:', error);
  }
}

module.exports = sendAdminLog;
