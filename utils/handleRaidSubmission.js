const { EmbedBuilder, MessageFlags} = require('discord.js');
const Raid = require('../database/models/Raid');
const User = require('../database/models/User');
const Tweet = require('../database/models/Tweet');
const updateLeaderboard = require('./updateLeaderboard');
const https = require('https');

/**
 * Normalizes Twitter/X status links and extracts the status ID.
 */
function getTweetIdAndNormalize(url) {
  if (!url) return null;
  const regex = /https?:\/\/([a-zA-Z0-9-]+\.)?(twitter|x)\.com\/([a-zA-Z0-9_]+)\/(?:web\/)?status\/(\d+)/i;
  const match = url.match(regex);
  if (!match) return null;
  const cleanUsername = match[3].toLowerCase();
  return {
    username: cleanUsername,
    normalized: `https://x.com/${cleanUsername}/status/${match[4]}`,
    statusId: match[4]
  };
}

/**
 * Resolves the actual screen name of the tweet author if the URL uses a placeholder like 'i' or 'web'.
 */
function fetchTweetAuthor(username, statusId) {
  return new Promise((resolve, reject) => {
    const url = `https://api.fxtwitter.com/${username}/status/${statusId}`;
    const options = {
      headers: {
        'User-Agent': 'MarketplaceBossBot/1.0 (Discord Bot)'
      },
      timeout: 4000
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            if (parsed && parsed.tweet && parsed.tweet.author && parsed.tweet.author.screen_name) {
              resolve(parsed.tweet.author.screen_name);
            } else {
              reject(new Error('Invalid structure'));
            }
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error(`HTTP status code ${res.statusCode}`));
        }
      });
    }).on('error', reject).on('timeout', () => reject(new Error('Request timeout')));
  });
}

function followTwitterRedirect(url) {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 4000
    };
    const req = https.request(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(res.headers.location);
      } else {
        resolve(null);
      }
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy());
    req.end();
  });
}

async function resolveRealUsername(url, statusId) {
  // Try FxTwitter first
  try {
    const username = await fetchTweetAuthor('i', statusId);
    if (username) return username;
  } catch (err) {
    console.error(`⚠️ FxTwitter resolution failed for status ${statusId}: ${err.message}. Trying redirect fallback.`);
  }

  // Try redirect fallback
  try {
    const redirectUrl = await followTwitterRedirect(url);
    if (redirectUrl) {
      const fullRedirectUrl = redirectUrl.startsWith('http') ? redirectUrl : `https://x.com${redirectUrl}`;
      const resolvedInfo = getTweetIdAndNormalize(fullRedirectUrl);
      if (resolvedInfo && resolvedInfo.username.toLowerCase() !== 'i') {
        return resolvedInfo.username;
      }
    }
  } catch (err) {
    console.error(`⚠️ Redirect fallback resolution failed for status ${statusId}: ${err.message}`);
  }

  return null;
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
        flags: MessageFlags.Ephemeral
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
        flags: MessageFlags.Ephemeral
      });
    }

    const rewardPoints = (tweetDoc && typeof tweetDoc.points === 'number') ? tweetDoc.points : 1;

    // 3. Check if the Tweet has expired
    if (tweetDoc.expiresAt && new Date() > tweetDoc.expiresAt) {
      return sendReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription("❌ This raid has expired! You can no longer submit a raid for this Tweet ID.")
        ],
        flags: MessageFlags.Ephemeral
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
        flags: MessageFlags.Ephemeral
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
        flags: MessageFlags.Ephemeral
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
        flags: MessageFlags.Ephemeral
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
        flags: MessageFlags.Ephemeral
      });
    }

    // Resolve real username if username is 'i' or 'web' (typical for mobile comment links)
    if (tweetInfo.username.toLowerCase() === 'i' || tweetInfo.username.toLowerCase() === 'web') {
      const resolvedUsername = await resolveRealUsername(link, tweetInfo.statusId);
      if (resolvedUsername) {
        const cleanResolved = resolvedUsername.toLowerCase();
        tweetInfo.username = cleanResolved;
        tweetInfo.normalized = `https://x.com/${cleanResolved}/status/${tweetInfo.statusId}`;
      }
    }

    const finalLinkToSave = tweetInfo.normalized;

    // 6. Check if the user is trying to submit the original announcement tweet link
    if (tweetDoc.imageUrl) {
      const normOriginal = getTweetIdAndNormalize(tweetDoc.imageUrl);
      if (normOriginal && normOriginal.statusId === tweetInfo.statusId) {
        try {
          const logUserActivity = require('./logUserActivity');
          await logUserActivity(
            interaction.client,
            interaction.user,
            'Raid Link Submission Failed',
            `❌ **Reason:** User submitted original tweet link instead of proof\n**Submitted Link:** ${finalLinkToSave}`,
            interaction.channelId
          );
        } catch (e) {}

        return sendReply(interaction, {
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF0000)
              .setDescription("❌ You submitted the original announcement tweet link. Please complete the raid and submit the link to your own reply, retweet, or quote tweet.")
          ],
          flags: MessageFlags.Ephemeral
        });
      }
    }

    // 7. Verify that the link username matches the user's registered Twitter username
    if (tweetInfo.username.toLowerCase() !== userDoc.twitter.toLowerCase()) {
      try {
        const logUserActivity = require('./logUserActivity');
        await logUserActivity(
          interaction.client,
          interaction.user,
          'Raid Link Submission Failed',
          `❌ **Reason:** Connected Twitter handle (@${userDoc.twitter}) doesn't match submission link username (@${tweetInfo.username})\n**Submitted Link:** ${finalLinkToSave}`,
          interaction.channelId
        );
      } catch (e) {}

      return sendReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription(`❌ The Twitter username in your submitted link (@${tweetInfo.username}) does not match your connected Twitter handle (@${userDoc.twitter})!\n\nIf you updated your Twitter handle, please link it again using \`/settwitter\`.`)
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    // 8. Check for duplicate link submission in Raid collection (by anyone)
    const existingRaid = await Raid.findOne({ link: finalLinkToSave });
    if (existingRaid) {
      try {
        const logUserActivity = require('./logUserActivity');
        await logUserActivity(
          interaction.client,
          interaction.user,
          'Raid Link Submission Failed',
          `❌ **Reason:** Duplicate link submission (already submitted)\n**Submitted Link:** ${finalLinkToSave}`,
          interaction.channelId
        );
      } catch (e) {}

      return sendReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription("❌ This link has already been submitted.")
        ],
        flags: MessageFlags.Ephemeral
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

    try {
      const logUserActivity = require('./logUserActivity');
      await logUserActivity(
        interaction.client,
        interaction.user,
        'Raid Link Submitted',
        `✅ **Status:** Successfully Auto-Approved\n` +
        `**Raid ID:** \`${raidId}\`\n` +
        `**Tweet ID:** \`${canonicalTweetId}\`\n` +
        `**Submitted Link:** ${finalLinkToSave}\n` +
        `**Points Earned:** \`+${rewardPoints} Points\``,
        interaction.channelId
      );
    } catch (e) {}

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
    await sendReply(interaction, { content: "❌ An error occurred while processing your raid submission. Please try again.", flags: MessageFlags.Ephemeral });
  }
}

module.exports = handleRaidSubmission;
