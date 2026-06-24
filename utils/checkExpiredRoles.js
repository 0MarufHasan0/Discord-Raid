const { EmbedBuilder } = require('discord.js');
const UserRoleExpiration = require('../database/models/UserRoleExpiration');

async function checkExpiredRoles(client) {
  try {
    const now = new Date();
    const expired = await UserRoleExpiration.find({ expiresAt: { $lte: now } });
    if (expired.length === 0) return;

    console.log(`[Expiration Check] Found ${expired.length} expired user whitelist roles.`);

    for (const record of expired) {
      let shouldDeleteRecord = false;
      try {
        const guild = await client.guilds.fetch(record.guildId).catch(() => null);
        if (!guild) {
          // Guild no longer exists or bot left, safe to clean up database
          shouldDeleteRecord = true;
        } else {
          const member = await guild.members.fetch(record.userId).catch(() => null);
          if (!member) {
            // Member left the guild, safe to clean up database
            shouldDeleteRecord = true;
          } else {
            // Check if role still exists in guild
            const roleExists = guild.roles.cache.has(record.roleId) || await guild.roles.fetch(record.roleId).catch(() => null);
            if (!roleExists) {
              // Role has been deleted from the guild, safe to clean up database
              shouldDeleteRecord = true;
            } else if (!member.roles.cache.has(record.roleId)) {
              // Member doesn't even have this role anymore (manually removed or never added)
              shouldDeleteRecord = true;
            } else {
              // Member has the role, let's remove it
              try {
                await member.roles.remove(record.roleId, "Whitelist duration expired.");
                console.log(`[Expiration Check] Removed role ${record.roleId} from user ${member.user.tag} in guild ${guild.name}`);
                shouldDeleteRecord = true;

                // Try to DM user
                const dmEmbed = new EmbedBuilder()
                  .setColor(0xFF0000)
                  .setTitle("⏳ Whitelist Expired")
                  .setDescription(`Your whitelist role for **${record.itemName}** has expired in **${guild.name}** and has been removed.`)
                  .setTimestamp();
                await member.send({ embeds: [dmEmbed] }).catch(() => {});
              } catch (removeErr) {
                console.error(`[Expiration Check] Failed to remove role ${record.roleId} from user ${record.userId}:`, removeErr.message);
                
                // If it is a Discord permission error (e.g. role hierarchy or missing permissions),
                // we should delete the record to avoid infinite console spam on every cron cycle.
                // Otherwise, we keep the record to retry next time (e.g. rate limit, Discord server down).
                if (removeErr.code === 50013 || removeErr.status === 403) {
                  console.warn(`[Expiration Check] Permanent permission error. Deleting database record anyway.`);
                  shouldDeleteRecord = true;
                } else {
                  console.log(`[Expiration Check] Temporary error. Keeping database record for retry on next run.`);
                  shouldDeleteRecord = false;
                }
              }
            }
          }
        }
      } catch (err) {
        console.error(`[Expiration Check] Error processing record ${record._id}:`, err.message);
      }

      if (shouldDeleteRecord) {
        await UserRoleExpiration.deleteOne({ _id: record._id }).catch(err => {
          console.error(`[Expiration Check] Failed to delete record ${record._id} from database:`, err.message);
        });
      }
    }
  } catch (error) {
    console.error('[Expiration Check] Error checking expired roles:', error);
  }
}

module.exports = checkExpiredRoles;
