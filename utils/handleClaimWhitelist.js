const { EmbedBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const MarketItem = require('../database/models/MarketItem');
const User = require('../database/models/User');
const config = require('../config');
const updateMarketplace = require('./updateMarketplace');
const updateLeaderboard = require('./updateLeaderboard');

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
 * Handles claiming a whitelist item, deducting points, DMing user, and creating a ticket channel.
 */
async function handleClaimWhitelist(interaction, itemName) {
  try {
    // Defer reply ephemerally if not already deferred
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }

    const escapedItemName = itemName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Find item (case-insensitive and must be active)
    const item = await MarketItem.findOne({ 
      name: { $regex: new RegExp(`^${escapedItemName}$`, 'i') },
      isActive: true 
    });

    if (!item) {
      return sendReply(interaction, {
        embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ No active item found with the name '${itemName}'`)]
      });
    }

    // Check if item has expired
    if (item.expiresAt && new Date() > item.expiresAt) {
      return sendReply(interaction, {
        embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ The item '${item.name}' has expired! You can no longer claim it.`)]
      });
    }

    // Check if slots are available
    if (item.claimedSlots >= item.totalSlots) {
      return sendReply(interaction, {
        embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ All slots for '${item.name}' have been claimed!`)]
      });
    }

    // Find user
    let userDoc = await User.findOne({ discordId: interaction.user.id });
    if (!userDoc) {
      userDoc = new User({
        discordId: interaction.user.id,
        username: interaction.user.username,
        points: 0
      });
      await userDoc.save();
    }

    // Check points balance
    if (userDoc.points < item.pointCost) {
      return sendReply(interaction, {
        embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ You do not have enough points!\nRequired: **${item.pointCost}** | You have: **${userDoc.points}**`)]
      });
    }

    // Atomically increment claimedSlots to avoid race conditions
    const updatedItem = await MarketItem.findOneAndUpdate(
      { _id: item._id, claimedSlots: { $lt: item.totalSlots } },
      { $inc: { claimedSlots: 1 } },
      { new: true }
    );

    if (!updatedItem) {
      return sendReply(interaction, {
        embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ All slots for '${item.name}' have been claimed!`)]
      });
    }

    // Deduct points from user
    userDoc.points -= item.pointCost;
    await userDoc.save();

    // Update live marketplace channel
    updateMarketplace(interaction.client);

    // Update live leaderboard channel
    updateLeaderboard(interaction.client);

    // Auto-assign Discord role if configured (i.e. Role Item)
    let roleAdded = false;
    let roleAddError = '';
    const guild = interaction.guild;
    if (item.roleId && guild) {
      try {
        const member = await guild.members.fetch(interaction.user.id);
        if (member) {
          await member.roles.add(item.roleId, `Purchased whitelist item: ${item.name}`);
          roleAdded = true;

          // Save expiration to database
          const UserRoleExpiration = require('../database/models/UserRoleExpiration');
          const expiresAt = new Date(Date.now() + (item.claimDurationMs || (item.claimDurationDays || 30) * 24 * 60 * 60 * 1000));
          
          await UserRoleExpiration.findOneAndUpdate(
            { userId: interaction.user.id, guildId: guild.id, roleId: item.roleId },
            { itemName: item.name, expiresAt: expiresAt, createdAt: new Date() },
            { upsert: true, new: true }
          );
        }
      } catch (roleErr) {
        console.error(`❌ Failed to automatically add role ${item.roleId} to user ${interaction.user.id}:`, roleErr);
        roleAddError = roleErr.message;
      }
    }

    // Create private ticket channel for the user (ONLY if it is NOT a Role Item)
    let ticketCreated = false;
    let ticketChannelLink = '';
    let ticketCreationError = '';
    if (guild && !item.roleId) {
      try {
        const cleanItemName = item.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 15);
        const cleanUsername = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 15);
        const ticketChannelName = `ticket-${cleanItemName}-${cleanUsername}`;
        
        const adminRoleIds = (config.adminRoleId || '').split(',').map(id => id.trim()).filter(Boolean);
        
        const permissionOverwrites = [
          {
            id: guild.id,
            deny: ['ViewChannel'] // Hide from everyone
          },
          {
            id: interaction.user.id,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles', 'EmbedLinks']
          },
          {
            id: interaction.client.user.id,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles', 'EmbedLinks', 'ManageChannels']
          }
        ];
        
        adminRoleIds.forEach(roleId => {
          if (guild.roles.cache.has(roleId)) {
            permissionOverwrites.push({
              id: roleId,
              allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles', 'EmbedLinks', 'ManageChannels']
            });
          } else {
            console.warn(`⚠️ Warning: Role ID ${roleId} not found in guild ${guild.name} (${guild.id}). Skipping permission overwrite.`);
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
        
        ticketCreated = true;
        ticketChannelLink = `<#${ticketChannel.id}>`;
        
        const ticketEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle(`🎟️ Whitelist Ticket — ${item.name}`)
          .setDescription(
            `Welcome <@${interaction.user.id}>!\n\n` +
            `This ticket channel has been automatically created for your claim of **${item.name}**.\n\n` +
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
        const pingContent = `<@${interaction.user.id}>${adminMentions ? ` | ${adminMentions}` : ''}`;
          
        await ticketChannel.send({ 
          content: pingContent, 
          embeds: [ticketEmbed], 
          components: [closeButtonRow] 
        });
      } catch (err) {
        console.error('❌ Failed to create ticket channel:', err);
        ticketCreationError = err.message;
      }
    }

    // Prepare response messages dynamically
    let receiptDescription = '';
    let responseDescription = '';

    if (item.roleId) {
      // Role Item response
      if (roleAdded) {
        const expiresAt = new Date(Date.now() + (item.claimDurationMs || (item.claimDurationDays || 30) * 24 * 60 * 60 * 1000));
        const unixTimestamp = Math.floor(expiresAt.getTime() / 1000);
        const text = `\n🎭 **Role Assigned:** <@&${item.roleId}>\n⏳ **Role Expiry:** <t:${unixTimestamp}:F> (<t:${unixTimestamp}:R>)`;
        receiptDescription = `Congratulations! You have successfully claimed a role item from the server marketplace.\n\n🏷️ **Item Name:** **${item.name}**\n💰 **Cost:** \`${item.pointCost}\` points\n💳 **Remaining Points:** \`${userDoc.points}\` points${text}`;
        responseDescription = `✅ You have claimed '**${item.name}**'!\n💰 **${item.pointCost}** points deducted\n💳 Remaining points: **${userDoc.points}**${text}`;
      } else {
        const text = `\n⚠️ **Role Assignment Failed:** ${roleAddError || "The bot might not have permissions to assign this role. Please verify bot role positions and permissions."}`;
        receiptDescription = `You claimed a role item from the server marketplace, but the role assignment failed.\n\n🏷️ **Item Name:** **${item.name}**\n💰 **Cost:** \`${item.pointCost}\` points\n💳 **Remaining Points:** \`${userDoc.points}\` points${text}`;
        responseDescription = `⚠️ You claimed '**${item.name}**', but role assignment failed.\n💰 **${item.pointCost}** points deducted\n💳 Remaining points: **${userDoc.points}**${text}`;
      }
    } else {
      // Whitelist Item response (Ticket-based)
      const ticketText = ticketChannelLink 
        ? `\n🎟️ **Ticket Channel:** ${ticketChannelLink}` 
        : `\n⚠️ **Ticket creation failed. Please contact an admin to submit your proof.**${ticketCreationError ? `\n*Error: ${ticketCreationError}*` : ''}`;

      receiptDescription = `Congratulations! You have successfully claimed a whitelist item from the server marketplace.\n\n🏷️ **Item Name:** **${item.name}**\n💰 **Cost:** \`${item.pointCost}\` points\n💳 **Remaining Points:** \`${userDoc.points}\` points${ticketText}`;
      responseDescription = `✅ You have claimed '**${item.name}**'!\n💰 **${item.pointCost}** points deducted\n💳 Remaining points: **${userDoc.points}**\n${ticketText}`;
    }

    // Try to DM the user a beautiful purchase receipt
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle(item.roleId ? "🎉 Role Claimed Successfully!" : "🎉 Whitelist Claimed Successfully!")
        .setDescription(receiptDescription)
        .setTimestamp();
        
      await interaction.user.send({ embeds: [dmEmbed] });
    } catch (dmError) {
      console.log(`Failed to DM user ${interaction.user.username} for purchase receipt.`);
    }

    // Reply success to the claiming interaction
    const successEmbed = new EmbedBuilder()
      .setColor(0x00FF00) // Success green
      .setDescription(responseDescription)
      .setTimestamp();

    await sendReply(interaction, { embeds: [successEmbed], ephemeral: true });

  } catch (error) {
    console.error('Error handling whitelist claim:', error);
    await sendReply(interaction, { content: "❌ An error occurred while claiming the whitelist. Please try again.", ephemeral: true });
  }
}

module.exports = handleClaimWhitelist;
