const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const checkAdmin = require('../../utils/checkAdmin');
const UserRoleExpiration = require('../../database/models/UserRoleExpiration');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('edituserwl')
    .setDescription('Edit or remove active whitelist role validity for a member or all members')
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('The whitelist role to modify')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('action')
        .setDescription('The action to perform')
        .setRequired(true)
        .addChoices(
          { name: 'Remove Role (All/Single)', value: 'remove' },
          { name: 'Reduce Validity (Days)', value: 'reduce_days' },
          { name: 'Extend Validity (Days)', value: 'add_days' },
          { name: 'Set Validity (Days from now)', value: 'set_days' }
        ))
    .addIntegerOption(option =>
      option.setName('days')
        .setDescription('Number of days (required for reduce, extend, or set)')
        .setRequired(false))
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The specific member to modify (optional - if omitted, applies to ALL members)')
        .setRequired(false)),
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      // Check admin permissions
      const isAdmin = await checkAdmin(interaction);
      if (!isAdmin) return;

      const role = interaction.options.getRole('role');
      const action = interaction.options.getString('action');
      const days = interaction.options.getInteger('days');
      const targetUser = interaction.options.getUser('user');

      if (action !== 'remove' && (days === null || days <= 0)) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ To change validity, you must specify 1 or more days.")]
        });
      }

      const guild = interaction.guild;
      
      // Build query to find active whitelist role expirations in database
      const query = {
        guildId: guild.id,
        roleId: role.id
      };
      if (targetUser) {
        query.userId = targetUser.id;
      }

      const activeRecords = await UserRoleExpiration.find(query);

      if (activeRecords.length === 0) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ No active whitelist found for this role${targetUser ? ` for user <@${targetUser.id}>` : ' in this server'}.`)]
        });
      }

      let successCount = 0;
      let failCount = 0;

      for (const record of activeRecords) {
        try {
          const member = await guild.members.fetch(record.userId).catch(() => null);
          
          if (action === 'remove') {
            if (member) {
              await member.roles.remove(role.id, "Admin manually removed whitelist.");
            }
            await UserRoleExpiration.deleteOne({ _id: record._id });
            successCount++;
          } else {
            let newExpiry = new Date(record.expiresAt);
            if (action === 'add_days') {
              newExpiry.setDate(newExpiry.getDate() + days);
            } else if (action === 'reduce_days') {
              newExpiry.setDate(newExpiry.getDate() - days);
            } else if (action === 'set_days') {
              newExpiry = new Date();
              newExpiry.setDate(newExpiry.getDate() + days);
            }

            // If the validity is reduced to past/now, remove the role immediately
            if (newExpiry <= new Date()) {
              if (member) {
                await member.roles.remove(role.id, "Whitelist expired due to admin reduction.");
              }
              await UserRoleExpiration.deleteOne({ _id: record._id });
            } else {
              record.expiresAt = newExpiry;
              await record.save();
            }
            successCount++;
          }
        } catch (err) {
          console.error(`Error processing edituserwl for user ${record.userId}:`, err);
          failCount++;
        }
      }

      let responseText = '';
      if (action === 'remove') {
        responseText = `✅ Successfully removed role <@&${role.id}> from **${successCount}** user(s) and cleared database tracking.`;
      } else {
        const actionWord = action === 'add_days' ? 'extended' : action === 'reduce_days' ? 'reduced' : 'set';
        responseText = `✅ Successfully ${actionWord} the validity of role <@&${role.id}> by **${days}** days for **${successCount}** user(s).`;
      }

      if (failCount > 0) {
        responseText += `\n⚠️ Failed to update validity for **${failCount}** user(s) (please check bot role permissions).`;
      }

      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0x00FF00).setDescription(responseText)]
      });

      // Send admin log
      const sendAdminLog = require('../../utils/sendAdminLog');
      await sendAdminLog(interaction.client, {
        action: 'User Whitelist Edited',
        executor: interaction.user.tag,
        target: targetUser ? `${targetUser.username} (${targetUser.id})` : 'All Members',
        details: `Modified active whitelist role validity.`,
        fields: [
          { name: 'Role', value: `<@&${role.id}>`, inline: true },
          { name: 'Action', value: action, inline: true },
          { name: 'Days Offset', value: days ? `${days} days` : 'N/A', inline: true },
          { name: 'Updated Users Count', value: `${successCount} successful, ${failCount} failed`, inline: false }
        ],
        color: action === 'remove' ? 0xE74C3C : 0x3498DB // Red for remove, blue for adjust
      });

    } catch (error) {
      console.error('Error in /edituserwl command:', error);
      try {
        await interaction.editReply({ content: "❌ An error occurred. Please try again." });
      } catch (err) {}
    }
  }
};
