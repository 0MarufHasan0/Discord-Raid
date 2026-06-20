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
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ Validity পরিবর্তন করতে অবশ্যই `days` অপশনে ১ বা তার বেশি দিন প্রদান করতে হবে।")]
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
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ প্রদত্ত রোলের জন্য কোনো সক্রিয় whitelist পাওয়া যায়নি ${targetUser ? `ইউজার <@${targetUser.id}> এর জন্য` : 'সার্ভারে'}`)]
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
        responseText = `✅ সফলভাবে **${successCount}** জন ইউজারের থেকে <@&${role.id}> রোলটি সরানো হয়েছে এবং ডাটাবেজ থেকে মুছে দেওয়া হয়েছে।`;
      } else {
        const actionWord = action === 'add_days' ? 'বৃদ্ধি' : action === 'reduce_days' ? 'হ্রাস' : 'সেট';
        responseText = `✅ সফলভাবে **${successCount}** জন ইউজারের <@&${role.id}> রোলটির মেয়াদ **${days}** দিন ${actionWord} করা হয়েছে।`;
      }

      if (failCount > 0) {
        responseText += `\n⚠️ **${failCount}** জন ইউজারের মেয়াদ আপডেট করতে সমস্যা হয়েছে (বটের রোল পারমিশন চেক করুন)।`;
      }

      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0x00FF00).setDescription(responseText)]
      });

    } catch (error) {
      console.error('Error in /edituserwl command:', error);
      try {
        await interaction.editReply({ content: "❌ একটা error হয়েছে। আবার চেষ্টা করো।" });
      } catch (err) {}
    }
  }
};
