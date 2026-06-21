const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const connectDB = require('./database/db');
const updateMarketplace = require('./utils/updateMarketplace');
const updateLeaderboard = require('./utils/updateLeaderboard');
const checkExpiredRoles = require('./utils/checkExpiredRoles');

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// Setup command collection
client.commands = new Collection();

const commandFolders = ['admin', 'user'];
for (const folder of commandFolders) {
  const folderPath = path.join(__dirname, 'commands', folder);
  if (!fs.existsSync(folderPath)) {
    console.warn(`⚠️ Warning: Folder ${folderPath} does not exist.`);
    continue;
  }
  
  const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
  
  for (const file of commandFiles) {
    const filePath = path.join(folderPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      console.log(`📡 Loaded command: /${command.data.name} (from ${folder}/${file})`);
    } else {
      console.warn(`⚠️ Warning: The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
  }
}

// Handle slash command interactions
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`❌ No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
    
    // Determine auto-delete duration: 60 seconds for admins, 15 seconds for regular users
    let deleteDelay = 15000; // 15 seconds default
    
    if (interaction.member && interaction.member.roles) {
      const adminRoleIdString = config.adminRoleId || '';
      const adminRoleIds = adminRoleIdString.split(',').map(id => id.trim()).filter(Boolean);
      const isAdmin = adminRoleIds.some(roleId => {
        if (Array.isArray(interaction.member.roles)) {
          return interaction.member.roles.includes(roleId);
        }
        if (interaction.member.roles.cache) {
          return interaction.member.roles.cache.has(roleId);
        }
        return false;
      });
      if (isAdmin) {
        deleteDelay = 60000; // 1 minute (60 seconds)
      }
    }

    // Auto-delete command reply after delay
    setTimeout(async () => {
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.deleteReply();
        }
      } catch (err) {
        // Silently ignore if ephemeral, already deleted, or interaction expired
      }
    }, deleteDelay);
  } catch (error) {
    console.error(`❌ Error executing /${interaction.commandName}:`, error);
    const errMessage = "❌ An error occurred. Please try again.";
    
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errMessage, ephemeral: true });
      }
    } catch (replyError) {
      // Silently catch in case the channel or interaction was destroyed
    }
  }
});

// Handle button and modal interactions
client.on('interactionCreate', async interaction => {
  const mockInteraction = (originalInteraction, options) => {
    return new Proxy(originalInteraction, {
      get(target, prop) {
        if (prop === 'options') {
          return {
            getString(name) {
              return options[name] !== undefined && options[name] !== null ? String(options[name]) : null;
            },
            getInteger(name) {
              return options[name] !== undefined && options[name] !== null ? Number(options[name]) : null;
            },
            getBoolean(name) {
              return options[name] !== undefined && options[name] !== null ? Boolean(options[name]) : null;
            },
            getUser(name) {
              return options[name] || null;
            },
            getRole(name) {
              return options[name] || null;
            },
            getChannel(name) {
              return options[name] || null;
            }
          };
        }
        const val = target[prop];
        if (typeof val === 'function') {
          return val.bind(target);
        }
        return val;
      }
    });
  };

  if (interaction.isButton()) {
    if (interaction.customId.startsWith('copy_tweet_id_')) {
      const tweetId = interaction.customId.replace('copy_tweet_id_', '');
      console.log(`[Button Click] User ${interaction.user.tag} (${interaction.user.id}) clicked Copy Tweet ID button for: ${tweetId}`);
      try {
        await interaction.reply({
          content: `\`${tweetId}\``,
          ephemeral: true
        });
      } catch (error) {
        console.error('Error replying to copy button:', error);
      }
    } else if (interaction.customId.startsWith('submit_raid_btn_')) {
      const tweetId = interaction.customId.replace('submit_raid_btn_', '');
      try {
        const User = require('./database/models/User');
        const Tweet = require('./database/models/Tweet');
        const Raid = require('./database/models/Raid');
        const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

        // Check if user has registered their Twitter handle
        const userDoc = await User.findOne({ discordId: interaction.user.id });
        if (!userDoc || !userDoc.twitter) {
          return await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription("❌ You must connect your Twitter/X account before submitting a raid!\n\nUse `/settwitter` to link your Twitter username first.")
            ],
            ephemeral: true
          });
        }

        const escapedTweetId = tweetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Check if the Tweet ID exists in database (case-insensitive)
        const tweetDoc = await Tweet.findOne({ 
          tweetId: { $regex: new RegExp(`^${escapedTweetId}$`, 'i') } 
        }).sort({ postedAt: -1 });

        if (!tweetDoc) {
          return await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription("❌ Invalid Tweet ID! Please provide a correct Tweet ID.")
            ],
            ephemeral: true
          });
        }

        // Check if the Tweet has expired
        if (tweetDoc.expiresAt && new Date() > tweetDoc.expiresAt) {
          return await interaction.reply({
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

        // Check if this user has already submitted a raid for this specific tweet ID
        const existingUserRaid = await Raid.findOne({ 
          userId: interaction.user.id, 
          tweetId: { $regex: new RegExp(`^${escapedCanonicalTweetId}$`, 'i') } 
        });

        if (existingUserRaid) {
          return await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription(`❌ You have already submitted a raid for this tweet.\n\nIf you submitted the wrong link and want to submit a new one, please delete your previous raid using \`/removemyraid tweet_id:${canonicalTweetId}\` first (only if the raid is not expired).`)
            ],
            ephemeral: true
          });
        }

        // Show submit raid modal
        const modal = new ModalBuilder()
          .setCustomId(`submit_raid_modal_${tweetId}`)
          .setTitle(`Submit Raid #${tweetId}`);

        const proofInput = new TextInputBuilder()
          .setCustomId('proof_link')
          .setLabel('Paste comment/reply proof link')
          .setPlaceholder('https://x.com/yourhandle/status/com...')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const firstActionRow = new ActionRowBuilder().addComponents(proofInput);
        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);
      } catch (error) {
        console.error('Error opening submit raid modal:', error);
      }
    } else if (interaction.customId === 'open_marketplace_claim_menu_wl' || interaction.customId === 'open_marketplace_claim_menu_role') {
      try {
        const MarketItem = require('./database/models/MarketItem');
        const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder } = require('discord.js');

        const isWlOnly = interaction.customId === 'open_marketplace_claim_menu_wl';
        const now = new Date();

        const query = {
          isActive: true,
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gt: now } }
          ]
        };

        if (isWlOnly) {
          query.$and = [
            { $or: [
              { roleId: null },
              { roleId: { $exists: false } },
              { roleId: "" }
            ] }
          ];
        } else {
          query.roleId = { $ne: null, $exists: true, $ne: "" };
        }

        const items = await MarketItem.find(query).sort({ name: 1 });

        if (items.length === 0) {
          const typeStr = isWlOnly ? "whitelist ticket" : "role reward";
          return await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription(`❌ There are currently no active ${typeStr} items available for claiming.`)
            ],
            ephemeral: true
          });
        }

        const placeholderText = isWlOnly ? 'Select a Whitelist Ticket to claim...' : 'Select a Role Item to claim...';
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('marketplace_claim_select')
          .setPlaceholder(placeholderText);

        items.slice(0, 25).forEach(item => {
          const availableSlots = Math.max(0, item.totalSlots - item.claimedSlots);
          const option = new StringSelectMenuOptionBuilder()
            .setLabel(item.name)
            .setValue(item.name)
            .setDescription(`Cost: ${item.pointCost} pts | Slots: ${item.claimedSlots}/${item.totalSlots} (${availableSlots} left)`);
          
          if (availableSlots <= 0) {
            option.setLabel(`[SOLD OUT] ${item.name}`);
          }
          selectMenu.addOptions(option);
        });

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const promptContent = isWlOnly 
          ? 'Please choose a Whitelist Ticket to claim from the dropdown below:' 
          : 'Please choose a Role Item to claim from the dropdown below:';

        await interaction.reply({
          content: promptContent,
          components: [row],
          ephemeral: true
        });

      } catch (error) {
        console.error('Error opening claim menu:', error);
        try {
          await interaction.reply({
            content: '❌ An error occurred while opening the claim menu.',
            ephemeral: true
          });
        } catch (e) {}
      }
    } else if (interaction.customId === 'ticket_close') {
      try {
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle, OverwriteType, EmbedBuilder } = require('discord.js');
        await interaction.deferReply({ ephemeral: false });

        const memberOverwrite = interaction.channel.permissionOverwrites.cache.find(
          o => (o.type === 1 || o.type === 'member' || o.type === 'Member') && o.id !== interaction.client.user.id
        );

        const closedEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setDescription(`🔒 **Ticket closed by <@${interaction.user.id}>**\nMember's view access was removed. They have been redirected to the general channel.`);

        const controlRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('ticket_reopen')
              .setLabel('Reopen Ticket')
              .setEmoji('🔓')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('ticket_delete')
              .setLabel('Delete Ticket')
              .setEmoji('⛔')
              .setStyle(ButtonStyle.Danger)
          );

        // Edit original message to remove buttons and resolve the interaction reply first.
        // This ensures the user's client receives the response immediately and does not hang on "thinking".
        interaction.message.edit({ components: [] }).catch(() => {});
        await interaction.editReply({ embeds: [closedEmbed], components: [controlRow] });

        // Update channel permissions and DM the user in the background.
        if (memberOverwrite) {
          (async () => {
            try {
              // Edit permissions first
              await interaction.channel.permissionOverwrites.edit(memberOverwrite.id, {
                ViewChannel: false,
                SendMessages: false
              });

              // DM the user to let them know it was closed and provide a redirect link
              let memberUser = interaction.guild.members.cache.get(memberOverwrite.id)?.user 
                || interaction.client.users.cache.get(memberOverwrite.id);
              
              if (!memberUser) {
                memberUser = await interaction.client.users.fetch(memberOverwrite.id);
              }

              if (memberUser) {
                const generalChannel = interaction.guild.channels.cache.find(
                  c => (c.name.toLowerCase().includes('general') || c.name.toLowerCase().includes('chat')) && c.isTextBased()
                );
                const redirectText = generalChannel ? `\n🔗 **Go back to chat:** <#${generalChannel.id}>` : '';
                /*
                const closeDmEmbed = new EmbedBuilder()
                  .setColor(0xFF0000)
                  .setTitle('🔒 Ticket Closed')
                  .setDescription(`Your ticket **${interaction.channel.name}** has been closed by <@${interaction.user.id}>.${redirectText}`)
                  .setTimestamp();

                await memberUser.send({ embeds: [closeDmEmbed] });
                */
              }
            } catch (err) {
              console.log('Failed to complete ticket close background task:', err.message);
            }
          })();
        }

      } catch (error) {
        console.error('Error closing ticket:', error);
        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: '❌ Failed to close the ticket.' });
          } else {
            await interaction.reply({ content: '❌ Failed to close the ticket.', ephemeral: true });
          }
        } catch (e) {}
      }
    } else if (interaction.customId === 'ticket_reopen') {
      try {
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle, OverwriteType, EmbedBuilder } = require('discord.js');
        await interaction.deferReply({ ephemeral: false });

        const memberOverwrite = interaction.channel.permissionOverwrites.cache.find(
          o => (o.type === 1 || o.type === 'member' || o.type === 'Member') && o.id !== interaction.client.user.id
        );

        const reopenedEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setDescription(`🔓 **Ticket reopened by <@${interaction.user.id}>**\nMember's view access was restored.`);

        const closeButtonRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('ticket_close')
              .setLabel('Close Ticket')
              .setEmoji('🔒')
              .setStyle(ButtonStyle.Danger)
          );

        // Edit original message to remove buttons and resolve the interaction reply first.
        // This ensures the user's client receives the response immediately and does not hang on "thinking".
        interaction.message.edit({ components: [] }).catch(() => {});
        await interaction.editReply({ embeds: [reopenedEmbed], components: [closeButtonRow] });

        // Update channel permissions and DM the user in the background.
        if (memberOverwrite) {
          (async () => {
            try {
              // Edit permissions first
              await interaction.channel.permissionOverwrites.edit(memberOverwrite.id, {
                ViewChannel: true,
                SendMessages: true
              });

              // DM the user to let them know it was reopened
              let memberUser = interaction.guild.members.cache.get(memberOverwrite.id)?.user 
                || interaction.client.users.cache.get(memberOverwrite.id);
              
              if (!memberUser) {
                memberUser = await interaction.client.users.fetch(memberOverwrite.id);
              }

              if (memberUser) {
                /*
                const reopenDmEmbed = new EmbedBuilder()
                  .setColor(0x00FF00)
                  .setTitle('🔓 Ticket Reopened')
                  .setDescription(`Your ticket **${interaction.channel.name}** has been reopened. You can access it here: <#${interaction.channel.id}>`)
                  .setTimestamp();

                await memberUser.send({ embeds: [reopenDmEmbed] });
                */
              }
            } catch (err) {
              console.log('Failed to complete ticket reopen background task:', err.message);
            }
          })();
        }

      } catch (error) {
        console.error('Error reopening ticket:', error);
        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: '❌ Failed to reopen the ticket.' });
          } else {
            await interaction.reply({ content: '❌ Failed to reopen the ticket.', ephemeral: true });
          }
        } catch (e) {}
      }
    } else if (interaction.customId === 'ticket_delete') {
      try {
        await interaction.reply({
          content: '⚠️ **This ticket will be deleted in 5 seconds...**'
        });

        setTimeout(async () => {
          try {
            await interaction.channel.delete();
          } catch (deleteError) {
            console.error('Failed to delete channel:', deleteError);
          }
        }, 5000);

      } catch (error) {
        console.error('Error initiating ticket deletion:', error);
        try {
          await interaction.reply({ content: '❌ Failed to delete the ticket.', ephemeral: true });
        } catch (e) {}
      }
    } else if (interaction.customId === 'panel_submit_raid') {
      try {
        const User = require('./database/models/User');
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');

        // Check if user has registered their Twitter handle
        const userDoc = await User.findOne({ discordId: interaction.user.id });
        if (!userDoc || !userDoc.twitter) {
          return await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription("❌ You must connect your Twitter/X account before submitting a raid!\n\nClick the **Set Twitter** button to link your Twitter username first.")
            ],
            ephemeral: true
          });
        }

        // Show submit raid modal
        const modal = new ModalBuilder()
          .setCustomId('panel_submit_raid_modal')
          .setTitle('Submit Raid Submission');

        const tweetIdInput = new TextInputBuilder()
          .setCustomId('panel_tweet_id')
          .setLabel('Raid Tweet ID')
          .setPlaceholder('Enter the Tweet ID of the raid (e.g. 180252...)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const proofInput = new TextInputBuilder()
          .setCustomId('panel_proof_link')
          .setLabel('Paste your reply/comment link (Proof)')
          .setPlaceholder('https://x.com/yourhandle/status/...')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const row1 = new ActionRowBuilder().addComponents(tweetIdInput);
        const row2 = new ActionRowBuilder().addComponents(proofInput);
        modal.addComponents(row1, row2);

        await interaction.showModal(modal);
      } catch (error) {
        console.error('Error opening panel submit raid modal:', error);
      }
    } else if (interaction.customId === 'panel_set_twitter') {
      try {
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

        const modal = new ModalBuilder()
          .setCustomId('panel_set_twitter_modal')
          .setTitle('Set Twitter Username');

        const usernameInput = new TextInputBuilder()
          .setCustomId('panel_twitter_username')
          .setLabel('Twitter Handle (Without @)')
          .setPlaceholder('username')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const row = new ActionRowBuilder().addComponents(usernameInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
      } catch (error) {
        console.error('Error opening panel set twitter modal:', error);
      }
    } else if (interaction.customId === 'panel_disconnect_twitter') {
      try {
        const User = require('./database/models/User');
        const { EmbedBuilder } = require('discord.js');

        const userDoc = await User.findOne({ discordId: interaction.user.id });

        if (!userDoc || !userDoc.twitter) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription("❌ You don't have a Twitter/X account connected to disconnect!")
            ],
            ephemeral: true
          });
        }

        const connectedHandle = userDoc.twitter;
        userDoc.twitter = null;
        await userDoc.save();

        const successEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle("🐦 Twitter Account Disconnected")
          .setDescription(`✅ Successfully disconnected **@${connectedHandle}** from your profile.`)
          .setTimestamp();

        return interaction.reply({ embeds: [successEmbed], ephemeral: true });
      } catch (error) {
        console.error('Error handling panel disconnect twitter button:', error);
      }
    } else if (interaction.customId === 'panel_my_points') {
      try {
        const User = require('./database/models/User');
        const { EmbedBuilder } = require('discord.js');

        let userDoc = await User.findOne({ discordId: interaction.user.id });
        if (!userDoc) {
          userDoc = new User({
            discordId: interaction.user.id,
            username: interaction.user.username,
            points: 0,
            raidsSubmitted: 0,
            raidsApproved: 0
          });
          await userDoc.save();
        }

        const embed = new EmbedBuilder()
          .setTitle(`💰 Your Points — ${interaction.user.username}`)
          .setColor(0x00FF00)
          .addFields(
            { name: 'Total Points', value: String(userDoc.points), inline: true },
            { name: 'Raids Submitted', value: String(userDoc.raidsSubmitted), inline: true },
            { name: 'Raids Approved', value: String(userDoc.raidsApproved), inline: true }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (error) {
        console.error('Error handling panel my points button:', error);
      }
    } else if (interaction.customId === 'panel_my_raid_history') {
      try {
        const Raid = require('./database/models/Raid');
        const { EmbedBuilder } = require('discord.js');

        const raids = await Raid.find({ userId: interaction.user.id })
          .sort({ submittedAt: -1 })
          .limit(5);

        if (raids.length === 0) {
          return interaction.reply({
            embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription("You have not submitted any raids yet.")],
            ephemeral: true
          });
        }

        const embed = new EmbedBuilder()
          .setTitle("📜 Your Raid History")
          .setColor(0x5865F2)
          .setTimestamp();

        raids.forEach(raid => {
          const formattedDate = raid.submittedAt ? new Date(raid.submittedAt).toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }) : 'Unknown';
          
          let extraInfo = '';
          let statusEmoji = '🟡';
          if (raid.status === 'rejected') {
            statusEmoji = '🔴';
            if (raid.rejectedReason) {
              extraInfo = `\n❌ **Reason:** ${raid.rejectedReason}`;
            }
          } else if (raid.status === 'approved') {
            statusEmoji = '🟢';
            if (raid.approvedBy) {
              extraInfo = `\n✅ **Approved By:** ${raid.approvedBy}`;
            }
          }

          embed.addFields({
            name: raid.raidId,
            value: `${statusEmoji} **Status:** ${raid.status}\n📋 **Tweet ID:** ${raid.tweetId || 'N/A'}\n🔗 **Link:** ${raid.link}\n📅 **Date:** ${formattedDate}${extraInfo}`
          });
        });

        await interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (error) {
        console.error('Error handling panel raid history button:', error);
      }
    } else if (interaction.customId === 'panel_remove_raid') {
      try {
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

        const modal = new ModalBuilder()
          .setCustomId('panel_remove_raid_modal')
          .setTitle('Remove Raid Submission');

        const tweetIdInput = new TextInputBuilder()
          .setCustomId('panel_remove_tweet_id')
          .setLabel('Raid Tweet ID')
          .setPlaceholder('Enter the Tweet ID of the raid to remove')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const row = new ActionRowBuilder().addComponents(tweetIdInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
      } catch (error) {
        console.error('Error opening panel remove raid modal:', error);
      }
    } else if (interaction.customId === 'panel_leaderboard') {
      try {
        const User = require('./database/models/User');
        const { EmbedBuilder } = require('discord.js');

        const topUsers = await User.find({}).sort({ points: -1 }).limit(10);

        const embed = new EmbedBuilder()
          .setTitle("🏆 Leaderboard — Top Raiders")
          .setColor(0xFFD700)
          .setTimestamp();

        if (topUsers.length === 0) {
          embed.setDescription("📭 No users found on the leaderboard.");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const rankEmojis = ['🥇', '🥈', '🥉'];

        topUsers.forEach((user, index) => {
          const rank = index + 1;
          const emoji = rank <= 3 ? rankEmojis[index] : `#${rank}`;
          
          embed.addFields({
            name: `${emoji} Position ${rank}`,
            value: `${user.username} — ${user.points} points`
          });
        });

        await interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (error) {
        console.error('Error handling panel leaderboard button:', error);
      }
    } else if (interaction.customId.startsWith('admin_')) {
      // Security check for all admin buttons
      try {
        const checkAdmin = require('./utils/checkAdmin');
        const isAdmin = await checkAdmin(interaction);
        if (!isAdmin) {
          return await interaction.reply({
            content: "❌ You do not have permission to use admin commands.",
            ephemeral: true
          });
        }

        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');

        if (interaction.customId === 'admin_add_tweet') {
          const modal = new ModalBuilder()
            .setCustomId('admin_add_tweet_modal')
            .setTitle('Add Tweet for Raid');

          const contentInput = new TextInputBuilder()
            .setCustomId('content')
            .setLabel('Tweet Content / Tags')
            .setPlaceholder('Enter tweet content or tags...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

          const linkInput = new TextInputBuilder()
            .setCustomId('tweet_link')
            .setLabel('Tweet Link / URL (optional)')
            .setPlaceholder('https://x.com/username/status/...')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          const durationInput = new TextInputBuilder()
            .setCustomId('duration')
            .setLabel('Raid Duration (e.g. 1d 12h 30m, default: 24h)')
            .setPlaceholder('24h')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          const pointsInput = new TextInputBuilder()
            .setCustomId('points')
            .setLabel('Points Rewarded (default: 1)')
            .setPlaceholder('1')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(contentInput),
            new ActionRowBuilder().addComponents(linkInput),
            new ActionRowBuilder().addComponents(durationInput),
            new ActionRowBuilder().addComponents(pointsInput)
          );

          await interaction.showModal(modal);
        } else if (interaction.customId === 'admin_add_wl_item') {
          const modal = new ModalBuilder()
            .setCustomId('admin_add_wl_item_modal')
            .setTitle('Add Marketplace Item');

          const nameInput = new TextInputBuilder()
            .setCustomId('name')
            .setLabel('Item Name')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const descInput = new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Item Description')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

          const costAndSlotsInput = new TextInputBuilder()
            .setCustomId('cost_and_slots')
            .setLabel('Cost / Slots (format: Cost/Slots)')
            .setPlaceholder('e.g. 500/10')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const roleInput = new TextInputBuilder()
            .setCustomId('role_or_create_name')
            .setLabel('Role Name (or ID/Mention if existing)')
            .setPlaceholder('e.g. VIP Role (links existing or creates new)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          const durationsInput = new TextInputBuilder()
            .setCustomId('durations')
            .setLabel('Durations (Role / Market)')
            .setPlaceholder('e.g. Role: 30d | Market: 7d')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(nameInput),
            new ActionRowBuilder().addComponents(descInput),
            new ActionRowBuilder().addComponents(costAndSlotsInput),
            new ActionRowBuilder().addComponents(roleInput),
            new ActionRowBuilder().addComponents(durationsInput)
          );

          await interaction.showModal(modal);
        } else if (interaction.customId === 'admin_edit_wl_item') {
          const modal = new ModalBuilder()
            .setCustomId('admin_edit_wl_item_modal')
            .setTitle('Edit Marketplace Item');

          const nameInput = new TextInputBuilder()
            .setCustomId('name')
            .setLabel('Item Name to Edit')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const newNameInput = new TextInputBuilder()
            .setCustomId('new_name')
            .setLabel('New Name (optional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          const descInput = new TextInputBuilder()
            .setCustomId('description')
            .setLabel('New Description (optional)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false);

          const costInput = new TextInputBuilder()
            .setCustomId('point_cost')
            .setLabel('New Point Cost (optional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          const slotsInput = new TextInputBuilder()
            .setCustomId('total_slots')
            .setLabel('New Total Slots (optional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(nameInput),
            new ActionRowBuilder().addComponents(newNameInput),
            new ActionRowBuilder().addComponents(descInput),
            new ActionRowBuilder().addComponents(costInput),
            new ActionRowBuilder().addComponents(slotsInput)
          );

          await interaction.showModal(modal);
        } else if (interaction.customId === 'admin_remove_wl_item') {
          const modal = new ModalBuilder()
            .setCustomId('admin_remove_wl_item_modal')
            .setTitle('Remove Marketplace Item');

          const nameInput = new TextInputBuilder()
            .setCustomId('name')
            .setLabel('Item Name to Remove')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const deleteRoleInput = new TextInputBuilder()
            .setCustomId('delete_role')
            .setLabel('Delete Associated Role? (true/false)')
            .setPlaceholder('false')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(nameInput),
            new ActionRowBuilder().addComponents(deleteRoleInput)
          );

          await interaction.showModal(modal);
        } else if (interaction.customId === 'admin_add_points') {
          const modal = new ModalBuilder()
            .setCustomId('admin_add_points_modal')
            .setTitle('Add Points to User');

          const userInput = new TextInputBuilder()
            .setCustomId('user')
            .setLabel('Target Username or User ID')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const amountInput = new TextInputBuilder()
            .setCustomId('amount')
            .setLabel('Point Amount to Add')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Reason (optional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(userInput),
            new ActionRowBuilder().addComponents(amountInput),
            new ActionRowBuilder().addComponents(reasonInput)
          );

          await interaction.showModal(modal);
        } else if (interaction.customId === 'admin_remove_points') {
          const modal = new ModalBuilder()
            .setCustomId('admin_remove_points_modal')
            .setTitle('Remove Points from User');

          const userInput = new TextInputBuilder()
            .setCustomId('user')
            .setLabel('Target Username or User ID')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const amountInput = new TextInputBuilder()
            .setCustomId('amount')
            .setLabel('Point Amount to Deduct')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Reason (optional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(userInput),
            new ActionRowBuilder().addComponents(amountInput),
            new ActionRowBuilder().addComponents(reasonInput)
          );

          await interaction.showModal(modal);
        } else if (interaction.customId === 'admin_edit_raid_points') {
          const modal = new ModalBuilder()
            .setCustomId('admin_edit_raid_points_modal')
            .setTitle('Edit Raid Points');

          const tweetIdInput = new TextInputBuilder()
            .setCustomId('tweet_id')
            .setLabel('Raid Tweet ID')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const pointsInput = new TextInputBuilder()
            .setCustomId('points')
            .setLabel('New Points Value')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(tweetIdInput),
            new ActionRowBuilder().addComponents(pointsInput)
          );

          await interaction.showModal(modal);
        } else if (interaction.customId === 'admin_approve_raid') {
          const modal = new ModalBuilder()
            .setCustomId('admin_approve_raid_modal')
            .setTitle('Approve Raid Submission');

          const raidIdInput = new TextInputBuilder()
            .setCustomId('raid_id')
            .setLabel('Raid ID (RAID-xxxxxx)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(raidIdInput)
          );

          await interaction.showModal(modal);
        } else if (interaction.customId === 'admin_reject_raid') {
          const modal = new ModalBuilder()
            .setCustomId('admin_reject_raid_modal')
            .setTitle('Reject Raid Submission');

          const raidIdInput = new TextInputBuilder()
            .setCustomId('raid_id')
            .setLabel('Raid ID (RAID-xxxxxx)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Rejection Reason (optional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(raidIdInput),
            new ActionRowBuilder().addComponents(reasonInput)
          );

          await interaction.showModal(modal);
        } else if (interaction.customId === 'admin_removeraid') {
          const modal = new ModalBuilder()
            .setCustomId('admin_removeraid_modal')
            .setTitle('Delete Raid Announcement');

          const tweetIdInput = new TextInputBuilder()
            .setCustomId('tweet_id')
            .setLabel('Raid Tweet ID')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const deleteMsgInput = new TextInputBuilder()
            .setCustomId('delete_message')
            .setLabel('Delete Discord Announcement Message? (true/false)')
            .setPlaceholder('true')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(tweetIdInput),
            new ActionRowBuilder().addComponents(deleteMsgInput)
          );

          await interaction.showModal(modal);
        } else if (interaction.customId === 'admin_edit_user_wl') {
          const modal = new ModalBuilder()
            .setCustomId('admin_edit_user_wl_modal')
            .setTitle('Edit User Whitelist Validity');

          const roleInput = new TextInputBuilder()
            .setCustomId('role')
            .setLabel('Whitelist Role ID or Mention')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const actionInput = new TextInputBuilder()
            .setCustomId('action')
            .setLabel('Action (remove/add_days/reduce_days/set_days)')
            .setPlaceholder('set_days')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const daysInput = new TextInputBuilder()
            .setCustomId('days')
            .setLabel('Number of Days (optional/as needed)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          const userInput = new TextInputBuilder()
            .setCustomId('user')
            .setLabel('Target Username or User ID (optional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(roleInput),
            new ActionRowBuilder().addComponents(actionInput),
            new ActionRowBuilder().addComponents(daysInput),
            new ActionRowBuilder().addComponents(userInput)
          );

          await interaction.showModal(modal);

        } else if (interaction.customId === 'admin_update_leaderboard') {
          const updateLeaderboard = require('./utils/updateLeaderboard');
          updateLeaderboard(interaction.client);
          await interaction.reply({
            embeds: [new EmbedBuilder().setColor(0x00FF00).setDescription("✅ Leaderboard successfully updated!")],
            ephemeral: true
          });
        } else if (interaction.customId === 'admin_toggle_autotweet') {
          const AutoTweetConfig = require('./database/models/AutoTweetConfig');
          let configDoc = await AutoTweetConfig.findOne();
          if (!configDoc) {
            configDoc = new AutoTweetConfig({ twitterUsernames: [], isEnabled: true });
          }
          configDoc.isEnabled = !configDoc.isEnabled;
          await configDoc.save();

          const statusText = configDoc.isEnabled ? '🟢 **Enabled**' : '🔴 **Disabled**';
          const usernamesList = configDoc.twitterUsernames.length > 0
            ? configDoc.twitterUsernames.map(name => `@${name}`).join(', ')
            : '*None*';

          const oldEmbed = interaction.message.embeds[0];
          const newEmbed = EmbedBuilder.from(oldEmbed)
            .setDescription(
              "Welcome to the **Raid Boss** Admin Panel! Use the buttons below to manage the bot's features and users:\n\n" +
              "📢 **Add Tweet** — Register a tweet for a raid\n" +
              "🎁 **Add WL Item** — Add a new item to the marketplace\n" +
              "✏️ **Edit WL Item** — Edit an existing marketplace item\n" +
              "🗑️ **Remove WL Item** — Deactivate/remove a marketplace item\n" +
              "➕ **Add Points** — Reward points to a member\n" +
              "➖ **Remove Points** — Deduct points from a member\n" +
              "⚙️ **Edit Raid Points** — Modify points rewarded for a specific raid\n" +
              "✅ **Approve Raid** — Manually approve a pending raid\n" +
              "❌ **Reject Raid** — Manually reject a raid submission\n" +
              "🗑️ **Delete Announcement** — Delete a raid announcement and its records\n" +
              "🎭 **Edit User WL** — Modify or remove a member's whitelist validity\n" +
              "🔄 **Update Leaderboard** — Force update the leaderboard embed\n\n" +
              `🤖 **Auto-Tweet Status:** ${statusText}\n` +
              `🐦 **Monitored Accounts:** ${usernamesList}`
            );

          await interaction.update({ embeds: [newEmbed] });
          await interaction.followUp({
            embeds: [new EmbedBuilder().setColor(0x00FF00).setDescription(`🤖 Auto-Tweet detection has been toggled to: ${statusText}`)],
            ephemeral: true
          });
        } else if (interaction.customId === 'admin_add_autotweet_user') {
          const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
          const modal = new ModalBuilder()
            .setCustomId('admin_add_autotweet_user_modal')
            .setTitle('Add Monitored Twitter Account');

          const usernameInput = new TextInputBuilder()
            .setCustomId('twitter_username')
            .setLabel('Twitter Username')
            .setPlaceholder('e.g. ElonMusk')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(usernameInput));
          await interaction.showModal(modal);
        } else if (interaction.customId === 'admin_remove_autotweet_user') {
          const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
          const modal = new ModalBuilder()
            .setCustomId('admin_remove_autotweet_user_modal')
            .setTitle('Remove Monitored Twitter Account');

          const usernameInput = new TextInputBuilder()
            .setCustomId('twitter_username')
            .setLabel('Twitter Username')
            .setPlaceholder('e.g. ElonMusk')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(usernameInput));
          await interaction.showModal(modal);
        }
      } catch (error) {
        console.error('Error handling admin button click:', error);
      }
    }
  } else if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('submit_raid_modal_')) {
      const tweetId = interaction.customId.replace('submit_raid_modal_', '');
      const link = interaction.fields.getTextInputValue('proof_link').trim();
      try {
        // Defer response ephemerally
        await interaction.deferReply({ ephemeral: true });

        const handleRaidSubmission = require('./utils/handleRaidSubmission');
        await handleRaidSubmission(interaction, link, tweetId);
      } catch (error) {
        console.error('Error handling submit raid modal submission:', error);
      }
    } else if (interaction.customId === 'panel_submit_raid_modal') {
      const tweetId = interaction.fields.getTextInputValue('panel_tweet_id').trim();
      const link = interaction.fields.getTextInputValue('panel_proof_link').trim();
      try {
        await interaction.deferReply({ ephemeral: true });
        const handleRaidSubmission = require('./utils/handleRaidSubmission');
        await handleRaidSubmission(interaction, link, tweetId);
      } catch (error) {
        console.error('Error handling panel submit raid modal submission:', error);
      }
    } else if (interaction.customId === 'panel_set_twitter_modal') {
      let twitterHandle = interaction.fields.getTextInputValue('panel_twitter_username').trim();
      try {
        const User = require('./database/models/User');
        const { EmbedBuilder } = require('discord.js');

        if (twitterHandle.startsWith('@')) {
          twitterHandle = twitterHandle.substring(1);
        }
        twitterHandle = twitterHandle.trim();

        if (!/^[a-zA-Z0-9_]{1,15}$/.test(twitterHandle)) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription("❌ Invalid Twitter/X username! Twitter handles should be 1-15 characters long and contain only letters, numbers, and underscores.")
            ],
            ephemeral: true
          });
        }

        const lowercasedHandle = twitterHandle.toLowerCase();

        const existingUser = await User.findOne({ 
          twitter: lowercasedHandle, 
          discordId: { $ne: interaction.user.id } 
        });

        if (existingUser) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription(`❌ The Twitter handle **@${twitterHandle}** is already linked to another user!`)
            ],
            ephemeral: true
          });
        }

        const userDoc = await User.findOneAndUpdate(
          { discordId: interaction.user.id },
          {
            $set: { 
              twitter: lowercasedHandle,
              username: interaction.user.username
            },
            $setOnInsert: { 
              discordId: interaction.user.id, 
              createdAt: new Date() 
            }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const successEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle("🐦 Twitter Account Connected")
          .setDescription(`✅ Successfully linked your Twitter/X account: **@${twitterHandle}**!\n\nYou can now submit raids for approval.`)
          .setTimestamp();

        return interaction.reply({ embeds: [successEmbed], ephemeral: true });

      } catch (error) {
        console.error('Error handling panel set twitter modal submission:', error);
      }
    } else if (interaction.customId === 'panel_remove_raid_modal') {
      const tweetId = interaction.fields.getTextInputValue('panel_remove_tweet_id').trim();
      try {
        await interaction.deferReply({ ephemeral: true });
        const Raid = require('./database/models/Raid');
        const User = require('./database/models/User');
        const Tweet = require('./database/models/Tweet');
        const updateLeaderboard = require('./utils/updateLeaderboard');
        const { EmbedBuilder } = require('discord.js');

        const escapedTweetId = tweetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const tweetDoc = await Tweet.findOne({ 
          tweetId: { $regex: new RegExp(`^${escapedTweetId}$`, 'i') } 
        }).sort({ postedAt: -1 });

        if (tweetDoc && tweetDoc.expiresAt && new Date() > tweetDoc.expiresAt) {
          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription(`❌ This raid has expired! You cannot remove your submission for an expired raid.`)
            ]
          });
        }

        const raid = await Raid.findOne({ 
          userId: interaction.user.id, 
          tweetId: { $regex: new RegExp(`^${escapedTweetId}$`, 'i') } 
        });

        if (!raid) {
          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription(`❌ No raid submission found for this Tweet ID (\`${tweetId}\`).`)
            ]
          });
        }

        await Raid.deleteOne({ _id: raid._id });

        const userDoc = await User.findOne({ discordId: interaction.user.id });
        const deductPoints = (raid && typeof raid.points === 'number') ? raid.points : 1;
        if (userDoc) {
          const wasApproved = raid.status === 'approved';
          if (wasApproved) {
            userDoc.points = Math.max(0, userDoc.points - deductPoints);
            userDoc.raidsApproved = Math.max(0, userDoc.raidsApproved - 1);
          }
          userDoc.raidsSubmitted = Math.max(0, userDoc.raidsSubmitted - 1);
          await userDoc.save();

          if (wasApproved) {
            updateLeaderboard(interaction.client);
          }
        }

        const totalPoints = userDoc ? userDoc.points : 0;
        const canonicalTweetId = tweetDoc ? tweetDoc.tweetId : raid.tweetId || tweetId;

        const replyEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setDescription(
            `✅ Your raid submission has been successfully deleted!\n\n` +
            `📋 **Tweet ID:** **${canonicalTweetId}**\n` +
            `💰 **Point Change:** **-${deductPoints}** (if it was approved)\n` +
            `💰 **Your current total points:** **${totalPoints}**\n\n` +
            `You can now submit a new raid for this Tweet ID.`
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [replyEmbed] });

      } catch (error) {
        console.error('Error handling panel remove raid modal submission:', error);
      }
    } else if (interaction.customId.startsWith('admin_')) {
      // Security check for all admin modal submissions
      try {
        const checkAdmin = require('./utils/checkAdmin');
        const isAdmin = await checkAdmin(interaction);
        if (!isAdmin) {
          return await interaction.reply({
            content: "❌ You do not have permission to use admin commands.",
            ephemeral: true
          });
        }

        const { EmbedBuilder } = require('discord.js');

        if (interaction.customId === 'admin_add_tweet_modal') {
          const content = interaction.fields.getTextInputValue('content').trim();
          const tweetLink = interaction.fields.getTextInputValue('tweet_link')?.trim() || null;
          const durationInput = interaction.fields.getTextInputValue('duration')?.trim();
          const points = interaction.fields.getTextInputValue('points')?.trim();
          
          // Helper to parse duration string (e.g. 1d 12h 30m)
          const parseDurationStringToMs = (str) => {
            if (!str) return null;
            const regex = /(\d+)\s*(d|h|m|days|hours|minutes|day|hour|minute)/gi;
            let matches = [...str.matchAll(regex)];
            if (matches.length === 0) {
              const num = parseInt(str);
              if (!isNaN(num) && num > 0) {
                return num * 60 * 60 * 1000; // default to hours if just a number
              }
              return null;
            }
            let totalMs = 0;
            for (const match of matches) {
              const value = parseInt(match[1]);
              const unit = match[2].toLowerCase();
              if (unit.startsWith('d')) {
                totalMs += value * 24 * 60 * 60 * 1000;
              } else if (unit.startsWith('h')) {
                totalMs += value * 60 * 60 * 1000;
              } else if (unit.startsWith('m')) {
                totalMs += value * 60 * 1000;
              }
            }
            return totalMs;
          };

          let durationMs = 24 * 60 * 60 * 1000; // default 24 hours
          if (durationInput) {
            const parsed = parseDurationStringToMs(durationInput);
            if (parsed) durationMs = parsed;
          }

          const days = Math.floor(durationMs / (24 * 60 * 60 * 1000));
          const hours = Math.floor((durationMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
          const minutes = Math.floor((durationMs % (60 * 60 * 1000)) / (60 * 1000));

          const options = {
            content,
            tweet_link: tweetLink,
            duration_days: days,
            duration_hours: hours,
            duration_minutes: minutes,
            points: points ? parseInt(points) : null
          };

          const command = require('./commands/admin/addtweet');
          const mocked = mockInteraction(interaction, options);
          await command.execute(mocked);
        } else if (interaction.customId === 'admin_add_wl_item_modal') {
          const name = interaction.fields.getTextInputValue('name').trim();
          const description = interaction.fields.getTextInputValue('description').trim();
          
          const costAndSlotsInput = interaction.fields.getTextInputValue('cost_and_slots').trim();
          const costSlotsParts = costAndSlotsInput.split('/');
          let pointCost = 0;
          let totalSlots = 0;
          if (costSlotsParts.length >= 2) {
            pointCost = parseInt(costSlotsParts[0].trim()) || 0;
            totalSlots = parseInt(costSlotsParts[1].trim()) || 0;
          } else {
            pointCost = parseInt(costAndSlotsInput) || 0;
            totalSlots = 9999;
          }

          const roleOrCreate = interaction.fields.getTextInputValue('role_or_create_name')?.trim();
          let role = null;
          let createRoleName = null;
          if (roleOrCreate) {
            const cleanRoleId = roleOrCreate.replace(/[<@&>]/g, '');
            role = interaction.guild.roles.cache.get(cleanRoleId) || await interaction.guild.roles.fetch(cleanRoleId).catch(() => null);
            if (!role) {
              role = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === roleOrCreate.toLowerCase());
              if (!role) {
                createRoleName = roleOrCreate;
              }
            }
          }

          // Helper to parse duration string (e.g. 30d 12h 30m)
          const parseDurationStringToMs = (str) => {
            if (!str) return null;
            const regex = /(\d+)\s*(d|h|m|days|hours|minutes|day|hour|minute)/gi;
            let matches = [...str.matchAll(regex)];
            if (matches.length === 0) {
              const num = parseInt(str);
              if (!isNaN(num) && num > 0) {
                return num * 24 * 60 * 60 * 1000;
              }
              return null;
            }
            let totalMs = 0;
            for (const match of matches) {
              const value = parseInt(match[1]);
              const unit = match[2].toLowerCase();
              if (unit.startsWith('d')) {
                totalMs += value * 24 * 60 * 60 * 1000;
              } else if (unit.startsWith('h')) {
                totalMs += value * 60 * 60 * 1000;
              } else if (unit.startsWith('m')) {
                totalMs += value * 60 * 1000;
              }
            }
            return totalMs;
          };

          const durationsInput = interaction.fields.getTextInputValue('durations')?.trim();
          let claimDurationMs = 30 * 24 * 60 * 60 * 1000; // default 30 days
          let marketDurationMs = null;

          if (durationsInput) {
            const parts = durationsInput.split('|');
            for (const part of parts) {
              const cleanPart = part.trim().toLowerCase();
              if (cleanPart.startsWith('role:')) {
                const val = cleanPart.replace('role:', '').trim();
                claimDurationMs = parseDurationStringToMs(val) || claimDurationMs;
              } else if (cleanPart.startsWith('market:')) {
                const val = cleanPart.replace('market:', '').trim();
                marketDurationMs = parseDurationStringToMs(val);
              } else {
                const parsed = parseDurationStringToMs(cleanPart);
                if (parsed) claimDurationMs = parsed;
              }
            }
          }

          const claimDays = Math.floor(claimDurationMs / (24 * 60 * 60 * 1000));
          const claimHours = Math.floor((claimDurationMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
          const claimMinutes = Math.floor((claimDurationMs % (60 * 60 * 1000)) / (60 * 1000));

          let marketDays = 0;
          let marketHours = 0;
          let marketMinutes = 0;
          if (marketDurationMs) {
            marketDays = Math.floor(marketDurationMs / (24 * 60 * 60 * 1000));
            marketHours = Math.floor((marketDurationMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
            marketMinutes = Math.floor((marketDurationMs % (60 * 60 * 1000)) / (60 * 1000));
          }

          const options = {
            name,
            description,
            point_cost: pointCost,
            total_slots: totalSlots,
            role,
            create_role_name: createRoleName,
            claim_duration_days: claimDays,
            claim_duration_hours: claimHours,
            claim_duration_minutes: claimMinutes,
            duration_days: marketDays || null,
            duration_hours: marketHours || null,
            duration_minutes: marketMinutes || null
          };

          const command = require('./commands/admin/addwlitem');
          const mocked = mockInteraction(interaction, options);
          await command.execute(mocked);
        } else if (interaction.customId === 'admin_edit_wl_item_modal') {
          const options = {
            name: interaction.fields.getTextInputValue('name').trim(),
            new_name: interaction.fields.getTextInputValue('new_name')?.trim() || null,
            description: interaction.fields.getTextInputValue('description')?.trim() || null,
            point_cost: interaction.fields.getTextInputValue('point_cost') ? parseInt(interaction.fields.getTextInputValue('point_cost')) : null,
            total_slots: interaction.fields.getTextInputValue('total_slots') ? parseInt(interaction.fields.getTextInputValue('total_slots')) : null
          };

          const command = require('./commands/admin/editwlitem');
          const mocked = mockInteraction(interaction, options);
          await command.execute(mocked);
        } else if (interaction.customId === 'admin_remove_wl_item_modal') {
          const deleteRoleStr = interaction.fields.getTextInputValue('delete_role')?.trim().toLowerCase();
          const deleteRole = deleteRoleStr === 'true' || deleteRoleStr === 'yes' || deleteRoleStr === '1';
          
          const options = {
            name: interaction.fields.getTextInputValue('name').trim(),
            delete_role: deleteRole
          };

          const command = require('./commands/admin/removewlitem');
          const mocked = mockInteraction(interaction, options);
          await command.execute(mocked);
        } else if (interaction.customId === 'admin_add_points_modal' || interaction.customId === 'admin_remove_points_modal') {
          const targetInput = interaction.fields.getTextInputValue('user').trim();
          const cleanId = targetInput.replace(/[<@!>]/g, '');
          let targetUser = interaction.guild.members.cache.get(cleanId)?.user || await interaction.client.users.fetch(cleanId).catch(() => null);
          
          if (!targetUser) {
            const member = interaction.guild.members.cache.find(m => m.user.username.toLowerCase() === targetInput.toLowerCase());
            targetUser = member?.user;
          }

          if (!targetUser) {
            return await interaction.reply({
              embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ Target user '${targetInput}' not found. Please provide a valid User ID or Username.`)],
              ephemeral: true
            });
          }

          const options = {
            user: targetUser,
            amount: parseInt(interaction.fields.getTextInputValue('amount')),
            reason: interaction.fields.getTextInputValue('reason')?.trim() || null
          };

          const cmdFile = interaction.customId === 'admin_add_points_modal' ? 'addpoints' : 'removepoints';
          const command = require(`./commands/admin/${cmdFile}`);
          const mocked = mockInteraction(interaction, options);
          await command.execute(mocked);
        } else if (interaction.customId === 'admin_edit_raid_points_modal') {
          const options = {
            tweet_id: interaction.fields.getTextInputValue('tweet_id').trim(),
            points: parseInt(interaction.fields.getTextInputValue('points'))
          };

          const command = require('./commands/admin/editraidpoints');
          const mocked = mockInteraction(interaction, options);
          await command.execute(mocked);
        } else if (interaction.customId === 'admin_approve_raid_modal' || interaction.customId === 'admin_reject_raid_modal') {
          const options = {
            raid_id: interaction.fields.getTextInputValue('raid_id').trim(),
            reason: interaction.fields.getTextInputValue('reason')?.trim() || null
          };

          const cmdFile = interaction.customId === 'admin_approve_raid_modal' ? 'approveraid' : 'rejectraid';
          const command = require(`./commands/admin/${cmdFile}`);
          const mocked = mockInteraction(interaction, options);
          await command.execute(mocked);
        } else if (interaction.customId === 'admin_removeraid_modal') {
          const deleteMsgStr = interaction.fields.getTextInputValue('delete_message')?.trim().toLowerCase();
          const deleteMsg = deleteMsgStr !== 'false' && deleteMsgStr !== 'no' && deleteMsgStr !== '0';

          const options = {
            tweet_id: interaction.fields.getTextInputValue('tweet_id').trim(),
            delete_message: deleteMsg
          };

          const command = require('./commands/admin/removeraid');
          const mocked = mockInteraction(interaction, options);
          await command.execute(mocked);
        } else if (interaction.customId === 'admin_edit_user_wl_modal') {
          const roleInput = interaction.fields.getTextInputValue('role').trim();
          const cleanRoleId = roleInput.replace(/[<@&>]/g, '');
          const role = interaction.guild.roles.cache.get(cleanRoleId) || await interaction.guild.roles.fetch(cleanRoleId).catch(() => null);

          if (!role) {
            return await interaction.reply({
              embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ Role '${roleInput}' not found on the server. Please provide a valid Role ID or mention.`)],
              ephemeral: true
            });
          }

          const targetInput = interaction.fields.getTextInputValue('user')?.trim();
          let targetUser = null;
          if (targetInput) {
            const cleanUserId = targetInput.replace(/[<@!>]/g, '');
            targetUser = interaction.guild.members.cache.get(cleanUserId)?.user || await interaction.client.users.fetch(cleanUserId).catch(() => null);
            if (!targetUser) {
              const member = interaction.guild.members.cache.find(m => m.user.username.toLowerCase() === targetInput.toLowerCase());
              targetUser = member?.user;
            }

            if (!targetUser) {
              return await interaction.reply({
                embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ Target user '${targetInput}' not found. Please provide a valid User ID or Username.`)],
                ephemeral: true
              });
            }
          }

          const daysStr = interaction.fields.getTextInputValue('days')?.trim();

          const options = {
            role,
            action: interaction.fields.getTextInputValue('action').trim().toLowerCase(),
            days: daysStr ? parseInt(daysStr) : null,
            user: targetUser
          };

          const command = require('./commands/admin/edituserwl');
          const mocked = mockInteraction(interaction, options);
          await command.execute(mocked);
        } else if (interaction.customId === 'admin_add_autotweet_user_modal') {
          const username = interaction.fields.getTextInputValue('twitter_username').trim().replace(/^@/, '');
          
          if (!username) {
            return await interaction.reply({
              embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ Please specify a valid Twitter username.")],
              ephemeral: true
            });
          }

          const AutoTweetConfig = require('./database/models/AutoTweetConfig');
          let configDoc = await AutoTweetConfig.findOne();
          if (!configDoc) {
            configDoc = new AutoTweetConfig({ twitterUsernames: [], isEnabled: true });
          }

          if (configDoc.twitterUsernames.some(name => name.toLowerCase() === username.toLowerCase())) {
            return await interaction.reply({
              embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ Username \`@${username}\` is already being monitored.`)],
              ephemeral: true
            });
          }

          configDoc.twitterUsernames.push(username);
          await configDoc.save();

          const statusText = configDoc.isEnabled ? '🟢 **Enabled**' : '🔴 **Disabled**';
          const usernamesList = configDoc.twitterUsernames.length > 0
            ? configDoc.twitterUsernames.map(name => `@${name}`).join(', ')
            : '*None*';

          const oldEmbed = interaction.message.embeds[0];
          const newEmbed = EmbedBuilder.from(oldEmbed)
            .setDescription(
              "Welcome to the **Raid Boss** Admin Panel! Use the buttons below to manage the bot's features and users:\n\n" +
              "📢 **Add Tweet** — Register a tweet for a raid\n" +
              "🎁 **Add WL Item** — Add a new item to the marketplace\n" +
              "✏️ **Edit WL Item** — Edit an existing marketplace item\n" +
              "🗑️ **Remove WL Item** — Deactivate/remove a marketplace item\n" +
              "➕ **Add Points** — Reward points to a member\n" +
              "➖ **Remove Points** — Deduct points from a member\n" +
              "⚙️ **Edit Raid Points** — Modify points rewarded for a specific raid\n" +
              "✅ **Approve Raid** — Manually approve a pending raid\n" +
              "❌ **Reject Raid** — Manually reject a raid submission\n" +
              "🗑️ **Delete Announcement** — Delete a raid announcement and its records\n" +
              "🎭 **Edit User WL** — Modify or remove a member's whitelist validity\n" +
              "🔄 **Update Leaderboard** — Force update the leaderboard embed\n\n" +
              `🤖 **Auto-Tweet Status:** ${statusText}\n` +
              `🐦 **Monitored Accounts:** ${usernamesList}`
            );

          await interaction.update({ embeds: [newEmbed] });
          await interaction.followUp({
            embeds: [new EmbedBuilder().setColor(0x00FF00).setDescription(`✅ Successfully added \`@${username}\` to monitored accounts list.`)],
            ephemeral: true
          });
        } else if (interaction.customId === 'admin_remove_autotweet_user_modal') {
          const username = interaction.fields.getTextInputValue('twitter_username').trim().replace(/^@/, '');

          if (!username) {
            return await interaction.reply({
              embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ Please specify a valid Twitter username.")],
              ephemeral: true
            });
          }

          const AutoTweetConfig = require('./database/models/AutoTweetConfig');
          let configDoc = await AutoTweetConfig.findOne();
          if (!configDoc || !configDoc.twitterUsernames.some(name => name.toLowerCase() === username.toLowerCase())) {
            return await interaction.reply({
              embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ Username \`@${username}\` is not in the monitored accounts list.`)],
              ephemeral: true
            });
          }

          configDoc.twitterUsernames = configDoc.twitterUsernames.filter(name => name.toLowerCase() !== username.toLowerCase());
          await configDoc.save();

          const statusText = configDoc.isEnabled ? '🟢 **Enabled**' : '🔴 **Disabled**';
          const usernamesList = configDoc.twitterUsernames.length > 0
            ? configDoc.twitterUsernames.map(name => `@${name}`).join(', ')
            : '*None*';

          const oldEmbed = interaction.message.embeds[0];
          const newEmbed = EmbedBuilder.from(oldEmbed)
            .setDescription(
              "Welcome to the **Raid Boss** Admin Panel! Use the buttons below to manage the bot's features and users:\n\n" +
              "📢 **Add Tweet** — Register a tweet for a raid\n" +
              "🎁 **Add WL Item** — Add a new item to the marketplace\n" +
              "✏️ **Edit WL Item** — Edit an existing marketplace item\n" +
              "🗑️ **Remove WL Item** — Deactivate/remove a marketplace item\n" +
              "➕ **Add Points** — Reward points to a member\n" +
              "➖ **Remove Points** — Deduct points from a member\n" +
              "⚙️ **Edit Raid Points** — Modify points rewarded for a specific raid\n" +
              "✅ **Approve Raid** — Manually approve a pending raid\n" +
              "❌ **Reject Raid** — Manually reject a raid submission\n" +
              "🗑️ **Delete Announcement** — Delete a raid announcement and its records\n" +
              "🎭 **Edit User WL** — Modify or remove a member's whitelist validity\n" +
              "🔄 **Update Leaderboard** — Force update the leaderboard embed\n\n" +
              `🤖 **Auto-Tweet Status:** ${statusText}\n` +
              `🐦 **Monitored Accounts:** ${usernamesList}`
            );

          await interaction.update({ embeds: [newEmbed] });
          await interaction.followUp({
            embeds: [new EmbedBuilder().setColor(0x00FF00).setDescription(`✅ Successfully removed \`@${username}\` from monitored accounts list.`)],
            ephemeral: true
          });
        }
      } catch (error) {
        console.error('Error handling admin modal submission:', error);
      }
    }
  } else if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'marketplace_claim_select') {
      try {
        const itemName = interaction.values[0];
        const handleClaimWhitelist = require('./utils/handleClaimWhitelist');
        await handleClaimWhitelist(interaction, itemName);
      } catch (error) {
        console.error('Error handling whitelist claim select menu:', error);
      }
    }
  }
});

// Auto-Tweet RSS Poller Helpers
const NITTER_INSTANCES = [
  'nitter.privacydev.net',
  'nitter.poast.org',
  'nitter.neilzone.co.uk',
  'nitter.inpt.people.ua',
  'nitter.cz',
  'nitter.esma.work'
];

function fetchWithFallback(username) {
  const https = require('https');
  const shuffled = [...NITTER_INSTANCES].sort(() => 0.5 - Math.random());
  
  const tryInstance = (index) => {
    if (index >= shuffled.length) {
      return Promise.reject(new Error("All Nitter instances failed to fetch RSS feed."));
    }
    const instance = shuffled[index];
    const url = `https://${instance}/${username}/rss`;
    
    return new Promise((resolve, reject) => {
      const req = https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 10000
      }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Status code ${res.statusCode}`));
          return;
        }
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => { resolve({ xml: data, instance }); });
      });
      
      req.on('error', (err) => { reject(err); });
      req.on('timeout', () => {
        req.destroy();
        reject(new Error("Timeout"));
      });
    }).catch(err => {
      console.warn(`[Auto-Tweet Poller] Failed to fetch from ${instance} for ${username}: ${err.message}`);
      return tryInstance(index + 1);
    });
  };
  
  return tryInstance(0);
}

function parseNitterRss(xmlText, username) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemContent = match[1];
    
    const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/);
    let link = linkMatch ? linkMatch[1].trim() : '';
    link = link.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
    link = link.replace(/&amp;/g, '&');
    
    const titleMatch = itemContent.match(/<title>([\s\S]*?)<\/title>/);
    let title = titleMatch ? titleMatch[1].trim() : '';
    title = title.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();

    const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const pubDate = pubDateMatch ? new Date(pubDateMatch[1].trim()) : new Date();

    if (link) {
      items.push({ link, title, pubDate });
    }
  }
  return items;
}

function fetchTweetData(username, statusId) {
  const https = require('https');
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

async function pollAutoTweets(client) {
  try {
    const AutoTweetConfig = require('./database/models/AutoTweetConfig');
    const Tweet = require('./database/models/Tweet');
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    
    const configDoc = await AutoTweetConfig.findOne();
    if (!configDoc || !configDoc.isEnabled || !configDoc.twitterUsernames || configDoc.twitterUsernames.length === 0) {
      return;
    }

    const tweetChannelIdString = config.tweetChannelId || '';
    const tweetChannelIds = tweetChannelIdString.split(',').map(id => id.trim()).filter(Boolean);
    if (tweetChannelIds.length === 0) {
      console.warn('[Auto-Tweet Poller] No TWEET_CHANNEL_ID configured.');
      return;
    }

    for (const username of configDoc.twitterUsernames) {
      try {
        const fetchResult = await fetchWithFallback(username).catch(() => null);
        if (!fetchResult) {
          continue;
        }

        const { xml } = fetchResult;
        const parsedItems = parseNitterRss(xml, username);

        if (parsedItems.length === 0) {
          continue;
        }

        const statusIdRegex = new RegExp(`/${username}/status/(\\d+)`, 'i');
        const itemsWithStatus = parsedItems.map(item => {
          const match = item.link.match(statusIdRegex);
          return match ? { ...item, statusId: match[1] } : null;
        }).filter(Boolean);

        if (itemsWithStatus.length === 0) {
          continue;
        }

        const lastCheckedId = configDoc.lastCheckedTweets.get(username);

        if (!lastCheckedId) {
          let highestId = itemsWithStatus[0].statusId;
          for (const item of itemsWithStatus) {
            if (BigInt(item.statusId) > BigInt(highestId)) {
              highestId = item.statusId;
            }
          }
          configDoc.lastCheckedTweets.set(username, highestId);
          await configDoc.save();
          console.log(`[Auto-Tweet Poller] Initialized tracking for @${username} at status ID: ${highestId}`);
          continue;
        }

        const newTweets = itemsWithStatus.filter(item => BigInt(item.statusId) > BigInt(lastCheckedId));
        if (newTweets.length === 0) {
          continue;
        }

        newTweets.sort((a, b) => {
          const diff = BigInt(a.statusId) - BigInt(b.statusId);
          return diff < 0n ? -1 : diff > 0n ? 1 : 0;
        });

        console.log(`[Auto-Tweet Poller] Found ${newTweets.length} new tweets for @${username}. Processing...`);

        let lastProcessedId = lastCheckedId;

        for (const tweet of newTweets) {
          const { statusId, title } = tweet;
          const originalTweetLink = `https://twitter.com/${username}/status/${statusId}`;
          const finalTweetLink = `https://fxtwitter.com/${username}/status/${statusId}`;
          const cleanText = title || 'New Tweet';

          let tweetData = null;
          try {
            tweetData = await fetchTweetData(username, statusId);
          } catch (apiError) {
            console.warn(`[Auto-Tweet Poller] FxTwitter API error for ${username}/status/${statusId}: ${apiError.message}`);
          }

          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
          const unixTimestamp = Math.floor(expiresAt.getTime() / 1000);

          for (const channelId of tweetChannelIds) {
            try {
              const channel = client.channels.cache.get(channelId) || await client.channels.fetch(channelId).catch(() => null);
              if (!channel) {
                continue;
              }

              const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setFooter({
                  text: `Tweet ID: ${statusId} • Auto-Tweet`,
                  iconURL: client.user.displayAvatarURL({ dynamic: true })
                })
                .setTimestamp();

              let messageText = '';
              if (finalTweetLink) {
                messageText = `[.](${finalTweetLink})`;
              }

              if (tweetData) {
                if (tweetData.author) {
                  embed.setAuthor({
                    name: `${tweetData.author.name} (@${tweetData.author.screen_name})`,
                    iconURL: tweetData.author.avatar_url,
                    url: tweetData.url || originalTweetLink
                  });
                } else {
                  embed.setAuthor({
                    name: `New Raid Announcement (@${username})`,
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                  });
                }

                let desc = '';
                if (tweetData.text) {
                  desc += `> ${tweetData.text.replace(/\n/g, '\n> ')}\n\n`;
                }
                desc += `📊 **Raid Details:**\n`;
                desc += `> 💰 **Reward:** \`1 Point\`\n`;
                desc += `> ⏰ **Ends At:** <t:${unixTimestamp}:f>\n`;
                desc += `> ⌛ **Time Left:** <t:${unixTimestamp}:R>\n\n\n`;
                desc += `💬 ${tweetData.replies || 0}   🔁 ${tweetData.retweets || 0}   ❤️ ${tweetData.likes || 0}   👁️ ${tweetData.views || 0}`;
                embed.setDescription(desc);

                if (tweetData.media && tweetData.media.all && tweetData.media.all.length > 0) {
                  const photo = tweetData.media.all.find(m => m.type === 'photo' || m.type === 'image');
                  if (photo && photo.url) {
                    embed.setImage(photo.url);
                  }
                }
              } else {
                embed.setAuthor({
                  name: `New Raid Announcement (@${username})`,
                  iconURL: client.user.displayAvatarURL({ dynamic: true })
                });

                let desc = '';
                if (cleanText) {
                  desc += `> ${cleanText.replace(/\n/g, '\n> ')}\n\n`;
                }
                desc += `📊 **Raid Details:**\n`;
                desc += `> 💰 **Reward:** \`1 Point\`\n`;
                desc += `> ⏰ **Ends At:** <t:${unixTimestamp}:f>\n`;
                desc += `> ⌛ **Time Left:** <t:${unixTimestamp}:R>\n\n\n`;
                embed.setDescription(desc);
              }

              const twitterRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setLabel('Like')
                  .setEmoji('❤️')
                  .setURL(originalTweetLink)
                  .setStyle(ButtonStyle.Link),
                new ButtonBuilder()
                  .setLabel('Retweet')
                  .setEmoji('🔁')
                  .setURL(originalTweetLink)
                  .setStyle(ButtonStyle.Link)
              );

              const botRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setLabel('Submit Raid')
                  .setEmoji('⚔️')
                  .setCustomId(`submit_raid_btn_${statusId}`)
                  .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                  .setLabel('Copy Tweet ID')
                  .setEmoji('📋')
                  .setCustomId(`copy_tweet_id_${statusId}`)
                  .setStyle(ButtonStyle.Secondary)
              );

              const sentMessage = await channel.send({
                content: messageText || undefined,
                embeds: [embed],
                components: [twitterRow, botRow]
              });

              const newTweetDoc = new Tweet({
                tweetId: statusId,
                content: cleanText,
                imageUrl: originalTweetLink,
                postedBy: 'Auto-Tweet',
                channelId: channelId,
                expiresAt: expiresAt,
                points: 1,
                messageId: sentMessage.id
              });
              await newTweetDoc.save();
              console.log(`[Auto-Tweet Poller] Posted tweet ${statusId} to channel ${channelId}`);
            } catch (postError) {
              console.error(`[Auto-Tweet Poller] Failed to post tweet ${statusId} to channel ${channelId}:`, postError);
            }
          }

          lastProcessedId = statusId;
        }

        configDoc.lastCheckedTweets.set(username, lastProcessedId);
        await configDoc.save();
      } catch (err) {
        console.error(`[Auto-Tweet Poller] Error checking @${username}:`, err);
      }
    }
  } catch (error) {
    console.error('[Auto-Tweet Poller] Global poller error:', error);
  }
}

// Bot ready event
client.once('ready', async () => {
  console.log("✅ Marketplace Boss Bot online!");
  await updateMarketplace(client);
  await updateLeaderboard(client);
  
  try {
    const updateMemberPanel = require('./utils/updateMemberPanel');
    await updateMemberPanel(client);
  } catch (err) {
    console.error('Error running updateMemberPanel on startup:', err);
  }
  
  // Periodically check for expired whitelist roles (every 1 minute)
  await checkExpiredRoles(client);
  setInterval(() => checkExpiredRoles(client), 60 * 1000);

  // Set up Auto-Tweet RSS Poller (every 5 minutes)
  setTimeout(() => pollAutoTweets(client), 10 * 1000); // 10s after startup
  setInterval(() => pollAutoTweets(client), 5 * 60 * 1000); // every 5 minutes
});

// Keep-alive HTTP Server for 24/7 Hosting (Render/Koyeb)
const http = require('http');
http.createServer((req, res) => {
  res.write("Bot is running!");
  res.end();
}).listen(process.env.PORT || 3000, () => {
  console.log("📡 Keep-alive server is listening on port " + (process.env.PORT || 3000));
});

// Bot startup lifecycle
(async () => {
  try {
    // 1. Connect to MongoDB Atlas
    await connectDB();
    
    // 2. Login to Discord
    if (!config.discordToken || config.discordToken.includes('your_token_here')) {
      throw new Error("DISCORD_TOKEN is not configured or contains placeholder in .env file.");
    }
    
    await client.login(config.discordToken);
  } catch (error) {
    console.error("❌ Bot startup failed:", error.message);
    process.exit(1);
  }
})();
