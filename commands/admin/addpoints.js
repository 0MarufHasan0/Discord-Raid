const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const checkAdmin = require('../../utils/checkAdmin');
const User = require('../../database/models/User');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addpoints')
    .setDescription('Give points to a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to award points to')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('The number of points to award')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for giving points')
        .setRequired(false)),
  async execute(interaction) {
    try {
      // Check admin permissions
      const isAdmin = await checkAdmin(interaction);
      if (!isAdmin) return;

      const targetUser = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      const reason = interaction.options.getString('reason') || 'Admin কর্তৃক প্রদত্ত';

      if (amount <= 0) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ Points-এর পরিমাণ অবশ্যই ০-এর চেয়ে বেশি হতে হবে।")],
          ephemeral: true
        });
      }

      // Find or create user and increment points
      const userDoc = await User.findOneAndUpdate(
        { discordId: targetUser.id },
        {
          $inc: { points: amount },
          $set: { username: targetUser.username },
          $setOnInsert: { discordId: targetUser.id, createdAt: new Date() }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Attempt to DM the user
      const dmEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Success green
        .setDescription(`🎉 তুমি **${amount}** points পেয়েছো!\n**কারণ:** ${reason}\n**তোমার মোট points:** ${userDoc.points}`)
        .setTimestamp();

      try {
        await targetUser.send({ embeds: [dmEmbed] });
      } catch (dmError) {
        // Silently ignore if user has DMs closed
        console.log(`[DM Fail] Could not DM user ${targetUser.username} (${targetUser.id}). DMs might be closed.`);
      }

      // Reply to admin
      const replyEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Success green
        .setDescription(`✅ **${targetUser.username}** কে **${amount}** points দেওয়া হয়েছে। মোট: **${userDoc.points}**`);

      await interaction.reply({ embeds: [replyEmbed], ephemeral: true });

    } catch (error) {
      console.error('Error in /addpoints command:', error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: "❌ একটা error হয়েছে। আবার চেষ্টা করো।", ephemeral: true });
        } else {
          await interaction.reply({ content: "❌ একটা error হয়েছে। আবার চেষ্টা করো।", ephemeral: true });
        }
      } catch (err) {
        // Silently catch errors if interaction already finished/closed
      }
    }
  }
};
