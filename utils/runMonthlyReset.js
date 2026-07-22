const User = require('../database/models/User');
const Raid = require('../database/models/Raid');
const UserRoleExpiration = require('../database/models/UserRoleExpiration');
const { EmbedBuilder } = require('discord.js');

async function runMonthlyReset(client) {
  try {
    console.log('[Monthly Reset] Starting monthly database and role reset...');

    // 1. Fetch all active whitelists and remove roles from users on Discord
    const expirations = await UserRoleExpiration.find({});
    console.log(`[Monthly Reset] Found ${expirations.length} active whitelist roles to remove.`);

    for (const record of expirations) {
      try {
        const guild = await client.guilds.fetch(record.guildId).catch(() => null);
        if (guild) {
          const member = await guild.members.fetch(record.userId).catch(() => null);
          if (member) {
            // Check if user has the role
            const hasRole = member.roles.cache.has(record.roleId);
            if (hasRole) {
              await member.roles.remove(record.roleId, "Monthly server reset.").catch(err => {
                console.error(`[Monthly Reset] Failed to remove role ${record.roleId} from user ${record.userId}:`, err.message);
              });
            }

            // Send DM notification to user
            const dmEmbed = new EmbedBuilder()
              .setColor(0xFF0000)
              .setTitle("⏳ Whitelist Reset")
              .setDescription(`The monthly server reset has occurred in **${guild.name}**. Your whitelist role for **${record.itemName}** has been reset and removed from your account.`)
              .setTimestamp();
            await member.send({ embeds: [dmEmbed] }).catch(() => {});
          }
        }
      } catch (err) {
        console.error(`[Monthly Reset] Error processing record ${record._id}:`, err.message);
      }
    }

    // 2. Delete all records from UserRoleExpiration
    await UserRoleExpiration.deleteMany({});
    console.log('[Monthly Reset] Cleared all UserRoleExpiration records.');

    // Delete all marketplace items so the shop starts completely empty
    const MarketItem = require('../database/models/MarketItem');
    await MarketItem.deleteMany({});
    console.log('[Monthly Reset] Cleared all marketplace items (empty shop).');


    // 3. Delete all records from Raid
    await Raid.deleteMany({});
    console.log('[Monthly Reset] Cleared all Raid submission records.');

    // 4. Reset all user points and stats to 0
    await User.updateMany({}, {
      $set: {
        points: 0,
        raidsSubmitted: 0,
        raidsApproved: 0
      }
    });
    console.log('[Monthly Reset] Reset all user points and stats to 0.');

    // 5. Update Leaderboard embed
    try {
      const updateLeaderboard = require('./updateLeaderboard');
      await updateLeaderboard(client);
      console.log('[Monthly Reset] Leaderboard successfully updated.');
    } catch (lbErr) {
      console.error('[Monthly Reset] Failed to update leaderboard:', lbErr.message);
    }

    console.log('[Monthly Reset] Monthly reset completed successfully.');
  } catch (error) {
    console.error('[Monthly Reset] Error during monthly reset:', error);
  }
}

module.exports = runMonthlyReset;
