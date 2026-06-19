const { EmbedBuilder } = require('discord.js');
const Raid = require('../database/models/Raid');
const User = require('../database/models/User');
const Tweet = require('../database/models/Tweet');
const updateLeaderboard = require('./updateLeaderboard');

/**
 * Normalizes Twitter/X status links and extracts the status ID.
 */
function getTweetIdAndNormalize(url) {
  if (!url) return null;
  const regex = /https?:\/\/([a-zA-Z0-9-]+\.)?(twitter|x)\.com\/([a-zA-Z0-9_]+)\/status\/(\d+)/i;
  const match = url.match(regex);
  if (!match) return null;
  return {
    username: match[3],
    normalized: `https://x.com/${match[3]}/status/${match[4]}`,
    statusId: match[4]
  };
}

/**
 * Sends or updates response depending on interaction state.
 */
async function sendReply(interaction, options) {
  try {
    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply(options);
    } else {
      return await interaction.reply(options);
    }
  } catch (error) {
    console.error('Error sending interaction reply:', error);
  }
}

/**
 * Validates and handles a raid submission.
 * Used by /submitraid command and the Submit Raid modal.
 */
async function handleRaidSubmission(interaction, link, tweetId) {
  try {
    // 1. Check if the user has connected their Twitter/X account
    const userDoc = await User.findOne({ discordId: interaction.user.id });
    if (!userDoc || !userDoc.twitter) {
      return sendReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription("❌ You must connect your Twitter/X account before submitting a raid!\n\nUse `/settwitter` to link your Twitter username first.")
        ],
        ephemeral: true
      });
    }

    const escapedTweetId = tweetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 2. Check if the Tweet ID exists in database (case-insensitive)
    const tweetDoc = await Tweet.findOne({ 
      tweetId: { $regex: new RegExp(`^${escapedTweetId}$`, 'i') } 
    }).sort({ postedAt: -1 });

    if (!tweetDoc) {
      return sendReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription("❌ Invalid Tweet ID! Please provide a correct Tweet ID (found in the footer of the tweet announcement).")
        ],
        ephemeral: true
      });
    }

    const rewardPoints = (tweetDoc && tweetDoc.points) ? tweetDoc.points : 10;

    // 3. Check if the Tweet has expired
    if (tweetDoc.expiresAt && new Date() > tweetDoc.expiresAt) {
      return sendReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription("❌ This raid has expired! You can no longer submit a raid for this Tweet ID.")
        ],
        ephemeral: true
      });
    }

    const canonicalTweetId = tweetDoc.tweetId;
    const escapedCanonicalTweetId = canonicalTweetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 4. Check if this user has already submitted a raid for this specific tweet ID
    const existingUserRaid = await Raid.findOne({ 
      userId: interaction.user.id, 
      tweetId: { $regex: new RegExp(`^${escapedCanonicalTweetId}$`, 'i') } 
    });

    if (existingUserRaid) {
      return sendReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription(`❌ You have already submitted a raid for this tweet.\n\nIf you submitted the wrong link and want to submit a new one, please delete your previous raid using \`/removemyraid tweet_id:${canonicalTweetId}\` first (only if the raid is not expired).`)
        ],
        ephemeral: true
      });
    }

    // 5. Basic URL validation
    if (!link.startsWith('http://') && !link.startsWith('https://')) {
      return sendReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription("❌ Please provide a valid URL/link (must start with http:// or https://).")
        ],
        ephemeral: true
      });
    }

    const isTwitterDomain = /https?:\/\/([a-zA-Z0-9-]+\.)?(twitter|x)\.com/i.test(link);
    if (!isTwitterDomain) {
      return sendReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription("❌ Only Twitter/X post links can be submitted as raid proof!")
        ],
        ephemeral: true
      });
    }

    const tweetInfo = getTweetIdAndNormalize(link);
    if (!tweetInfo) {
      return sendReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription("❌ Please provide a valid Twitter or X post link (e.g., `https://x.com/username/status/1234567890`).")
        ],
        ephemeral: true
      });
    }
    const finalLinkToSave = tweetInfo.normalized;

    // 6. Check if the user is trying to submit the original announcement tweet link
    if (tweetDoc.imageUrl) {
      const normOriginal = getTweetIdAndNormalize(tweetDoc.imageUrl);
      if (normOriginal && normOriginal.statusId === tweetInfo.statusId) {
        return sendReply(interaction, {
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF0000)
              .setDescription("❌ You submitted the original announcement tweet link. Please complete the raid and submit the link to your own reply, retweet, or quote tweet.")
          ],
          ephemeral: true
        });
      }
    }

    // 7. Verify that the link username matches the user's registered Twitter username
    if (tweetInfo.username.toLowerCase() !== userDoc.twitter.toLowerCase()) {
      return sendReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription(`❌ The Twitter username in your submitted link (@${tweetInfo.username}) does not match your connected Twitter handle (@${userDoc.twitter})!\n\nIf you updated your Twitter handle, please link it again using \`/settwitter\`.`)
        ],
        ephemeral: true
      });
    }

    // 8. Check for duplicate link submission in Raid collection (by anyone)
    const existingRaid = await Raid.findOne({ link: finalLinkToSave });
    if (existingRaid) {
      return sendReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription("❌ This link has already been submitted.")
        ],
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
      approvedBy: 'Auto-System',
      points: rewardPoints
    });
    await newRaid.save();

    // If user already has more than 5 raids, delete the oldest ones to keep history to max 5
    const userRaids = await Raid.find({ userId: interaction.user.id }).sort({ submittedAt: -1 });
    if (userRaids.length > 5) {
      const raidsToDelete = userRaids.slice(5);
      const idsToDelete = raidsToDelete.map(r => r._id);
      await Raid.deleteMany({ _id: { $in: idsToDelete } });
    }

    // Increment points and raid counts for User
    const updatedUserDoc = await User.findOneAndUpdate(
      { discordId: interaction.user.id },
      {
        $inc: { points: rewardPoints, raidsSubmitted: 1, raidsApproved: 1 },
        $set: { username: interaction.user.username },
        $setOnInsert: { discordId: interaction.user.id, createdAt: new Date() }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Update live leaderboard channel
    updateLeaderboard(interaction.client);

    // Reply with success
    const replyEmbed = new EmbedBuilder()
      .setColor(0x00FF00) // Success green
      .setTitle("⚔️ Raid Submitted Successfully")
      .setDescription(
        `✅ Your raid was completed successfully and auto-approved!\n\n` +
        `📋 **Raid ID:** **${raidId}**\n` +
        `📋 **Tweet ID:** **${canonicalTweetId}**\n` +
        `🔗 **Link:** [View Submission](${finalLinkToSave})\n\n` +
        `🎉 You received **${rewardPoints}** points! Your total points: **${updatedUserDoc.points}**`
      )
      .setTimestamp();

    // Ensure we reply with ephemeral response if it's a modal submission or if preferred, 
    // but the slash command replied publicly in the original implementation.
    // Let's match the original's public reply style, but make modal replies ephemeral/public as appropriate.
    // Actually, in the screenshot, "This form will be submitted to Bishop..." is private modal interaction, 
    // but let's make the result message ephemeral if it was a button/modal interaction to not clutter public chat, 
    // or public if it is from the slash command.
    // Wait, let's look at how slash command works: in the original `submitraid.js`, `interaction.reply({ embeds: [replyEmbed] })` is public.
    // Let's reply publicly for slash commands, and ephemerally or publicly for modal.
    // Wait, if it is a modal submission (isModalSubmit() is true), let's reply ephemerally so that other users don't see their modal submissions cluttering channels, or public. Let's make modal submissions public or ephemeral?
    // Ephemeral is much better for modal submissions so users can submit directly on the post without cluttering. Wait, let's reply ephemerally if `interaction.isModalSubmit()` is true, or keep it public like slash command. Let's keep it ephemeral for modals so users can submit privately, but wait, slash commands are also sometimes public/ephemeral. Let's make it ephemeral for modal submissions and public for slash commands to be safe.
    const isModal = interaction.isModalSubmit();
    await sendReply(interaction, { embeds: [replyEmbed], ephemeral: isModal });

  } catch (error) {
    console.error('Error processing raid submission:', error);
    await sendReply(interaction, { content: "❌ An error occurred while processing your raid submission. Please try again.", ephemeral: true });
  }
}

module.exports = handleRaidSubmission;
