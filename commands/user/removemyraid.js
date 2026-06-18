const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Raid = require('../../database/models/Raid');
const User = require('../../database/models/User');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removemyraid')
    .setDescription('Remove a submitted raid to correct a mistake (deducts 10 points)')
    .addStringOption(option =>
      option.setName('tweet_id')
        .setDescription('The Tweet ID of the raid to remove')
        .setRequired(true)),
  async execute(interaction) {
    try {
      const tweetId = interaction.options.getString('tweet_id').trim();
      const escapedTweetId = tweetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Find the raid submission (using case-insensitive search for tweetId)
      const raid = await Raid.findOne({ 
        userId: interaction.user.id, 
        tweetId: { $regex: new RegExp(`^${escapedTweetId}$`, 'i') } 
      });
      if (!raid) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ এই Tweet ID (\`${tweetId}\`)-এর জন্য তোমার কোনো রেইড সাবমিশন পাওয়া যায়নি।`)],
          ephemeral: true
        });
      }

      // Delete the raid from database
      await Raid.deleteOne({ _id: raid._id });

      // Find user and deduct 10 points (if approved) and decrement raid counters, clamping at 0
      const userDoc = await User.findOne({ discordId: interaction.user.id });
      if (userDoc) {
        if (raid.status === 'approved') {
          userDoc.points = Math.max(0, userDoc.points - 10);
          userDoc.raidsApproved = Math.max(0, userDoc.raidsApproved - 1);
        }
        userDoc.raidsSubmitted = Math.max(0, userDoc.raidsSubmitted - 1);
        await userDoc.save();
      }

      const totalPoints = userDoc ? userDoc.points : 0;

      const replyEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Success green
        .setDescription(
          `✅ তোমার রেইড সাবমিশন সফলভাবে ডিলিট করা হয়েছে!\n\n` +
          `📋 **Tweet ID:** **${raid.tweetId || tweetId}**\n` +
          `💰 **পয়েন্ট পরিবর্তন:** **-10** (যদি অ্যাপ্রুভ হয়ে থাকে)\n` +
          `💰 **তোমার বর্তমান মোট points:** **${totalPoints}**\n\n` +
          `তুমি এখন আবার নতুন করে লিংক দিয়ে এই Tweet ID-এর জন্য রেইড সাবমিট করতে পারবে।`
        )
        .setTimestamp();

      await interaction.reply({ embeds: [replyEmbed], ephemeral: true });

    } catch (error) {
      console.error('Error in /removemyraid command:', error);
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
