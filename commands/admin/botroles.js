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
            embeds: [new EmbedBuilder().setColor(0xFFA500).setDescription("ℹ️ বটের তৈরি করা কোনো রোলের রেকর্ড ডাটাবেজে নেই।")]
          });
        }

        const embed = new EmbedBuilder()
          .setTitle("🎭 Bot-Created Roles")
          .setColor(0x5865F2)
          .setTimestamp();

        let desc = "বটের দ্বারা তৈরি হওয়া রোলগুলোর তালিকা নিচে দেওয়া হলো:\n\n";
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
          embed.setDescription("ℹ️ বটের তৈরি করা কোনো রোল বর্তমানে সার্ভারে বিদ্যমান নেই।");
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
            embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ এই রোলটি বটের তৈরি করা রোলের লিস্টে নেই! আপনি শুধুমাত্র বটের তৈরি করা রোলগুলোই এই কমান্ডের মাধ্যমে ডিলিট করতে পারবেন।")],
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
            embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ '${role.name}' রোলটি সার্ভার থেকে ডিলিট করতে ব্যর্থ হয়েছে। বটের Role Manage করার পারমিশন চেক করুন।`)]
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

        const successDesc = `✅ '**${dbRole.roleName}**' রোলটি সার্ভার থেকে চিরতরে ডিলিট করা হয়েছে এবং ট্র্যাকিং মুছে দেওয়া হয়েছে।` +
          (affectedItems.modifiedCount > 0 ? `\n⚠️ এই রোলের সাথে সম্পর্কিত **${affectedItems.modifiedCount}টি** অ্যাক্টিভ মার্কেটপ্লেস আইটেমকে নিষ্ক্রিয় (Inactive) করা হয়েছে।` : '');

        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0x00FF00).setDescription(successDesc)]
        });
      }

    } catch (error) {
      console.error('Error in /botroles command:', error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: "❌ একটা error হয়েছে। আবার চেষ্টা করো।", ephemeral: true });
        } else {
          await interaction.reply({ content: "❌ একটা error হয়েছে। আবার চেষ্টা করো।", ephemeral: true });
        }
      } catch (err) {}
    }
  }
};
