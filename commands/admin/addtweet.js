const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const https = require('https');
const config = require('../../config');
const checkAdmin = require('../../utils/checkAdmin');
const Tweet = require('../../database/models/Tweet');

function extractTweetInfo(url) {
  if (!url) return null;
  const regex = /https?:\/\/([a-zA-Z0-9-]+\.)?(twitter|x)\.com\/([a-zA-Z0-9_]+)\/status\/(\d+)/i;
  const match = url.match(regex);
  if (!match) return null;
  return {
    username: match[3],
    statusId: match[4]
  };
}

function fetchTweetData(username, statusId) {
  return new Promise((resolve, reject) => {
    const url = `https://api.fxtwitter.com/${username}/status/${statusId}`;
    const options = {
      headers: {
        'User-Agent': 'MarketplaceBossBot/1.0 (Discord Bot)'
      },
      timeout: 5000
    };

    const req = https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            if (parsed && parsed.tweet) {
              resolve(parsed.tweet);
            } else {
              reject(new Error('Invalid response structure'));
            }
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error(`HTTP status code ${res.statusCode}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
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
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('duration_days')
        .setDescription('Number of days the raid remains active (default: 1)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('duration_hours')
        .setDescription('Number of hours the raid remains active (optional)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('duration_minutes')
        .setDescription('Number of minutes the raid remains active (optional)')
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
      
      const durationDays = interaction.options.getInteger('duration_days') || 0;
      const durationHours = interaction.options.getInteger('duration_hours') || 0;
      const durationMinutes = interaction.options.getInteger('duration_minutes') || 0;

      let durationMs = (durationDays * 24 * 60 * 60 * 1000) +
                       (durationHours * 60 * 60 * 1000) +
                       (durationMinutes * 60 * 1000);

      if (durationMs === 0) {
        durationMs = 24 * 60 * 60 * 1000; // Default to 24 hours
      }

      const expiresAt = new Date(Date.now() + durationMs);

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
        isTwitterLink = /https?:\/\/([a-zA-Z0-9-]+\.)?(twitter|x)\.com\/\S+/i.test(tweetLink);
        if (isTwitterLink) {
          finalTweetLink = tweetLink.replace(/https?:\/\/([a-zA-Z0-9-]+\.)?(x|twitter)\.com/i, 'https://fxtwitter.com');
        } else {
          finalTweetLink = tweetLink;
        }
      } else {
        const twitterRegex = /https?:\/\/([a-zA-Z0-9-]+\.)?(twitter|x)\.com\/\S+/i;
        const match = content.match(twitterRegex);
        if (match) {
          originalTweetLink = match[0];
          isTwitterLink = true;
          finalTweetLink = originalTweetLink.replace(/https?:\/\/([a-zA-Z0-9-]+\.)?(x|twitter)\.com/i, 'https://fxtwitter.com');
          contentCleaned = content.replace(twitterRegex, '').replace(/\s+/g, ' ').trim();
        }
      }

      const tweetInfo = extractTweetInfo(originalTweetLink);
      const statusId = tweetInfo ? tweetInfo.statusId : null;
      const tweetId = statusId || `TWT-${Date.now().toString().slice(-6)}`;

      // Fetch FxTwitter API data if this is a Twitter link
      let tweetData = null;
      if (tweetInfo) {
        try {
          tweetData = await fetchTweetData(tweetInfo.username, tweetInfo.statusId);
        } catch (apiError) {
          console.error(`⚠️ FxTwitter API error: ${apiError.message}. Falling back to standard layout.`);
        }
      }

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

        // Build premium announcement embed
        const announcementEmbed = new EmbedBuilder()
          .setColor(0x5865F2) // Discord Blurple
          .setThumbnail(interaction.client.user.displayAvatarURL({ dynamic: true }))
          .setFooter({ 
            text: `Tweet ID: ${tweetId} • Posted by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL({ dynamic: true })
          })
          .setTimestamp();

        // Prepare message content (user custom content text goes at the very top, outside embed)
        let messageText = contentCleaned || '';
        if (finalTweetLink) {
          messageText = `${messageText} [.](${finalTweetLink})`.trim();
        }

        const buttons = [];
        const unixTimestamp = Math.floor(expiresAt.getTime() / 1000);

        if (tweetData) {
          // Set premium author details
          if (tweetData.author) {
            announcementEmbed.setAuthor({
              name: `${tweetData.author.name} (@${tweetData.author.screen_name})`,
              iconURL: tweetData.author.avatar_url,
              url: tweetData.url || originalTweetLink
            });
          } else {
            announcementEmbed.setAuthor({
              name: "New Raid Announcement",
              iconURL: interaction.client.user.displayAvatarURL({ dynamic: true })
            });
          }

          // Build description
          let desc = '';
          if (tweetData.text) {
            desc += `> ${tweetData.text.replace(/\n/g, '\n> ')}\n\n`;
          }
          
          // Expiration time using Discord dynamic timestamps
          desc += `⏰ **Raid Active Until:** <t:${unixTimestamp}:F> (<t:${unixTimestamp}:R>)\n\n`;
          
          desc += `**👉 Raid Submit Command:**\n`;
          desc += `\`\`\`/submitraid link:<proof_link> tweet_id:${tweetId}\`\`\`\n\n`;

          // Add Twitter stats line below the raid submit command
          desc += `💬 ${tweetData.replies || 0}   🔁 ${tweetData.retweets || 0}   ❤️ ${tweetData.likes || 0}   👁️ ${tweetData.views || 0}`;
          
          announcementEmbed.setDescription(desc);

          // Set image if media photo is available
          if (tweetData.media && tweetData.media.all && tweetData.media.all.length > 0) {
            const photo = tweetData.media.all.find(m => m.type === 'photo' || m.type === 'image');
            if (photo && photo.url) {
              announcementEmbed.setImage(photo.url);
            }
          }
        } else {
          // Fallback / Standard layout
          announcementEmbed.setAuthor({
            name: "New Raid Announcement",
            iconURL: interaction.client.user.displayAvatarURL({ dynamic: true })
          });

          let desc = '';
          // Expiration time using Discord dynamic timestamps
          desc += `⏰ **Raid Active Until:** <t:${unixTimestamp}:F> (<t:${unixTimestamp}:R>)\n\n`;
          
          desc += `**👉 Raid Submit Command:**\n`;
          desc += `\`\`\`/submitraid link:<proof_link> tweet_id:${tweetId}\`\`\`\n`;
          desc += `*(Click the **Copy Tweet ID** button below to copy the ID)*`;
          announcementEmbed.setDescription(desc);
        }

        // Add Raid button if we have a tweet link
        if (originalTweetLink) {
          buttons.push(
            new ButtonBuilder()
              .setLabel('Raid')
              .setURL(originalTweetLink)
              .setStyle(ButtonStyle.Link)
          );
        }

        // Add Copy Tweet ID button
        buttons.push(
          new ButtonBuilder()
            .setLabel('Copy Tweet ID')
            .setEmoji('📋')
            .setCustomId(`copy_tweet_id_${tweetId}`)
            .setStyle(ButtonStyle.Secondary)
        );

        const row = new ActionRowBuilder().addComponents(buttons);

        try {
          await channel.send({
            content: messageText || undefined,
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

        if (sentSuccess) {
          try {
            // Save to MongoDB
            const newTweet = new Tweet({
              tweetId: tweetId,
              content: contentCleaned,
              imageUrl: originalTweetLink || null, // save tweet link/url under imageUrl
              postedBy: interaction.user.username,
              channelId: channelId,
              expiresAt: expiresAt
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
