const { EmbedBuilder } = require('discord.js');

/**
 * Logs user activity to a specific Discord channel.
 * @param {Client} client Discord client instance
 * @param {User} user Discord user object who performed the action
 * @param {string} actionType Type of action performed (e.g. Button Click, Link Submission)
 * @param {string} details Description/details of the action
 * @param {string} [channelId] Optional channel ID where action occurred
 */
async function logUserActivity(client, user, actionType, details, channelId) {
  try {
    const logChannelId = '1519242571925291110';
    const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
    if (!logChannel) {
      console.warn(`[Activity Log] Log channel ${logChannelId} not found.`);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x00D1B2) // Beautiful Turquoise
      .setAuthor({
        name: `${user.tag}`,
        iconURL: user.displayAvatarURL({ dynamic: true })
      })
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setTitle("🤖 Bot User Activity")
      .addFields(
        { name: "👤 User Mention", value: `<@${user.id}>`, inline: true },
        { name: "🏷️ Username / Tag", value: `\`${user.tag}\``, inline: true },
        { name: "📝 Display Name", value: `\`${user.globalName || user.username}\``, inline: true },
        { name: "⚙️ Action Type", value: `\`${actionType}\``, inline: false },
        { name: "📄 Details", value: details || "No details provided", inline: false }
      )
      .setTimestamp();
      
    if (channelId) {
      embed.addFields({ name: "📍 Channel Location", value: `<#${channelId}>`, inline: true });
    }

    await logChannel.send({ embeds: [embed] }).catch(err => {
      console.error('[Activity Log] Error sending to log channel:', err);
    });
  } catch (error) {
    console.error('[Activity Log] Error logging user activity:', error);
  }
}

module.exports = logUserActivity;
