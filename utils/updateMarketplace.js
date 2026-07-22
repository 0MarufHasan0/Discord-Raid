const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');
const MarketItem = require('../database/models/MarketItem');

/**
 * Updates the live marketplace embed message in the configured channel.
 * If a message exists, it edits it. Otherwise, it sends a new one.
 * @param {import('discord.js').Client} client 
 */
async function updateMarketplace(client) {
  try {
    const channelIdsString = config.marketplaceChannelId || '';
    const channelIds = channelIdsString.split(',').map(id => id.trim()).filter(Boolean);
    if (channelIds.length === 0) {
      console.warn('⚠️ Warning: marketplaceChannelId is not configured.');
      return;
    }

    let channelList = [];
    for (const channelId of channelIds) {
      let channel = client.channels.cache.get(channelId);
      if (!channel) {
        try {
          channel = await client.channels.fetch(channelId);
        } catch (err) {
          console.error(`❌ Error fetching marketplace channel (${channelId}):`, err.message);
          continue;
        }
      }

      if (!channel || !channel.isTextBased()) {
        console.warn(`⚠️ Warning: Marketplace channel (${channelId}) is not a text-based channel.`);
        continue;
      }
      channelList.push(channel);
    }

    if (channelList.length === 0) return;

    // Fetch active and non-expired items
    const now = new Date();
    const items = await MarketItem.find({ 
      isActive: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: now } }
      ]
    }).sort({ createdAt: 1 });

    const roleItems = items.filter(item => typeof item.roleId === 'string' && item.roleId.trim() !== '');
    const whitelistItems = items.filter(item => !(typeof item.roleId === 'string' && item.roleId.trim() !== ''));

    const embed = new EmbedBuilder()
      .setTitle("🏪 Live Whitelist Marketplace")
      .setColor(0x5865F2) // Discord Blurple
      .setTimestamp();

    if (items.length === 0) {
      embed.setDescription("🏪 **There are currently no Whitelist Roles/Items in the Marketplace.**\nWhen a new item is added, it will automatically be updated here.");
    } else {
      let desc = "Select an item using the **Claim Whitelist** or **Claim Role** button below to exchange your points.\n\n";
      
      if (roleItems.length > 0) {
        desc += `👑 ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ 👑\n`;
        desc += `🎭 **ROLE MARKETPLACE (Auto-Removed on 1st)**\n`;
        desc += `*All purchased roles will be automatically removed from your profile on the 1st of every month.*\n`;
        desc += `👑 ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ 👑\n\n`;

        roleItems.forEach(item => {
          const availableSlots = Math.max(0, item.totalSlots - item.claimedSlots);
          const slotsText = availableSlots > 0 ? `\`${availableSlots}\` left` : `**SOLD OUT**`;
          
          desc += `**🏷️ ${item.name}**\n`;
          desc += `• **Description:** ${item.description}\n`;
          desc += `• **Cost:** \`${item.pointCost}\` points\n`;
          desc += `• **Slots:** ${item.claimedSlots}/${item.totalSlots} (${slotsText})\n`;
          desc += `• **Role Reward:** <@&${item.roleId}>\n`;
          desc += `• **Role Duration:** \`Every month 1st date role reset hobe\`\n`;
          
          if (item.expiresAt) {
            const unixTimestamp = Math.floor(item.expiresAt.getTime() / 1000);
            desc += `• **Market Expiry:** <t:${unixTimestamp}:F> (<t:${unixTimestamp}:R>)\n`;
          }
          desc += `───────────────────────────────\n\n`;
        });
      }

      if (whitelistItems.length > 0) {
        desc += `🎟️ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ 🎟️\n`;
        desc += `🔑 **WHITELIST & TICKETS MARKETPLACE**\n`;
        desc += `*Claim codes or private channels using your points.*\n`;
        desc += `🎟️ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ 🎟️\n\n`;

        whitelistItems.forEach(item => {
          const availableSlots = Math.max(0, item.totalSlots - item.claimedSlots);
          const slotsText = availableSlots > 0 ? `\`${availableSlots}\` left` : `**SOLD OUT**`;
          
          desc += `**🏷️ ${item.name}**\n`;
          desc += `• **Description:** ${item.description}\n`;
          desc += `• **Cost:** \`${item.pointCost}\` points\n`;
          desc += `• **Slots:** ${item.claimedSlots}/${item.totalSlots} (${slotsText})\n`;
          desc += `• **Type:** Whitelist Ticket (Opens private channel)\n`;
          
          if (item.expiresAt) {
            const unixTimestamp = Math.floor(item.expiresAt.getTime() / 1000);
            desc += `• **Market Expiry:** <t:${unixTimestamp}:F> (<t:${unixTimestamp}:R>)\n`;
          }
          desc += `───────────────────────────────\n\n`;
        });
      }
      
      embed.setDescription(desc);
    }

    embed.setFooter({ text: "🔴 Live updates enabled • Click 'Claim Whitelist' or 'Claim Role' below to purchase" });

    // Build the components row
    const components = [];
    if (items.length > 0) {
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('open_marketplace_claim_menu_wl')
            .setLabel('Claim Whitelist')
            .setEmoji('🎟️')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('open_marketplace_claim_menu_role')
            .setLabel('Claim Role')
            .setEmoji('🎭')
            .setStyle(ButtonStyle.Primary)
        );
      components.push(row);
    }

    for (const channel of channelList) {
      // Fetch the last 50 messages to find the bot's previous marketplace embed
      let messages;
      try {
        messages = await channel.messages.fetch({ limit: 50 });
      } catch (err) {
        console.error(`❌ Error fetching messages from marketplace channel (${channel.id}):`, err.message);
        if (err.code === 50001 || err.code === 50013) {
          console.warn(`⚠️ Warning: Bot does not have permission (Missing Access/Permissions) to read/send in marketplace channel (${channel.id}).`);
          continue;
        }
        // Fallback: try to send a new message
        try {
          await channel.send({ content: "<@&1478383117776715970>", embeds: [embed], files: [], components: components });
        } catch (sendErr) {
          console.error(`❌ Fallback send failed in channel (${channel.id}):`, sendErr.message);
        }
        continue;
      }

      const botMessage = messages.find(msg => 
        msg.author.id === client.user.id && 
        msg.embeds.length > 0 && 
        (
          msg.embeds[0].title === "🏪 Live Whitelist Marketplace" || 
          msg.embeds[0].title === "🏪 Marketplace" ||
          msg.embeds[0].title === "🎭 Role Marketplace (Auto-Removed on 1st)"
        )
      );

      try {
        if (botMessage) {
          await botMessage.edit({ content: "<@&1478383117776715970>", embeds: [embed], files: [], components: components });
          console.log(`✅ Live Marketplace message updated in #${channel.name} (${channel.id})`);
        } else {
          await channel.send({ content: "<@&1478383117776715970>", embeds: [embed], files: [], components: components });
          console.log(`✅ New Live Marketplace message sent in #${channel.name} (${channel.id})`);
        }
      } catch (sendOrEditError) {
        console.error(`❌ Error sending or editing message in marketplace channel (${channel.id}):`, sendOrEditError.message);
      }
    }

  } catch (error) {
    console.error('❌ Error updating live marketplace:', error);
  }
}

module.exports = updateMarketplace;
