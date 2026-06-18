const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config');
const checkAdmin = require('../../utils/checkAdmin');
const Tweet = require('../../database/models/Tweet');

function extractStatusId(url) {
  if (!url) return null;
  const regex = /https?:\/\/(www\.)?(twitter|x)\.com\/([a-zA-Z0-9_]+)\/status\/(\d+)/i;
  const match = url.match(regex);
  return match ? match[4] : null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addtweet')
    .setDescription('Post a new tweet to the announcement channel')
    .addStringOption(option =>
      option.setName('content')
        .setDescription('Tweet content / text / tags')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('tweet_link')
        .setDescription('Link of the tweet/post (optional)')
        .setRequired(false)),
  async execute(interaction) {
    try {
      // Check admin permissions
      const isAdmin = await checkAdmin(interaction);
      if (!isAdmin) return;

      // Defer reply ephemerally as resolving multiple channels might take time
      await interaction.deferReply({ ephemeral: true });

      const content = interaction.options.getString('content');
      const tweetLink = interaction.options.getString('tweet_link');

      const tweetChannelIdString = config.tweetChannelId || '';
      const tweetChannelIds = tweetChannelIdString.split(',').map(id => id.trim()).filter(Boolean);

      if (tweetChannelIds.length === 0) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ TWEET_CHANNEL_ID config-এ সেট করা নেই।")]
        });
      }

      const results = [];

      // Determine the original link, final embed link (fxtwitter), and cleaned content
      let isTwitterLink = false;
      let finalTweetLink = null;
      let originalTweetLink = tweetLink;
      let contentCleaned = content;

      if (tweetLink) {
        isTwitterLink = /https?:\/\/(www\.)?(twitter|x)\.com\/\S+/i.test(tweetLink);
        if (isTwitterLink) {
          finalTweetLink = tweetLink.replace(/\b(x|twitter)\.com\b/i, 'fxtwitter.com');
        } else {
          finalTweetLink = tweetLink;
        }
      } else {
        const twitterRegex = /https?:\/\/(www\.)?(twitter|x)\.com\/\S+/i;
        const match = content.match(twitterRegex);
        if (match) {
          originalTweetLink = match[0];
          isTwitterLink = true;
          finalTweetLink = originalTweetLink.replace(/\b(x|twitter)\.com\b/i, 'fxtwitter.com');
          contentCleaned = content.replace(twitterRegex, '').replace(/\s+/g, ' ').trim();
        }
      }

      const statusId = extractStatusId(originalTweetLink);
      const tweetId = statusId || `TWT-${Date.now().toString().slice(-6)}`;

      for (const channelId of tweetChannelIds) {
        let channel = interaction.client.channels.cache.get(channelId);
        let fetchErrorMsg = null;

        if (!channel) {
          try {
            channel = await interaction.client.channels.fetch(channelId);
          } catch (fetchError) {
            console.error(`❌ Error fetching channel ${channelId}:`, fetchError);
            if (fetchError.code === 50001 || fetchError.message.includes('Missing Access')) {
              fetchErrorMsg = "বটের এই চ্যানেলটি দেখার পারমিশন নেই (Missing Access)।";
            } else if (fetchError.code === 10003 || fetchError.message.includes('Unknown Channel')) {
              fetchErrorMsg = "চ্যানেল আইডিটি সঠিক নয় বা চ্যানেলটি সার্ভারে খুঁজে পাওয়া যায়নি (Unknown Channel)।";
            } else {
              fetchErrorMsg = `টুইট চ্যানেল লোড করতে সমস্যা হয়েছে। বিবরণ: ${fetchError.message}`;
            }
            channel = null;
          }
        }

        if (!channel) {
          results.push({ channelId, success: false, reason: fetchErrorMsg || "Tweet channel-টি খুঁজে পাওয়া যায়নি!" });
          continue;
        }

        let sentSuccess = false;
        let errorReason = null;

        // If we have a tweet link (either explicitly in tweet_link, or inside content)
        if (finalTweetLink) {
          const announcementEmbed = new EmbedBuilder()
            .setTitle("📢 New Tweet")
            .setDescription(
              `${contentCleaned ? `${contentCleaned}\n` : ''}` +
              `__________________________________________________\n\n` +
              `📋 **Tweet ID:** \`${tweetId}\`\n` +
              `👉 Submit using: \`/submitraid link:<proof_link> tweet_id:${tweetId}\``
            )
            .setColor(0x5865F2) // Discord Blurple
            .setFooter({ text: `Tweet ID: ${tweetId} • Posted by ${interaction.user.username}` })
            .setTimestamp();

          const messageText = `[.](${finalTweetLink})`;

          // Create the Link button pointing to the original tweet link
          const button = new ButtonBuilder()
            .setLabel('Raid')
            .setURL(originalTweetLink)
            .setStyle(ButtonStyle.Link);

          const row = new ActionRowBuilder().addComponents(button);

          try {
            await channel.send({ 
              content: messageText,
              embeds: [announcementEmbed],
              components: [row] 
            });
            sentSuccess = true;
          } catch (sendError) {
            console.error(`❌ Error sending message to channel ${channelId}:`, sendError);
            if (sendError.code === 50013 || sendError.message.includes('Missing Permissions')) {
              errorReason = "বটের এই চ্যানেলে মেসেজ পাঠানোর পারমিশন নেই (Missing Permissions)।";
            } else {
              errorReason = `মেসেজ পাঠাতে সমস্যা হয়েছে। বিবরণ: ${sendError.message}`;
            }
          }
        } else {
          // Standard text announcement embed
          const announcementEmbed = new EmbedBuilder()
            .setTitle("📢 New Tweet")
            .setDescription(
              `${contentCleaned ? `${contentCleaned}\n` : ''}` +
              `__________________________________________________\n\n` +
              `📋 **Tweet ID:** \`${tweetId}\`\n` +
              `👉 Submit using: \`/submitraid link:<proof_link> tweet_id:${tweetId}\``
            )
            .setColor(0x5865F2) // Discord Blurple
            .setFooter({ text: `Tweet ID: ${tweetId} • Posted by ${interaction.user.username}` })
            .setTimestamp();

          try {
            await channel.send({ embeds: [announcementEmbed] });
            sentSuccess = true;
          } catch (sendError) {
            console.error(`❌ Error sending embed to channel ${channelId}:`, sendError);
            if (sendError.code === 50013 || sendError.message.includes('Missing Permissions')) {
              errorReason = "বটের এই চ্যানেলে মেসেজ বা এম্বেড লিংক পাঠানোর পারমিশন নেই (Missing Permissions)।";
            } else {
              errorReason = `মেসেজ পাঠাতে সমস্যা হয়েছে। বিবরণ: ${sendError.message}`;
            }
          }
        }

        if (sentSuccess) {
          try {
            // Save to MongoDB
            const newTweet = new Tweet({
              tweetId: tweetId,
              content: contentCleaned,
              imageUrl: originalTweetLink || null, // save tweet link/url under imageUrl
              postedBy: interaction.user.username,
              channelId: channelId
            });
            await newTweet.save();
            results.push({ channelId, success: true, channelName: channel.name });
          } catch (dbError) {
            console.error(`❌ Error saving tweet to database for channel ${channelId}:`, dbError);
            results.push({ channelId, success: true, channelName: channel.name, note: "টুইট পাঠানো হয়েছে কিন্তু ডাটাবেসে সেভ করা যায়নি।" });
          }
        } else {
          results.push({ channelId, success: false, reason: errorReason || "টুইট পোস্ট করা যায়নি।" });
        }
      }

      // Build summary embed
      const summaryDescription = results.map(r => {
        if (r.success) {
          const noteText = r.note ? ` (${r.note})` : '';
          return `✅ **<#${r.channelId}>** (${r.channelId}): Successfully posted!${noteText}`;
        } else {
          return `❌ **${r.channelId}**: ${r.reason}`;
        }
      }).join('\n');

      const isAnySuccess = results.some(r => r.success);
      const isAnyFailure = results.some(r => !r.success);

      let embedColor = 0x00FF00; // All success (green)
      if (isAnySuccess && isAnyFailure) {
        embedColor = 0xFFA500; // Partial success (orange)
      } else if (!isAnySuccess) {
        embedColor = 0xFF0000; // All fail (red)
      }

      const summaryEmbed = new EmbedBuilder()
        .setTitle("📢 Tweet Posting Summary")
        .setDescription(summaryDescription)
        .setColor(embedColor)
        .setTimestamp();

      await interaction.editReply({ embeds: [summaryEmbed] });

    } catch (error) {
      console.error('Error in /addtweet command:', error);
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
