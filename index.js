const { Client, GatewayIntentBits, Collection, MessageFlags} = require('discord.js');
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

console.log('🤖 Node.js Version:', process.version);

// Global error handling to prevent bot crashes on Render
client.on('error', error => {
  console.error('🛡️ Discord Client Error:', error);
});

client.on('debug', message => {
  console.log('🤖 [Gateway Debug]:', message);
});

client.on('warn', message => {
  console.warn('⚠️ [Gateway Warning]:', message);
});

process.on('unhandledRejection', error => {
  console.error('🛡️ Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('🛡️ Uncaught Exception:', error);
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
        await interaction.followUp({ content: errMessage, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content: errMessage, flags: MessageFlags.Ephemeral });
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
    // Log user activity for button clicks
    try {
      const logUserActivity = require('./utils/logUserActivity');
      let details = `Button ID: \`${interaction.customId}\``;
      const label = interaction.component?.label || '';
      if (label) {
        details += `\nButton Label: **${label}**`;
      }
      
      if (interaction.customId.startsWith('submit_raid_btn_')) {
        const tId = interaction.customId.replace('submit_raid_btn_', '');
        details += `\nAction: Submitting raid proof for Tweet ID \`${tId}\``;
      } else if (interaction.customId.startsWith('copy_tweet_id_')) {
        const tId = interaction.customId.replace('copy_tweet_id_', '');
        details += `\nAction: Copying Tweet ID \`${tId}\``;
      } else if (interaction.customId.startsWith('panel_')) {
        details += `\nAction: Interacting with Member Control Panel (\`${interaction.customId.replace('panel_', '')}\`)`;
      } else if (interaction.customId.startsWith('admin_')) {
        details += `\nAction: Interacting with Admin Control Panel (\`${interaction.customId.replace('admin_', '')}\`)`;
      }
      
      await logUserActivity(interaction.client, interaction.user, 'Button Clicked', details, interaction.channelId);
    } catch (logErr) {
      console.error('Error logging button click activity:', logErr);
    }

    if (interaction.customId.startsWith('copy_tweet_id_')) {
      const tweetId = interaction.customId.replace('copy_tweet_id_', '');
      console.log(`[Button Click] User ${interaction.user.tag} (${interaction.user.id}) clicked Copy Tweet ID button for: ${tweetId}`);
      try {
        await interaction.reply({
          content: `\`${tweetId}\``,
          flags: MessageFlags.Ephemeral
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
            flags: MessageFlags.Ephemeral
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
            flags: MessageFlags.Ephemeral
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
            flags: MessageFlags.Ephemeral
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
            flags: MessageFlags.Ephemeral
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

        const items = await MarketItem.find(query).sort({ createdAt: 1 });

        if (items.length === 0) {
          const typeStr = isWlOnly ? "whitelist ticket" : "role reward";
          return await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription(`❌ There are currently no active ${typeStr} items available for claiming.`)
            ],
            flags: MessageFlags.Ephemeral
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
          flags: MessageFlags.Ephemeral
        });

      } catch (error) {
        console.error('Error opening claim menu:', error);
        try {
          await interaction.reply({
            content: '❌ An error occurred while opening the claim menu.',
            flags: MessageFlags.Ephemeral
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
            await interaction.reply({ content: '❌ Failed to close the ticket.', flags: MessageFlags.Ephemeral });
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
            await interaction.reply({ content: '❌ Failed to reopen the ticket.', flags: MessageFlags.Ephemeral });
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
          await interaction.reply({ content: '❌ Failed to delete the ticket.', flags: MessageFlags.Ephemeral });
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
            flags: MessageFlags.Ephemeral
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
            flags: MessageFlags.Ephemeral
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

        return interaction.reply({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
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

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
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
            flags: MessageFlags.Ephemeral
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

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
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
          return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
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

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      } catch (error) {
        console.error('Error handling panel leaderboard button:', error);
      }
    } else if (interaction.customId.startsWith('admin_')) {
      // Security check for all admin buttons
      try {
        const checkAdmin = require('./utils/checkAdmin');
        const isAdmin = await checkAdmin(interaction);
        if (!isAdmin) return;

        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');

        if (interaction.customId === 'admin_raidlist') {
          const command = require('./commands/admin/raidlist');
          const mocked = mockInteraction(interaction, {});
          await command.execute(mocked);
        } else if (interaction.customId === 'admin_see_points') {
          const modal = new ModalBuilder()
            .setCustomId('admin_see_points_modal')
            .setTitle('See Points & Submissions');

          const userInput = new TextInputBuilder()
            .setCustomId('user_identifier')
            .setLabel('Discord Username, ID, or Mention')
            .setPlaceholder('Enter username, ID or mention (e.g. cipher24)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const row = new ActionRowBuilder().addComponents(userInput);
          modal.addComponents(row);
          await interaction.showModal(modal);
        } else if (interaction.customId.startsWith('admin_see_points_add_') || interaction.customId.startsWith('admin_see_points_remove_')) {
          const isAdd = interaction.customId.startsWith('admin_see_points_add_');
          const targetId = isAdd 
            ? interaction.customId.replace('admin_see_points_add_', '') 
            : interaction.customId.replace('admin_see_points_remove_', '');

          const modal = new ModalBuilder()
            .setCustomId(`admin_see_points_direct_modal_${isAdd ? 'add' : 'remove'}_${targetId}`)
            .setTitle(`${isAdd ? 'Add' : 'Remove'} Points`);

          const amountInput = new TextInputBuilder()
            .setCustomId('amount')
            .setLabel('Point Amount')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Reason (optional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(amountInput),
            new ActionRowBuilder().addComponents(reasonInput)
          );

          await interaction.showModal(modal);
        } else if (interaction.customId === 'admin_add_tweet') {
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
        } else if (interaction.customId === 'admin_copy_raiders') {
          const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
          const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("📋 Copy Raider Usernames")
            .setDescription("Choose the format you want to copy the raider details in:");

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('admin_copy_raiders_twitter')
              .setLabel('Twitter Handles')
              .setEmoji('🐦')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('admin_copy_raiders_discord')
              .setLabel('Discord Handles')
              .setEmoji('💬')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('admin_copy_raiders_both')
              .setLabel('Combined List')
              .setEmoji('📝')
              .setStyle(ButtonStyle.Success)
          );

          await interaction.reply({
            embeds: [embed],
            components: [row],
            flags: MessageFlags.Ephemeral
          });
        } else if (interaction.customId.startsWith('admin_copy_raiders_')) {
          const format = interaction.customId.replace('admin_copy_raiders_', '');
          const User = require('./database/models/User');
          const users = await User.find({}).sort({ points: -1 }) || [];

          let content = '';
          let filename = '';

          if (format === 'twitter') {
            const twitters = users
              .map(u => u.twitter?.trim())
              .filter(Boolean)
              .map(t => t.startsWith('@') ? t : `@${t}`);
            content = twitters.join('\n');
            filename = 'twitter_handles.txt';
          } else if (format === 'discord') {
            const discords = users
              .map(u => u.username?.trim())
              .filter(Boolean);
            content = discords.join('\n');
            filename = 'discord_handles.txt';
          } else if (format === 'both') {
            const Raid = require('./database/models/Raid');
            const UserRoleExpiration = require('./database/models/UserRoleExpiration');
            const MarketItem = require('./database/models/MarketItem');

            const approvedRaids = await Raid.find({ status: 'approved' });
            const expirations = await UserRoleExpiration.find({});
            const marketItems = await MarketItem.find({});
            
            const raidPointsMap = new Map();
            approvedRaids.forEach(r => {
              const current = raidPointsMap.get(r.userId) || 0;
              raidPointsMap.set(r.userId, current + (r.points || 1));
            });

            const itemCostsMap = new Map();
            marketItems.forEach(item => {
              itemCostsMap.set(item.name.toLowerCase(), item.pointCost);
            });

            const userExpirationsMap = new Map();
            expirations.forEach(exp => {
              const list = userExpirationsMap.get(exp.userId) || [];
              const cost = itemCostsMap.get(exp.itemName.toLowerCase());
              const costStr = cost ? ` (-${cost} pts)` : '';
              list.push(`${exp.itemName}${costStr}`);
              userExpirationsMap.set(exp.userId, list);
            });

            const dateStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' });

            // 1. TXT Generation
            let header = `==========================================================================================================================================================================\n`;
            header += `                                                                    CHESS SHOP - RAIDER DATABASE\n`;
            header += `==========================================================================================================================================================================\n`;
            header += `Generated on: ${dateStr} (Dhaka Time)\n`;
            header += `Total Registered Users: ${users.length}\n\n`;
            header += `--------------------------------------------------------------------------------------------------------------------------------------------------------------------------\n`;
            header += ` Rank | Discord Username     | Twitter Handle       | Total Points | Raid Points | Adjustments/Spent | Points History & Claims Details\n`;
            header += `--------------------------------------------------------------------------------------------------------------------------------------------------------------------------\n`;

            const lines = users.map((u, i) => {
              const rank = (i + 1).toString().padEnd(4);
              const username = (u.username || 'N/A').padEnd(20);
              const twRaw = u.twitter ? (u.twitter.startsWith('@') ? u.twitter : `@${u.twitter}`) : 'N/A';
              const twitter = twRaw.padEnd(20);
              const totalPoints = `${u.points} pts`.padEnd(12);
              const raidPointsVal = raidPointsMap.get(u.discordId) || 0;
              const raidPoints = `${raidPointsVal} pts`.padEnd(11);
              const adjVal = u.points - raidPointsVal;
              const adjustments = adjVal >= 0 ? `+${adjVal} pts` : `${adjVal} pts`;
              const adjString = adjustments.padEnd(17);

              let detailsArray = [];
              const claimedItems = userExpirationsMap.get(u.discordId) || [];
              if (claimedItems.length > 0) {
                detailsArray.push(...claimedItems);
              }

              if (adjVal > 0) {
                detailsArray.push(`Manual Addition (+${adjVal} pts)`);
              } else if (adjVal < 0) {
                if (claimedItems.length === 0) {
                  detailsArray.push(`Marketplace Claim / Manual Deduction (${adjVal} pts)`);
                } else {
                  detailsArray.push(`Net Adjustments/Deductions (${adjVal} pts)`);
                }
              }

              const detailsStr = detailsArray.length > 0 ? detailsArray.join('; ') : 'None';

              return ` ${rank} | ${username} | ${twitter} | ${totalPoints} | ${raidPoints} | ${adjString} | ${detailsStr}`;
            });

            let footer = `\n--------------------------------------------------------------------------------------------------------------------------------------------------------------------------\n`;
            footer += `Note: 'Adjustments/Spent' indicates manual points added (+) or points spent on marketplace/deducted (-).\n`;
            footer += `==========================================================================================================================================================================\n`;

            const txtContent = header + lines.join('\n') + footer;

            // 2. CSV Generation
            const escapeCSV = (val) => {
              if (val === null || val === undefined) return '""';
              let str = val.toString().replace(/"/g, '""');
              return `"${str}"`;
            };

            let csvLines = [];
            csvLines.push(`${escapeCSV('CHESS SHOP')}`);
            csvLines.push(`${escapeCSV('USER DATABASE & POINTS STATEMENT')}`);
            csvLines.push(`${escapeCSV(`Generated on: ${dateStr} (Dhaka Time)`)}`);
            csvLines.push(`${escapeCSV(`Total Registered Users: ${users.length}`)}`);
            csvLines.push('');

            csvLines.push([
              escapeCSV('Rank'),
              escapeCSV('Discord ID'),
              escapeCSV('Discord Username'),
              escapeCSV('Twitter Handle'),
              escapeCSV('Total Points'),
              escapeCSV('Raid Points (Earned)'),
              escapeCSV('Net Adjustments/Spent'),
              escapeCSV('Points History & Claims Details')
            ].join(','));

            users.forEach((u, i) => {
              const rank = i + 1;
              const discordId = u.discordId || 'N/A';
              const username = u.username || 'N/A';
              const twRaw = u.twitter ? (u.twitter.startsWith('@') ? u.twitter : `@${u.twitter}`) : 'N/A';
              const totalPoints = `${u.points} pts`;
              const raidPointsVal = raidPointsMap.get(u.discordId) || 0;
              const raidPoints = `${raidPointsVal} pts`;
              const adjVal = u.points - raidPointsVal;
              const adjustments = adjVal >= 0 ? `+${adjVal} pts` : `${adjVal} pts`;

              let detailsArray = [];
              const claimedItems = userExpirationsMap.get(u.discordId) || [];
              if (claimedItems.length > 0) {
                detailsArray.push(...claimedItems);
              }

              if (adjVal > 0) {
                detailsArray.push(`Manual Addition (+${adjVal} pts)`);
              } else if (adjVal < 0) {
                if (claimedItems.length === 0) {
                  detailsArray.push(`Marketplace Claim / Manual Deduction (${adjVal} pts)`);
                } else {
                  detailsArray.push(`Net Adjustments/Deductions (${adjVal} pts)`);
                }
              }

              const detailsStr = detailsArray.length > 0 ? detailsArray.join('; ') : 'None';

              csvLines.push([
                escapeCSV(rank),
                escapeCSV(discordId),
                escapeCSV(username),
                escapeCSV(twRaw),
                escapeCSV(totalPoints),
                escapeCSV(raidPoints),
                escapeCSV(adjustments),
                escapeCSV(detailsStr)
              ].join(','));
            });

            const csvContent = csvLines.join('\n');

            const { AttachmentBuilder } = require('discord.js');
            const txtBuffer = Buffer.from(txtContent, 'utf-8');
            const csvBuffer = Buffer.from(csvContent, 'utf-8');
            
            const txtAttachment = new AttachmentBuilder(txtBuffer, { name: 'chess_shop_raiders.txt' });
            const csvAttachment = new AttachmentBuilder(csvBuffer, { name: 'chess_shop_raiders.csv' });

            await interaction.reply({
              content: `✅ Here is your requested **Combined List** format raider lists (both Text and Excel/CSV formats):`,
              files: [txtAttachment, csvAttachment],
              flags: MessageFlags.Ephemeral
            });
            return;
          }

          if (!content) {
            return await interaction.reply({
              content: '❌ No user data found for this format.',
              flags: MessageFlags.Ephemeral
            });
          }

          const { AttachmentBuilder } = require('discord.js');
          const buffer = Buffer.from(content, 'utf-8');
          const attachment = new AttachmentBuilder(buffer, { name: filename });

          await interaction.reply({
            content: `✅ Here is your requested **${format.toUpperCase()}** format raider list:`,
            files: [attachment],
            flags: MessageFlags.Ephemeral
          });


        } else if (interaction.customId === 'admin_raffle_raider') {
          const modal = new ModalBuilder()
            .setCustomId('admin_raffle_raider_modal')
            .setTitle('Raffle Raider Draw');

          const winnersInput = new TextInputBuilder()
            .setCustomId('winners_count')
            .setLabel('Number of Winners')
            .setValue('1')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const minPointsInput = new TextInputBuilder()
            .setCustomId('min_points')
            .setLabel('Minimum Points Target')
            .setValue('4')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const tweetIdInput = new TextInputBuilder()
            .setCustomId('tweet_id')
            .setLabel('Raid Tweet ID (Optional)')
            .setPlaceholder('Enter tweet ID to filter by specific raid participants')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(winnersInput),
            new ActionRowBuilder().addComponents(minPointsInput),
            new ActionRowBuilder().addComponents(tweetIdInput)
          );

          await interaction.showModal(modal);
        } else if (interaction.customId === 'admin_update_leaderboard') {
          const updateLeaderboard = require('./utils/updateLeaderboard');
          updateLeaderboard(interaction.client);
          await interaction.reply({
            embeds: [new EmbedBuilder().setColor(0x00FF00).setDescription("✅ Leaderboard successfully updated!")],
            flags: MessageFlags.Ephemeral
          });


        } else if (interaction.customId === 'admin_delete_all_data') {
          const { ButtonBuilder, ButtonStyle } = require('discord.js');
          const warningEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle("⚠️ Danger Zone: Delete All Data")
            .setDescription(
              "**This action is irreversible.** The following database records will be permanently deleted:\n\n" +
              "• All raid submission records (`raids` collection)\n" +
              "• All posted tweet target announcements (`tweets` collection)\n" +
              "• Reset all user points, raidsSubmitted, and raidsApproved to 0 (`users` collection)\n" +
              "• All whitelist role expiration tracking (`userroleexpirations` collection)\n\n" +
              "To proceed, click the **Confirm Delete** button below and type the confirmation phrase."
            )
            .setTimestamp();

          const confirmButton = new ButtonBuilder()
            .setCustomId('admin_delete_all_data_confirm_btn')
            .setLabel('Confirm Delete')
            .setEmoji('🗑️')
            .setStyle(ButtonStyle.Danger);

          const actionRow = new ActionRowBuilder().addComponents(confirmButton);

          await interaction.reply({
            embeds: [warningEmbed],
            components: [actionRow],
            flags: MessageFlags.Ephemeral
          });
        } else if (interaction.customId === 'admin_delete_all_data_confirm_btn') {
          const modal = new ModalBuilder()
            .setCustomId('admin_delete_all_data_modal')
            .setTitle('Confirm Database Wipe');

          const confirmInput = new TextInputBuilder()
            .setCustomId('confirmation')
            .setLabel('Enter the phrase below to confirm:')
            .setPlaceholder('I want to Fuck Chess Dao Data Base')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(confirmInput)
          );

          await interaction.showModal(modal);
        }
      } catch (error) {
        console.error('Error handling admin button click:', error);
      }
    }
  } else if (interaction.isModalSubmit()) {
    if (interaction.customId === 'admin_see_points_modal') {
      const userIdentifier = interaction.fields.getTextInputValue('user_identifier').trim();
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const User = require('./database/models/User');
        const Raid = require('./database/models/Raid');
        const { EmbedBuilder } = require('discord.js');

        // 1. Locate the user
        let userDoc = null;
        const cleanUserId = userIdentifier.replace(/[<@!>]/g, '');

        // Try searching by exact Discord ID
        if (/^\d+$/.test(cleanUserId)) {
          userDoc = await User.findOne({ discordId: cleanUserId });
        }

        // Try searching by exact username
        if (!userDoc) {
          userDoc = await User.findOne({ username: { $regex: new RegExp(`^${userIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
        }

        // Try searching server members
        if (!userDoc) {
          const member = interaction.guild.members.cache.find(m => 
            m.user.username.toLowerCase() === userIdentifier.toLowerCase() ||
            m.user.globalName?.toLowerCase() === userIdentifier.toLowerCase()
          );
          if (member) {
            userDoc = await User.findOne({ discordId: member.id });
          }
        }

        if (!userDoc) {
          return await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription(`❌ User **${userIdentifier}** not found in the database.`)
            ]
          });
        }

        // 2. Fetch user's submissions
        const raids = await Raid.find({ userId: userDoc.discordId }).sort({ submittedAt: -1 });

        // Calculate points breakdown
        const approvedRaids = raids.filter(r => r.status === 'approved');
        const pendingRaids = raids.filter(r => r.status === 'pending');
        const rejectedRaids = raids.filter(r => r.status === 'rejected');

        const totalRaidPoints = approvedRaids.reduce((sum, r) => sum + (r.points || 1), 0);
        const otherAdjustments = userDoc.points - totalRaidPoints;

        // Fetch user avatar
        const fetchedUser = await interaction.client.users.fetch(userDoc.discordId).catch(() => null);
        const avatarUrl = fetchedUser ? fetchedUser.displayAvatarURL({ dynamic: true, size: 256 }) : null;
        const userTag = fetchedUser ? `${fetchedUser.username} (${fetchedUser.globalName || fetchedUser.username})` : userDoc.username;

        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setAuthor({
            name: `User Details: ${userTag}`,
            iconURL: avatarUrl || undefined
          })
          .setTitle(`🔍 Points & Submissions Profile`)
          .setDescription(
            `👤 **Discord Account:** <@${userDoc.discordId}> (\`${userDoc.username}\`)\n` +
            `🐦 **Linked Twitter:** ${userDoc.twitter ? `[@${userDoc.twitter}](https://x.com/${userDoc.twitter})` : '`Not Linked`'}\n` +
            `💰 **Current Total Points:** \`${userDoc.points} Points\`\n` +
            `📊 **Raids Stat:** Submitted: \`${userDoc.raidsSubmitted}\` | Approved: \`${userDoc.raidsApproved}\``
          )
          .setTimestamp();

        if (avatarUrl) {
          embed.setThumbnail(avatarUrl);
        }

        // Approved submissions list (Max 10)
        if (approvedRaids.length > 0) {
          const approvedLines = approvedRaids.slice(0, 10).map((r, i) => {
            const rawLink = r.link || '';
            const match = rawLink.match(/\[.*?\]\((.*?)\)/s) || rawLink.match(/\((http.*?)\)/s);
            const cleanLink = match ? match[1].trim() : rawLink.trim();
            const dateStr = `<t:${Math.floor(new Date(r.submittedAt).getTime() / 1000)}:f>`;
            return `**${i + 1}.** Tweet ID: [${r.tweetId}](https://x.com/i/status/${r.tweetId}) • 💰 \`${r.points || 1} pts\`\n` +
                   `   📅 Date: ${dateStr}\n` +
                   `   🔗 Proof: [View Submission](${cleanLink})`;
          });

          embed.addFields({
            name: `✅ Recent Approved Submissions (${Math.min(10, approvedRaids.length)} of ${approvedRaids.length})`,
            value: approvedLines.join('\n\n'),
            inline: false
          });
        } else {
          embed.addFields({
            name: `✅ Recent Approved Submissions`,
            value: `*No approved submissions found.*`,
            inline: false
          });
        }

        // Pending Submissions
        if (pendingRaids.length > 0) {
          const pendingLines = pendingRaids.map((r) => {
            const rawLink = r.link || '';
            const match = rawLink.match(/\[.*?\]\((.*?)\)/s) || rawLink.match(/\((http.*?)\)/s);
            const cleanLink = match ? match[1].trim() : rawLink.trim();
            return `• Tweet ID: [${r.tweetId}](https://x.com/i/status/${r.tweetId}) | Link: [View Submission](${cleanLink})`;
          });
          embed.addFields({
            name: `⏳ Pending Submissions (${pendingRaids.length})`,
            value: pendingLines.join('\n'),
            inline: false
          });
        }

        // Rejected Submissions
        if (rejectedRaids.length > 0) {
          const rejectedLines = rejectedRaids.slice(0, 5).map((r) => {
            const rawLink = r.link || '';
            const match = rawLink.match(/\[.*?\]\((.*?)\)/s) || rawLink.match(/\((http.*?)\)/s);
            const cleanLink = match ? match[1].trim() : rawLink.trim();
            return `• Link: [View Submission](${cleanLink}) | Reason: \`${r.rejectedReason || 'No reason specified'}\``;
          });
          embed.addFields({
            name: `❌ Recent Rejected Submissions (${rejectedRaids.length})`,
            value: rejectedLines.join('\n'),
            inline: false
          });
        }

        // Points Allocation / Allocation reason
        embed.addFields({
          name: `⚙️ Point Allocation Reason/Breakdown`,
          value: `• Points from Approved Raids: \`${totalRaidPoints} Points\`\n` +
                 `• Manual Adjustments / Shop Claims: \`${otherAdjustments} Points\``,
          inline: false
        });

        const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
        const actionRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`admin_see_points_add_${userDoc.discordId}`)
            .setLabel('Add Points')
            .setEmoji('➕')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`admin_see_points_remove_${userDoc.discordId}`)
            .setLabel('Remove Points')
            .setEmoji('➖')
            .setStyle(ButtonStyle.Danger)
        );

        await interaction.editReply({ embeds: [embed], components: [actionRow] });

      } catch (error) {
        console.error('Error in admin_see_points_modal submission:', error);
        try {
          await interaction.editReply({ content: '❌ An error occurred while retrieving user details.' });
        } catch (e) {}
      }
      return;
    }

    if (interaction.customId.startsWith('admin_see_points_direct_modal_')) {
      const isAdd = interaction.customId.startsWith('admin_see_points_direct_modal_add_');
      const targetId = isAdd 
        ? interaction.customId.replace('admin_see_points_direct_modal_add_', '') 
        : interaction.customId.replace('admin_see_points_direct_modal_remove_', '');
      
      const amountStr = interaction.fields.getTextInputValue('amount').trim();
      const reason = interaction.fields.getTextInputValue('reason')?.trim() || null;
      const amount = parseInt(amountStr);

      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (isNaN(amount) || amount <= 0) {
          return await interaction.editReply({
            embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ Point amount must be a positive number.")]
          });
        }

        const targetUser = await interaction.client.users.fetch(targetId).catch(() => null);
        if (!targetUser) {
          return await interaction.editReply({
            embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ Target user not found in Discord.")]
          });
        }

        const options = {
          user: targetUser,
          amount: amount,
          reason: reason
        };

        const cmdFile = isAdd ? 'addpoints' : 'removepoints';
        const command = require(`./commands/admin/${cmdFile}`);
        const mocked = mockInteraction(interaction, options);
        await command.execute(mocked);
      } catch (error) {
        console.error('Error executing direct points modal submission:', error);
        try {
          await interaction.editReply({ content: '❌ An error occurred while modifying points.' });
        } catch (e) {}
      }
      return;
    }

    if (interaction.customId.startsWith('submit_raid_modal_')) {
      const tweetId = interaction.customId.replace('submit_raid_modal_', '');
      const link = interaction.fields.getTextInputValue('proof_link').trim();
      try {
        // Defer response ephemerally
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const handleRaidSubmission = require('./utils/handleRaidSubmission');
        await handleRaidSubmission(interaction, link, tweetId);
      } catch (error) {
        console.error('Error handling submit raid modal submission:', error);
      }
    } else if (interaction.customId === 'panel_submit_raid_modal') {
      const tweetId = interaction.fields.getTextInputValue('panel_tweet_id').trim();
      const link = interaction.fields.getTextInputValue('panel_proof_link').trim();
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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
            flags: MessageFlags.Ephemeral
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
            flags: MessageFlags.Ephemeral
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

        return interaction.reply({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

      } catch (error) {
        console.error('Error handling panel set twitter modal submission:', error);
      }
    } else if (interaction.customId === 'panel_remove_raid_modal') {
      const tweetId = interaction.fields.getTextInputValue('panel_remove_tweet_id').trim();
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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
        if (!isAdmin) return;

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
              flags: MessageFlags.Ephemeral
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
              flags: MessageFlags.Ephemeral
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
                flags: MessageFlags.Ephemeral
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
        } else if (interaction.customId === 'admin_raffle_raider_modal') {
          const winnersCountStr = interaction.fields.getTextInputValue('winners_count').trim();
          const minPointsStr = interaction.fields.getTextInputValue('min_points').trim();
          const tweetId = interaction.fields.getTextInputValue('tweet_id')?.trim();

          const winnersCount = parseInt(winnersCountStr) || 1;
          const minPoints = parseInt(minPointsStr) || 0;

          await interaction.deferReply({ flags: MessageFlags.Ephemeral });

          try {
            const User = require('./database/models/User');
            const Raid = require('./database/models/Raid');

            let users = [];
            let raidsForTweet = [];

            if (tweetId) {
              const escapedTweetId = tweetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const raids = await Raid.find({ tweetId: { $regex: new RegExp(`^${escapedTweetId}$`, 'i') }, status: 'approved' });
              raidsForTweet = raids;
              const discordIds = raids.map(r => r.userId);
              users = await User.find({ discordId: { $in: discordIds } });
            } else {
              users = await User.find({});
            }

            const eligible = users.filter(u => u.points >= minPoints && u.twitter);

            if (eligible.length === 0) {
              return await interaction.editReply({
                embeds: [
                  new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setDescription(`❌ No eligible raiders found matching point threshold **>= ${minPoints}** ${tweetId ? `for Tweet ID **${tweetId}**` : ''} and with a linked Twitter handle.`)
                ]
              });
            }

            const shuffled = [...eligible];
            for (let i = shuffled.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }

            const count = Math.min(winnersCount, shuffled.length);
            const winners = shuffled.slice(0, count);

            let description = 
              `Successfully drew **${winners.length}** winner(s) from **${eligible.length}** eligible participant(s).\n\n` +
              `📊 **Raffle Details:**\n` +
              `• Minimum Points Required: \`${minPoints} Points\`\n` +
              (tweetId ? `• Filtered by Tweet ID: \`${tweetId}\`\n` : '') +
              `• Linked Twitter Account: \`Required\`\n\n` +
              `🏆 **Winners List:**\n` +
              `--------------------------------------------------\n`;

            const winnerLines = [];
            for (let i = 0; i < winners.length; i++) {
              const w = winners[i];
              const tw = w.twitter.startsWith('@') ? w.twitter : `@${w.twitter}`;
              const userRaid = tweetId ? raidsForTweet.find(r => r.userId === w.discordId) : null;
              
              let submissionStr = '';
              if (userRaid) {
                const rawLink = userRaid.link || '';
                const match = rawLink.match(/\[.*?\]\((.*?)\)/s) || rawLink.match(/\((http.*?)\)/s);
                const cleanLink = match ? match[1].trim() : rawLink.trim();
                submissionStr = ` • 🔗 [Proof Link](${cleanLink})`;
              }

              const winnerUser = await interaction.client.users.fetch(w.discordId).catch(() => null);
              const username = winnerUser ? winnerUser.username : w.username;
              const displayName = winnerUser ? `${winnerUser.globalName || winnerUser.username}` : w.username;
              
              let medal = '⭐';
              if (i === 0) medal = '🥇';
              else if (i === 1) medal = '🥈';
              else if (i === 2) medal = '🥉';

              winnerLines.push(
                `${medal} **Winner #${i + 1}:** @${username} (<@${w.discordId}>) (${displayName})\n` +
                `   [🐦 Twitter](https://x.com/${w.twitter.replace('@','')}) • 💰 \`${w.points} pts\`${submissionStr}`
              );
            }
            description += winnerLines.join('\n\n');

            const embed = new EmbedBuilder()
              .setColor(0x9B59B6)
              .setTitle("🎉 Raffle Draw Winners!")
              .setDescription(description)
              .setTimestamp();

            if (winners.length === 1) {
              const winnerUser = await interaction.client.users.fetch(winners[0].discordId).catch(() => null);
              if (winnerUser) {
                embed.setThumbnail(winnerUser.displayAvatarURL({ dynamic: true, size: 256 }));
              }
            }

            await interaction.editReply({
              embeds: [embed]
            });



          } catch (error) {
            console.error('Error executing Discord raffle draw:', error);
            await interaction.editReply({
              content: '❌ An error occurred while running the raffle draw.'
            });
          }
        } else if (interaction.customId === 'admin_delete_all_data_modal') {
          const confirmation = interaction.fields.getTextInputValue('confirmation').trim();
          if (confirmation !== "I want to Fuck Chess Dao Data Base") {
            return await interaction.reply({
              embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ Invalid confirmation phrase. Action cancelled.")],
              flags: MessageFlags.Ephemeral
            });
          }

          await interaction.deferReply({ flags: MessageFlags.Ephemeral });

          const Raid = require('./database/models/Raid');
          const Tweet = require('./database/models/Tweet');
          const User = require('./database/models/User');
          const UserRoleExpiration = require('./database/models/UserRoleExpiration');
          const updateLeaderboard = require('./utils/updateLeaderboard');

          try {
            // Delete all raids
            const raidsDelete = await Raid.deleteMany({});
            // Delete all tweets
            const tweetsDelete = await Tweet.deleteMany({});
            // Reset points and stats for all users
            const usersReset = await User.updateMany(
              {},
              {
                $set: {
                  points: 0,
                  raidsSubmitted: 0,
                  raidsApproved: 0
                }
              }
            );
            // Delete all expirations
            const expirationsDelete = await UserRoleExpiration.deleteMany({});

            // Update leaderboard
            updateLeaderboard(interaction.client);

            await interaction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setColor(0x00FF00)
                  .setTitle("🗑️ Database Reset Successful")
                  .setDescription(
                    "✅ All database raid points and target data have been successfully deleted/reset.\n\n" +
                    `• **Deleted Raids:** \`${raidsDelete.deletedCount}\`\n` +
                    `• **Deleted Tweets:** \`${tweetsDelete.deletedCount}\`\n` +
                    `• **Reset Users:** \`${usersReset.modifiedCount}\`\n` +
                    `• **Deleted Expirations:** \`${expirationsDelete.deletedCount}\``
                  )
                  .setTimestamp()
              ]
            });


          } catch (dbErr) {
            console.error('Error resetting database in modal submission:', dbErr);
            await interaction.editReply({
              embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ Failed to reset database: ${dbErr.message}`)]
            });
          }
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

  try {
    const updateActiveRaidButtons = require('./utils/updateActiveRaidButtons');
    await updateActiveRaidButtons(client);
  } catch (err) {
    console.error('Error running updateActiveRaidButtons on startup:', err);
  }
  
  // Periodically check for expired whitelist roles (every 1 minute)
  await checkExpiredRoles(client);
  setInterval(() => checkExpiredRoles(client), 60 * 1000);
});

// Keep-alive HTTP Server for 24/7 Hosting (Render/Koyeb) & Dashboard Sync API
const http = require('http');
const url = require('url');
const { EmbedBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  if (parsedUrl.pathname === '/api/bot/sync' && req.method === 'POST') {
    // 1. Authenticate with NextAuth Secret / DISCORD_CLIENT_SECRET
    const authHeader = req.headers['authorization'];
    const expectedSecret = process.env.NEXTAUTH_SECRET || process.env.DISCORD_CLIENT_SECRET;
    
    if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: Invalid credentials' }));
      return;
    }
    
    // 2. Read Request Body
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const guildId = data.guildId || process.env.DISCORD_GUILD_ID || config.guildId || '1035210317380198440';
        
        const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Guild with ID ${guildId} not found by bot` }));
          return;
        }

        if (data.action === 'update_all') {
          await updateMarketplace(client);
          await updateLeaderboard(client);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Marketplace and Leaderboard sync triggered' }));
          return;
        }



        if (data.action === 'add_role') {
          const { userId, roleId, itemName } = data;
          if (!userId || !roleId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing userId or roleId' }));
            return;
          }

          const member = await guild.members.fetch(userId).catch(() => null);
          if (!member) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Member with ID ${userId} not found in guild` }));
            return;
          }

          await member.roles.add(roleId, `Claimed whitelist item via Web: ${itemName || 'Unknown'}`);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, roleAdded: true }));
          return;
        }

        if (data.action === 'create_ticket') {
          const { userId, username, itemName } = data;
          if (!userId || !username || !itemName) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing userId, username, or itemName' }));
            return;
          }

          const cleanItemName = itemName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 15);
          const cleanUsername = username.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 15);
          const ticketChannelName = `ticket-${cleanItemName}-${cleanUsername}`;
          
          const adminRoleIds = (config.adminRoleId || '').split(',').map(id => id.trim()).filter(Boolean);
          
          const permissionOverwrites = [
            {
              id: guild.id,
              deny: ['ViewChannel']
            },
            {
              id: userId,
              allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles', 'EmbedLinks']
            },
            {
              id: client.user.id,
              allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles', 'EmbedLinks', 'ManageChannels']
            }
          ];
          
          adminRoleIds.forEach(roleId => {
            if (guild.roles.cache.has(roleId)) {
              permissionOverwrites.push({
                id: roleId,
                allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles', 'EmbedLinks', 'ManageChannels']
              });
            }
          });
          
          const ticketCategoryIds = (config.ticketCategoryId || '').split(',').map(id => id.trim()).filter(Boolean);
          let parentCategory = null;
          for (const id of ticketCategoryIds) {
            const cat = guild.channels.cache.get(id);
            if (cat && cat.type === ChannelType.GuildCategory) {
              parentCategory = cat;
              break;
            }
          }
          if (!parentCategory) {
            parentCategory = guild.channels.cache.find(c => c.name.toLowerCase().includes('ticket') && c.type === ChannelType.GuildCategory);
          }
          
          const ticketChannel = await guild.channels.create({
            name: ticketChannelName,
            type: ChannelType.GuildText,
            parent: parentCategory ? parentCategory.id : null,
            permissionOverwrites: permissionOverwrites
          });
          
          const ticketEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`🎟️ Whitelist Ticket (Web Claim) — ${itemName}`)
            .setDescription(
              `Welcome <@${userId}>!\n\n` +
              `This ticket channel has been automatically created for your claim of **${itemName}** via the Web Dashboard.\n\n` +
              `Please post screenshots or proof of your whitelist requirements here so admins can assist you.`
            )
            .setTimestamp();

          const closeButtonRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('ticket_close')
                .setLabel('Close Ticket')
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Danger)
            );

          const validAdminRoleIds = adminRoleIds.filter(roleId => guild.roles.cache.has(roleId));
          const adminMentions = validAdminRoleIds.map(roleId => `<@&${roleId}>`).join(' ');
          const pingContent = `<@${userId}>${adminMentions ? ` | ${adminMentions}` : ''}`;
            
          await ticketChannel.send({ 
            content: pingContent, 
            embeds: [ticketEmbed], 
            components: [closeButtonRow] 
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, ticketCreated: true, channelId: ticketChannel.id }));
          return;
        }

        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Unknown action: ${data.action}` }));
      } catch (err) {
        console.error('Error handling bot sync API request:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else {
    // Standard Keep-alive text response
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write("Bot is running!");
    res.end();
  }
}).listen(process.env.PORT || 3005, () => {
  console.log("📡 Keep-alive server is listening on port " + (process.env.PORT || 3005));
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
