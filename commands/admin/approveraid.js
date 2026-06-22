const { SlashCommandBuilder, EmbedBuilder, MessageFlags} = require('discord.js');
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
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ Raid ID not found: ${raidId}`)],
          flags: MessageFlags.Ephemeral
        });
      }

      // Check if already approved
      if (raid.status === 'approved') {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFFA500).setDescription(`⚠️ This raid has already been approved.`)],
          flags: MessageFlags.Ephemeral
        });
      }

      // Update raid details
      raid.status = 'approved';
      raid.approvedBy = interaction.user.username;
      raid.approvedAt = new Date();
      await raid.save();

      const rewardPoints = (raid && typeof raid.points === 'number') ? raid.points : 1;

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

      /*
      // Try to DM the raider
      const raiderUser = await interaction.client.users.fetch(raid.userId).catch(() => null);
      if (raiderUser) {
        const dmEmbed = new EmbedBuilder()
          .setColor(0x00FF00) // Success green
          .setDescription(`✅ Your raid has been approved!\n🎉 You received **${rewardPoints}** points.\n**Raid ID:** ${raidId}\n**Total points:** ${userDoc.points}`)
          .setTimestamp();

        try {
          await raiderUser.send({ embeds: [dmEmbed] });
        } catch (dmError) {
          console.log(`[DM Fail] Could not DM user ${raid.username} (${raid.userId}) for raid approval.`);
        }
      }
      */

      // Reply to admin
      const replyEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Success green
        .setDescription(`✅ Raid **${raidId}** approved! **${raid.username}** has been rewarded with **${rewardPoints}** points.`);

      await interaction.reply({ embeds: [replyEmbed], flags: MessageFlags.Ephemeral });



    } catch (error) {
      console.error('Error in /approveraid command:', error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: "❌ An error occurred. Please try again.", flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ content: "❌ An error occurred. Please try again.", flags: MessageFlags.Ephemeral });
        }
      } catch (err) {
        // Silently catch errors if interaction already finished/closed
      }
    }
  }
};
