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

    // Create private ticket channel for the user
    let ticketCreated = false;
    let ticketChannelLink = '';
    let ticketCreationError = '';
    const guild = interaction.guild;
    if (guild) {
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
          }
        ];
        
        adminRoleIds.forEach(roleId => {
          // Only add permission overwrite if the role exists in the guild
          if (guild.roles.cache.has(roleId)) {
            permissionOverwrites.push({
              id: roleId,
              allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles', 'EmbedLinks', 'ManageChannels']
            });
          } else {
            console.warn(`⚠️ Warning: Role ID ${roleId} not found in guild ${guild.name} (${guild.id}). Skipping permission overwrite.`);
          }
        });
        
        // Find category: prioritize config.ticketCategoryId, fallback to name check
        let parentCategory = guild.channels.cache.get(config.ticketCategoryId);
        if (!parentCategory || parentCategory.type !== ChannelType.GuildCategory) {
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
        
        // Send a welcome message in the ticket channel
        const ticketEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle(`🎟️ Whitelist Ticket — ${item.name}`)
          .setDescription(
            `Welcome <@${interaction.user.id}>!\n\n` +
            `This ticket channel has been automatically created for your claim of **${item.name}**.\n\n` +
            `Please post screenshots or proof of your whitelist requirements here so admins can assist you.`
          )
          .setTimestamp();

        // Create close button
        const closeButtonRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('ticket_close')
              .setLabel('Close Ticket')
              .setEmoji('🔒')
              .setStyle(ButtonStyle.Danger)
          );

        // Ping user and existing admin roles
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

    // Try to DM the user a beautiful purchase receipt
    try {
      const ticketText = ticketChannelLink ? `\n🎟️ **Ticket Channel:** ${ticketChannelLink}` : '';
      const dmEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle("🎉 Whitelist Claimed Successfully!")
        .setDescription(
          `Congratulations! You have successfully claimed a whitelist item from the server marketplace.\n\n` +
          `🏷️ **Item Name:** **${item.name}**\n` +
          `💰 **Cost:** \`${item.pointCost}\` points\n` +
          `💳 **Remaining Points:** \`${userDoc.points}\` points\n` +
          `${ticketText}\n\n` +
          `🎟️ **Please go to the ticket channel or open a support ticket to submit your proof/screenshot.**`
        )
        .setTimestamp();
        
      await interaction.user.send({ embeds: [dmEmbed] });
    } catch (dmError) {
      console.log(`Failed to DM user ${interaction.user.username} for whitelist purchase receipt.`);
    }

    // Reply success to the claiming interaction
    const ticketDesc = ticketChannelLink 
      ? `\n🎟️ **A private support ticket channel ${ticketChannelLink} has been automatically created for you.**` 
      : `\n🎟️ **Please open a ticket to submit your proof/screenshot.**${ticketCreationError ? `\n\n⚠️ *Ticket creation error: ${ticketCreationError}*` : ''}`;

    const successEmbed = new EmbedBuilder()
      .setColor(0x00FF00) // Success green
      .setDescription(
        `✅ You have claimed '**${item.name}**'!\n` +
        `💰 **${item.pointCost}** points deducted\n` +
        `💳 Remaining points: **${userDoc.points}**\n` +
        `${ticketDesc}`
      )
      .setTimestamp();

    await sendReply(interaction, { embeds: [successEmbed], ephemeral: true });

  } catch (error) {
    console.error('Error handling whitelist claim:', error);
    await sendReply(interaction, { content: "❌ An error occurred while claiming the whitelist. Please try again.", ephemeral: true });
  }
}

module.exports = handleClaimWhitelist;
