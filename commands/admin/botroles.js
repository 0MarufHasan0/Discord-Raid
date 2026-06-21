const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const checkAdmin = require('../../utils/checkAdmin');
const BotCreatedRole = require('../../database/models/BotCreatedRole');
const MarketItem = require('../../database/models/MarketItem');
const updateMarketplace = require('../../utils/updateMarketplace');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botroles')
    .setDescription('Manage Discord roles automatically created by the bot')
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all existing roles created by the bot'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete a bot-created role from the server')
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('The bot-created role to delete')
            .setRequired(true))),
  async execute(interaction) {
    try {
      // Check admin permissions
      const isAdmin = await checkAdmin(interaction);
      if (!isAdmin) return;

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'list') {
        await interaction.deferReply({ ephemeral: true });

        // Retrieve bot created roles from database
        const dbRoles = await BotCreatedRole.find({}).sort({ createdAt: -1 });

        if (dbRoles.length === 0) {
          return interaction.editReply({
            embeds: [new EmbedBuilder().setColor(0xFFA500).setDescription("ℹ️ No bot-created roles were found in the database.")]
          });
        }

        const embed = new EmbedBuilder()
          .setTitle("🎭 Bot-Created Roles")
          .setColor(0x5865F2)
          .setTimestamp();

        let desc = "Below is the list of roles automatically created by the bot:\n\n";
        let count = 0;

        for (const dbRole of dbRoles) {
          const roleExists = interaction.guild.roles.cache.has(dbRole.roleId);
          if (!roleExists) {
            // Clean up deleted role from DB silently
            await BotCreatedRole.deleteOne({ _id: dbRole._id });
            continue;
          }

          count++;
          const unixTimestamp = Math.floor(dbRole.createdAt.getTime() / 1000);
          desc += `${count}. **${dbRole.roleName}**\n`;
          desc += `   • **ID:** \`${dbRole.roleId}\`\n`;
          desc += `   • **Role:** <@&${dbRole.roleId}>\n`;
          if (dbRole.itemName) {
            desc += `   • **Item:** \`${dbRole.itemName}\`\n`;
          }
          desc += `   • **Created:** <t:${unixTimestamp}:F>\n\n`;
        }

        if (count === 0) {
          embed.setDescription("ℹ️ No bot-created roles currently exist in the server.");
        } else {
          embed.setDescription(desc);
        }

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === 'delete') {
        const role = interaction.options.getRole('role');

        // Check if role is in our tracked list of bot-created roles
        const dbRole = await BotCreatedRole.findOne({ roleId: role.id });
        if (!dbRole) {
          return interaction.reply({
            embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ This role is not in the bot-created roles tracking list! You can only delete bot-created roles with this command.")],
            ephemeral: true
          });
        }

        await interaction.deferReply({ ephemeral: true });

        // Delete from Discord server
        try {
          await role.delete(`Role deleted via /botroles delete command by ${interaction.user.tag}`);
        } catch (discordErr) {
          console.error(`❌ Failed to delete role ${role.id} from guild:`, discordErr);
          return interaction.editReply({
            embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ Failed to delete role '${role.name}' from the server. Please verify bot 'Manage Roles' permissions and role position/hierarchy.`)]
          });
        }

        // Delete from BotCreatedRole database collection
        await BotCreatedRole.deleteOne({ roleId: role.id });

        // Deactivate any active marketplace items that were using this role
        const affectedItems = await MarketItem.updateMany(
          { roleId: role.id, isActive: true },
          { isActive: false }
        );

        if (affectedItems.modifiedCount > 0) {
          // Update live marketplace embed since some items became inactive
          updateMarketplace(interaction.client);
        }

        const successDesc = `✅ Role '**${dbRole.roleName}**' has been permanently deleted from the server and database tracking has been removed.` +
          (affectedItems.modifiedCount > 0 ? `\n⚠️ **${affectedItems.modifiedCount}** active marketplace item(s) associated with this role have been set to inactive.` : '');

        // Send admin log
        const sendAdminLog = require('../../utils/sendAdminLog');
        await sendAdminLog(interaction.client, {
          action: 'Delete Bot-Created Role',
          executor: interaction.user.tag,
          target: `${dbRole.roleName} (${role.id})`,
          details: `Permanently deleted bot-created role from the server and database tracking.`,
          fields: [
            { name: 'Role Name', value: dbRole.roleName, inline: true },
            { name: 'Role ID', value: role.id, inline: true },
            { name: 'Deactivated Shop Items', value: `${affectedItems.modifiedCount}`, inline: true }
          ],
          color: 0xE74C3C // Red
        });

        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0x00FF00).setDescription(successDesc)]
        });
      }

    } catch (error) {
      console.error('Error in /botroles command:', error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: "❌ An error occurred. Please try again.", ephemeral: true });
        } else {
          await interaction.reply({ content: "❌ An error occurred. Please try again.", ephemeral: true });
        }
      } catch (err) {}
    }
  }
};
