const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const checkAdmin = require('../../utils/checkAdmin');
const Raid = require('../../database/models/Raid');
const User = require('../../database/models/User');
const updateLeaderboard = require('../../utils/updateLeaderboard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('approveraid')
    .setDescription('Approve a pending raid and reward points')
    .addStringOption(option =>
      option.setName('raid_id')
        .setDescription('The ID of the raid to approve (RAID-xxxxxxxxxx)')
        .setRequired(true)),
  async execute(interaction) {
    try {
      // Check admin permissions
      const isAdmin = await checkAdmin(interaction);
      if (!isAdmin) return;

      const raidId = interaction.options.getString('raid_id').trim();

      // Find the raid
      const raid = await Raid.findOne({ raidId: raidId });
      if (!raid) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ Raid ID পাওয়া যায়নি: ${raidId}`)],
          ephemeral: true
        });
      }

      // Check if already approved
      if (raid.status === 'approved') {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFFA500).setDescription(`⚠️ এই raid already approved`)],
          ephemeral: true
        });
      }

      // Update raid details
      raid.status = 'approved';
      raid.approvedBy = interaction.user.username;
      raid.approvedAt = new Date();
      await raid.save();

      const rewardPoints = (raid && typeof raid.points === 'number') ? raid.points : 10;

      // Find or create raider user, increment points and increment raidsApproved
      const userDoc = await User.findOneAndUpdate(
        { discordId: raid.userId },
        {
          $inc: { points: rewardPoints, raidsApproved: 1 },
          $set: { username: raid.username },
          $setOnInsert: { discordId: raid.userId, createdAt: new Date() }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Update live leaderboard channel
      updateLeaderboard(interaction.client);

      // Try to DM the raider
      const raiderUser = await interaction.client.users.fetch(raid.userId).catch(() => null);
      if (raiderUser) {
        const dmEmbed = new EmbedBuilder()
          .setColor(0x00FF00) // Success green
          .setDescription(`✅ তোমার raid approve হয়েছে!\n🎉 তুমি **${rewardPoints}** points পেয়েছো\n**Raid ID:** ${raidId}\n**মোট points:** ${userDoc.points}`)
          .setTimestamp();

        try {
          await raiderUser.send({ embeds: [dmEmbed] });
        } catch (dmError) {
          console.log(`[DM Fail] Could not DM user ${raid.username} (${raid.userId}) for raid approval.`);
        }
      }

      // Reply to admin
      const replyEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Success green
        .setDescription(`✅ Raid **${raidId}** approved! **${raid.username}** কে **${rewardPoints}** points দেওয়া হয়েছে`);

      await interaction.reply({ embeds: [replyEmbed], ephemeral: true });

    } catch (error) {
      console.error('Error in /approveraid command:', error);
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
