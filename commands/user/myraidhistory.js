const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Raid = require('../../database/models/Raid');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('myraidhistory')
    .setDescription('View your last 5 submitted raids'),
  async execute(interaction) {
    try {
      // Fetch last 5 raids by the user sorted by submittedAt desc
      const raids = await Raid.find({ userId: interaction.user.id })
        .sort({ submittedAt: -1 })
        .limit(5);

      if (raids.length === 0) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription("তুমি এখনো কোনো raid submit করোনি")],
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("📜 তোমার Raid History")
        .setColor(0x5865F2) // Discord Blurple
        .setTimestamp();

      raids.forEach(raid => {
        const formattedDate = raid.submittedAt ? new Date(raid.submittedAt).toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' }) : 'Unknown';
        
        let extraInfo = '';
        if (raid.status === 'rejected' && raid.rejectedReason) {
          extraInfo = `\n❌ **Reason:** ${raid.rejectedReason}`;
        } else if (raid.status === 'approved' && raid.approvedBy) {
          extraInfo = `\n✅ **Approved By:** ${raid.approvedBy}`;
        }

        embed.addFields({
          name: raid.raidId,
          value: `🔴 **Status:** ${raid.status}\n📋 **Tweet ID:** ${raid.tweetId || 'N/A'}\n🔗 **Link:** ${raid.link}\n📅 **Date:** ${formattedDate}${extraInfo}`
        });
      });

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } catch (error) {
      console.error('Error in /myraidhistory command:', error);
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
