const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const checkAdmin = require('../../utils/checkAdmin');
const Raid = require('../../database/models/Raid');
const User = require('../../database/models/User');
const updateLeaderboard = require('../../utils/updateLeaderboard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rejectraid')
    .setDescription('Reject a pending raid')
    .addStringOption(option =>
      option.setName('raid_id')
        .setDescription('The ID of the raid to reject (RAID-xxxxxxxxxx)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for rejection')
        .setRequired(true)),
  async execute(interaction) {
    try {
      // Check admin permissions
      const isAdmin = await checkAdmin(interaction);
      if (!isAdmin) return;

      const raidId = interaction.options.getString('raid_id').trim();
      const reason = interaction.options.getString('reason');

      // Find the raid
      const raid = await Raid.findOne({ raidId: raidId });
      if (!raid) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ Raid ID not found: ${raidId}`)],
          ephemeral: true
        });
      }

      // Check if already rejected
      if (raid.status === 'rejected') {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFFA500).setDescription(`⚠️ This raid has already been rejected.`)],
          ephemeral: true
        });
      }

      const oldStatus = raid.status;

      // Update raid status and reason
      raid.status = 'rejected';
      raid.rejectedReason = reason;
      await raid.save();

      // If the old status was approved, deduct points and decrement raidsApproved from the user
      let pointsDeducted = false;
      let newTotalPoints = 0;
      const deductPoints = (raid && typeof raid.points === 'number') ? raid.points : 1;
      if (oldStatus === 'approved') {
        const userDoc = await User.findOne({ discordId: raid.userId });
        if (userDoc) {
          userDoc.points = Math.max(0, userDoc.points - deductPoints);
          userDoc.raidsApproved = Math.max(0, userDoc.raidsApproved - 1);
          await userDoc.save();
          newTotalPoints = userDoc.points;
          pointsDeducted = true;

          // Update live leaderboard channel
          updateLeaderboard(interaction.client);
        }
      }

      /*
      // Try to DM the raider
      const raiderUser = await interaction.client.users.fetch(raid.userId).catch(() => null);
      if (raiderUser) {
        let dmDescription = `❌ Your raid has been rejected.\n**Reason:** ${reason}\n**Raid ID:** ${raidId}`;
        if (pointsDeducted) {
          dmDescription += `\n⚠️ **Point Deduction:** -${deductPoints} points (Current Points: ${newTotalPoints})`;
        }
        const dmEmbed = new EmbedBuilder()
          .setColor(0xFF0000) // Error red
          .setDescription(dmDescription)
          .setTimestamp();

        try {
          await raiderUser.send({ embeds: [dmEmbed] });
        } catch (dmError) {
          console.log(`[DM Fail] Could not DM user ${raid.username} (${raid.userId}) for raid rejection.`);
        }
      }
      */

      // Reply to admin
      let replyDescription = `✅ Raid **${raidId}** has been rejected.`;
      if (pointsDeducted) {
        replyDescription += ` **${raid.username}** had **${deductPoints}** points deducted from their account (Current Points: **${newTotalPoints}**).`;
      }
      const replyEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Success green
        .setDescription(replyDescription);

      await interaction.reply({ embeds: [replyEmbed], ephemeral: true });

    } catch (error) {
      console.error('Error in /rejectraid command:', error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: "❌ An error occurred. Please try again.", ephemeral: true });
        } else {
          await interaction.reply({ content: "❌ An error occurred. Please try again.", ephemeral: true });
        }
      } catch (err) {
        // Silently catch errors if interaction already finished/closed
      }
    }
  }
};
