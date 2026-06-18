const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Raid = require('../../database/models/Raid');
const User = require('../../database/models/User');
const Tweet = require('../../database/models/Tweet');
const updateLeaderboard = require('../../utils/updateLeaderboard');

/**
 * Normalizes Twitter/X status links and extracts the status ID.
 * Example: https://twitter.com/user/status/123456?s=20 -> statusId: 123456, normalized: https://x.com/user/status/123456
 */
function getTweetIdAndNormalize(url) {
  if (!url) return null;
  const regex = /https?:\/\/([a-zA-Z0-9-]+\.)?(twitter|x)\.com\/([a-zA-Z0-9_]+)\/status\/(\d+)/i;
  const match = url.match(regex);
  if (!match) return null;
  return {
    normalized: `https://x.com/${match[3]}/status/${match[4]}`,
    statusId: match[4]
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('submitraid')
    .setDescription('Submit a social media/tweet link for raid approval')
    .addStringOption(option =>
      option.setName('link')
        .setDescription('The link of your post/tweet (proof)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('tweet_id')
        .setDescription('The Tweet ID of the raid announcement')
        .setRequired(true)),
  async execute(interaction) {
    try {
      const link = interaction.options.getString('link').trim();
      const tweetId = interaction.options.getString('tweet_id').trim();
      const escapedTweetId = tweetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Check if the Tweet ID exists in our database (case-insensitive query, getting the latest post)
      const tweetDoc = await Tweet.findOne({ 
        tweetId: { $regex: new RegExp(`^${escapedTweetId}$`, 'i') } 
      }).sort({ postedAt: -1 });
      if (!tweetDoc) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ Invalid Tweet ID! Please provide a correct Tweet ID (found in the footer of the tweet announcement).")],
          ephemeral: true
        });
      }

      // Check if the Tweet has expired
      if (tweetDoc.expiresAt && new Date() > tweetDoc.expiresAt) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ This raid has expired! You can no longer submit a raid for this Tweet ID.")],
          ephemeral: true
        });
      }

      // Use canonical casing from database
      const canonicalTweetId = tweetDoc.tweetId;
      const escapedCanonicalTweetId = canonicalTweetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Check if this user has already submitted a raid for this specific tweet ID (case-insensitive query)
      const existingUserRaid = await Raid.findOne({ 
        userId: interaction.user.id, 
        tweetId: { $regex: new RegExp(`^${escapedCanonicalTweetId}$`, 'i') } 
      });
      if (existingUserRaid) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ You have already submitted a raid for this tweet.\n\nIf you submitted the wrong link and want to submit a new one, please delete your previous raid using \`/removemyraid tweet_id:${canonicalTweetId}\` first.`)],
          ephemeral: true
        });
      }

      // Simple URL validation
      if (!link.startsWith('http://') && !link.startsWith('https://')) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ Please provide a valid URL/link (must start with http:// or https://).")],
          ephemeral: true
        });
      }

      // Check if it is a Twitter/X link
      const isTwitterDomain = /https?:\/\/([a-zA-Z0-9-]+\.)?(twitter|x)\.com/i.test(link);
      let finalLinkToSave = link;

      if (isTwitterDomain) {
        const tweetInfo = getTweetIdAndNormalize(link);
        if (!tweetInfo) {
          return interaction.reply({
            embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ Please provide a valid Twitter or X post link (e.g., `https://x.com/username/status/1234567890`).")],
            ephemeral: true
          });
        }
        finalLinkToSave = tweetInfo.normalized;

        // Check if the user is trying to submit the original announcement tweet link
        if (tweetDoc.imageUrl) {
          const normOriginal = getTweetIdAndNormalize(tweetDoc.imageUrl);
          if (normOriginal && normOriginal.statusId === tweetInfo.statusId) {
            return interaction.reply({
              embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ You submitted the original announcement tweet link. Please complete the raid and submit the link to your own reply, retweet, or quote tweet.")],
              ephemeral: true
            });
          }
        }
      }

      // Check for duplicate link submission in Raid collection (by anyone)
      const existingRaid = await Raid.findOne({ link: finalLinkToSave });
      if (existingRaid) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ This link has already been submitted.")],
          ephemeral: true
        });
      }

      const raidId = `RAID-${Date.now()}`;

      // Create and save new raid as auto-approved
      const newRaid = new Raid({
        raidId,
        tweetId: canonicalTweetId,
        userId: interaction.user.id,
        username: interaction.user.username,
        link: finalLinkToSave,
        status: 'approved',
        submittedAt: new Date(),
        approvedAt: new Date(),
        approvedBy: 'Auto-System'
      });
      await newRaid.save();

      // Find or create User, and increment points, raidsSubmitted, raidsApproved
      const userDoc = await User.findOneAndUpdate(
        { discordId: interaction.user.id },
        {
          $inc: { points: 10, raidsSubmitted: 1, raidsApproved: 1 },
          $set: { username: interaction.user.username },
          $setOnInsert: { discordId: interaction.user.id, createdAt: new Date() }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Update live leaderboard channel
      updateLeaderboard(interaction.client);

      // Reply publicly
      const replyEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Success green
        .setDescription(
          `✅ Your raid was completed successfully and auto-approved!\n\n` +
          `📋 **Raid ID:** **${raidId}**\n` +
          `📋 **Tweet ID:** **${canonicalTweetId}**\n` +
          `🔗 **Link:** ${finalLinkToSave}\n\n` +
          `🎉 You received **10** points! Your total points: **${userDoc.points}**`
        )
        .setTimestamp();

      await interaction.reply({ embeds: [replyEmbed] });

    } catch (error) {
      console.error('Error in /submitraid command:', error);
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

