const { EmbedBuilder } = require('discord.js');
const UserRoleExpiration = require('../database/models/UserRoleExpiration');

async function checkExpiredRoles(client) {
  try {
    const now = new Date();
    const expired = await UserRoleExpiration.find({ expiresAt: { $lte: now } });
    if (expired.length === 0) return;

    console.log(`[Expiration Check] Found ${expired.length} expired user whitelist roles.`);

    for (const record of expired) {
      try {
        const guild = await client.guilds.fetch(record.guildId).catch(() => null);
        if (guild) {
          const member = await guild.members.fetch(record.userId).catch(() => null);
          if (member) {
            if (member.roles.cache.has(record.roleId)) {
              await member.roles.remove(record.roleId, "Whitelist duration expired.");
              console.log(`[Expiration Check] Removed role ${record.roleId} from user ${member.user.tag} in guild ${guild.name}`);
              
              /*
              // Try to DM user
              const dmEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle("⏳ Whitelist Expired")
                .setDescription(`Your whitelist role for **${record.itemName}** has expired in **${guild.name}** and has been removed.`)
                .setTimestamp();
              await member.send({ embeds: [dmEmbed] }).catch(() => {});
              */
            }
          }
        }
      } catch (err) {
        console.error(`[Expiration Check] Error removing role for record ${record._id}:`, err.message);
      }
      // Delete the record from database
      await UserRoleExpiration.deleteOne({ _id: record._id });
    }
  } catch (error) {
    console.error('[Expiration Check] Error checking expired roles:', error);
  }
}

module.exports = checkExpiredRoles;
