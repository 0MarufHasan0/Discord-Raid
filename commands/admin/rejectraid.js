const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const checkAdmin = require('../../utils/checkAdmin');
const Raid = require('../../database/models/Raid');

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
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ Raid ID পাওয়া যায়নি: ${raidId}`)],
          ephemeral: true
        });
      }

      // Check if already processed
      if (raid.status !== 'pending') {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFFA500).setDescription(`⚠️ এই raid already ${raid.status}`)],
          ephemeral: true
        });
      }

      // Update raid status and reason
      raid.status = 'rejected';
      raid.rejectedReason = reason;
      await raid.save();

      // Try to DM the raider
      const raiderUser = await interaction.client.users.fetch(raid.userId).catch(() => null);
      if (raiderUser) {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xFF0000) // Error red
          .setDescription(`❌ তোমার raid reject হয়েছে\n**কারণ:** ${reason}\n**Raid ID:** ${raidId}`)
          .setTimestamp();

        try {
          await raiderUser.send({ embeds: [dmEmbed] });
        } catch (dmError) {
          console.log(`[DM Fail] Could not DM user ${raid.username} (${raid.userId}) for raid rejection.`);
        }
      }

      // Reply to admin
      const replyEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Success green
        .setDescription(`✅ Raid **${raidId}** reject করা হয়েছে`);

      await interaction.reply({ embeds: [replyEmbed], ephemeral: true });

    } catch (error) {
      console.error('Error in /rejectraid command:', error);
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
