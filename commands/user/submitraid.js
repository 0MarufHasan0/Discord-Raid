const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Raid = require('../../database/models/Raid');
const User = require('../../database/models/User');
const Tweet = require('../../database/models/Tweet');

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
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ ভুল Tweet ID! দয়া করে সঠিক Tweet ID প্রদান করো (যা টুইট এনাউন্সমেন্টের ফুটারে রয়েছে)।")],
          ephemeral: true
        });
      }

      // Check if the Tweet has expired
      if (tweetDoc.expiresAt && new Date() > tweetDoc.expiresAt) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ এই রেইডের সময় শেষ হয়ে গেছে! তুমি আর এই Tweet ID-এর জন্য রেইড সাবমিট করতে পারবে না।")],
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
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ তুমি ইতিমধ্যে এই টুইটের জন্য রেইড সাবমিট করেছ।\n\nযদি ভুল লিংক দিয়ে থাকো এবং নতুন করে রেইড সাবমিট করতে চাও, তবে প্রথমে \`/removemyraid tweet_id:${canonicalTweetId}\` কমান্ড দিয়ে আগের রেইডটি ডিলিট করো।`)],
          ephemeral: true
        });
      }

      // Simple URL validation
      if (!link.startsWith('http://') && !link.startsWith('https://')) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ দয়া করে একটি সঠিক URL/লিংক প্রদান করুন (http:// বা https:// দিয়ে শুরু হতে হবে)।")],
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
            embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ দয়া করে একটি সঠিক Twitter বা X পোস্টের লিংক দিন (যেমন: `https://x.com/username/status/1234567890`)।")],
            ephemeral: true
          });
        }
        finalLinkToSave = tweetInfo.normalized;

        // Check if the user is trying to submit the original announcement tweet link
        if (tweetDoc.imageUrl) {
          const normOriginal = getTweetIdAndNormalize(tweetDoc.imageUrl);
          if (normOriginal && normOriginal.statusId === tweetInfo.statusId) {
            return interaction.reply({
              embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ তুমি মূল টুইটের লিংকটি সাবমিট করেছ। দয়া করে রেইড সম্পন্ন করে তোমার নিজের রিপ্লাই, রিটুইট, বা কোট টুইটের লিংক সাবমিট করো।")],
              ephemeral: true
            });
          }
        }
      }

      // Check for duplicate link submission in Raid collection (by anyone)
      const existingRaid = await Raid.findOne({ link: finalLinkToSave });
      if (existingRaid) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ এই লিংকটি ইতিমধ্যে সাবমিট করা হয়েছে।")],
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

      // Reply publicly
      const replyEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Success green
        .setDescription(
          `✅ তোমার raid সফলভাবে সম্পন্ন হয়েছে এবং অটো-অ্যাপ্রুভ হয়েছে!\n\n` +
          `📋 **Raid ID:** **${raidId}**\n` +
          `📋 **Tweet ID:** **${canonicalTweetId}**\n` +
          `🔗 **Link:** ${finalLinkToSave}\n\n` +
          `🎉 তুমি **10** points পেয়েছ! তোমার মোট points: **${userDoc.points}**`
        )
        .setTimestamp();

      await interaction.reply({ embeds: [replyEmbed] });

    } catch (error) {
      console.error('Error in /submitraid command:', error);
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

