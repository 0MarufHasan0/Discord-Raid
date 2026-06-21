const { SlashCommandBuilder, EmbedBuilder, MessageFlags} = require('discord.js');
const checkAdmin = require('../../utils/checkAdmin');
const Tweet = require('../../database/models/Tweet');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editraidpoints')
    .setDescription('Edit points of an active raid announcement')
    .addStringOption(option =>
      option.setName('tweet_id')
        .setDescription('The Tweet ID of the raid (TWT-xxxxxx or Twitter status ID)')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('points')
        .setDescription('The new point value for this raid')
        .setRequired(true)),
  async execute(interaction) {
    try {
      // Check admin permissions
      const isAdmin = await checkAdmin(interaction);
      if (!isAdmin) return;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const tweetId = interaction.options.getString('tweet_id').trim();
      const newPoints = interaction.options.getInteger('points');

      if (newPoints < 0) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF0000)
              .setDescription("❌ Points value cannot be negative.")
          ]
        });
      }

      const escapedTweetId = tweetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Find all matching tweet announcements
      const tweets = await Tweet.find({ 
        tweetId: { $regex: new RegExp(`^${escapedTweetId}$`, 'i') } 
      });

      if (tweets.length === 0) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF0000)
              .setDescription(`❌ No raid announcement found with Tweet ID: \`${tweetId}\``)
          ]
        });
      }

      // Check for expiration
      const now = new Date();
      const activeTweets = tweets.filter(t => !t.expiresAt || t.expiresAt > now);

      if (activeTweets.length === 0) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF0000)
              .setDescription(`❌ This raid announcement (\`${tweetId}\`) has already expired! You cannot change its points.`)
          ]
        });
      }

      let updatedCount = 0;
      for (const tweetDoc of activeTweets) {
        // Update database
        tweetDoc.points = newPoints;
        await tweetDoc.save();
        updatedCount++;

        // Dynamically update the Discord announcement embed
        if (tweetDoc.messageId && tweetDoc.channelId) {
          try {
            const channel = await interaction.client.channels.fetch(tweetDoc.channelId).catch(() => null);
            if (channel) {
              const message = await channel.messages.fetch(tweetDoc.messageId).catch(() => null);
              if (message && message.embeds.length > 0) {
                const oldEmbed = message.embeds[0];
                const newEmbed = EmbedBuilder.from(oldEmbed);
                
                let desc = oldEmbed.description || '';
                const pointsRegex = /💰 \*\*Reward:\*\* \*\*\d+ points\*\* upon completion!/;
                if (pointsRegex.test(desc)) {
                  desc = desc.replace(pointsRegex, `💰 **Reward:** **${newPoints} points** upon completion!`);
                } else {
                  // Fallback: prepend it or insert it
                  desc = `💰 **Reward:** **${newPoints} points** upon completion!\n` + desc;
                }
                
                newEmbed.setDescription(desc);
                await message.edit({ embeds: [newEmbed] });
              }
            }
          } catch (editError) {
            console.error(`Failed to update announcement embed for message ${tweetDoc.messageId}:`, editError);
          }
        }
      }

      // Recalculate points for users who already completed this raid
      const Raid = require('../../database/models/Raid');
      const User = require('../../database/models/User');
      const updateLeaderboard = require('../../utils/updateLeaderboard');

      const canonicalTweetId = tweets[0].tweetId;
      const escapedCanonicalTweetId = canonicalTweetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const completedRaids = await Raid.find({
        tweetId: { $regex: new RegExp(`^${escapedCanonicalTweetId}$`, 'i') },
        status: 'approved'
      });

      let recalculatedCount = 0;
      for (const raidDoc of completedRaids) {
        const oldPoints = typeof raidDoc.points === 'number' ? raidDoc.points : 0;
        const diff = newPoints - oldPoints;
        
        if (diff !== 0) {
          // Update user points
          const userDoc = await User.findOne({ discordId: raidDoc.userId });
          if (userDoc) {
            userDoc.points = Math.max(0, userDoc.points + diff);
            await userDoc.save();
          }
          
          // Update points stored in the raid record
          raidDoc.points = newPoints;
          await raidDoc.save();
          recalculatedCount++;
        }
      }

      if (recalculatedCount > 0) {
        updateLeaderboard(interaction.client);
      }

      const successEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Success green
        .setDescription(
          `✅ Raid **${canonicalTweetId}** points have been updated to **${newPoints}** (Updated in **${updatedCount}** active channel postings).\n\n` +
          `📊 **Points Recalculation:**\n` +
          `• Re-calculated and updated points for **${recalculatedCount}** already completed raid submission(s) for this tweet.`
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [successEmbed] });

      // Send admin log
      const sendAdminLog = require('../../utils/sendAdminLog');
      await sendAdminLog(interaction.client, {
        action: 'Raid Points Edited',
        executor: interaction.user.tag,
        target: `Tweet ID: ${canonicalTweetId}`,
        details: `Raid points updated to **${newPoints}** points.`,
        fields: [
          { name: 'Active Postings Updated', value: `${updatedCount}`, inline: true },
          { name: 'Submissions Recalculated', value: `${recalculatedCount}`, inline: true }
        ],
        color: 0x3498DB // Blue
      });

    } catch (error) {
      console.error('Error in /editraidpoints command:', error);
      try {
        await interaction.editReply({ content: "❌ An error occurred. Please try again." });
      } catch (err) {
        // Silently catch errors if interaction already finished/closed
      }
    }
  }
};
