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
    const channelId = config.marketplaceChannelId;
    if (!channelId) {
      console.warn('⚠️ Warning: marketplaceChannelId is not configured.');
      return;
    }

    let channel = client.channels.cache.get(channelId);
    if (!channel) {
      try {
        channel = await client.channels.fetch(channelId);
      } catch (err) {
        console.error(`❌ Error fetching marketplace channel (${channelId}):`, err.message);
        return;
      }
    }

    if (!channel || !channel.isTextBased()) {
      console.warn(`⚠️ Warning: Marketplace channel (${channelId}) is not a text-based channel.`);
      return;
    }

    // Fetch active and non-expired items
    const now = new Date();
    const items = await MarketItem.find({ 
      isActive: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: now } }
      ]
    }).sort({ name: 1 });

    const embed = new EmbedBuilder()
      .setTitle("🏪 Live Whitelist Marketplace")
      .setColor(0x5865F2) // Discord Blurple
      .setTimestamp();

    if (items.length === 0) {
      embed.setDescription("🏪 **There are currently no Whitelist Roles/Items in the Marketplace.**\nWhen a new item is added, it will automatically be updated here.");
    } else {
      let desc = "Select an item using the **Claim Whitelist** button below to exchange your points.\n\n";
      
      items.forEach(item => {
        const availableSlots = Math.max(0, item.totalSlots - item.claimedSlots);
        const slotsText = availableSlots > 0 ? `\`${availableSlots}\` left` : `**SOLD OUT**`;
        
        desc += `**🏷️ ${item.name}**\n`;
        desc += `• **Description:** ${item.description}\n`;
        desc += `• **Cost:** \`${item.pointCost}\` points\n`;
        desc += `• **Slots:** ${item.claimedSlots}/${item.totalSlots} (${slotsText})\n`;
        
        if (item.expiresAt) {
          const unixTimestamp = Math.floor(item.expiresAt.getTime() / 1000);
          desc += `• **Expires:** <t:${unixTimestamp}:R>\n`;
        }
        desc += `\n`;
      });
      
      embed.setDescription(desc);
    }

    embed.setFooter({ text: "🔴 Live updates enabled • Click 'Claim Whitelist' below to purchase" });

    // Build the components row
    const components = [];
    if (items.length > 0) {
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('open_marketplace_claim_menu')
            .setLabel('Claim Whitelist')
            .setEmoji('🎟️')
            .setStyle(ButtonStyle.Success)
        );
      components.push(row);
    }

    // Fetch the last 50 messages to find the bot's previous marketplace embed
    let messages;
    try {
      messages = await channel.messages.fetch({ limit: 50 });
    } catch (err) {
      console.error(`❌ Error fetching messages from marketplace channel:`, err.message);
      if (err.code === 50001 || err.code === 50013) {
        console.warn(`⚠️ Warning: Bot does not have permission (Missing Access/Permissions) to read/send in marketplace channel.`);
        return;
      }
      // Fallback: try to send a new message
      try {
        await channel.send({ embeds: [embed], components: components });
      } catch (sendErr) {
        console.error(`❌ Fallback send failed:`, sendErr.message);
      }
      return;
    }

    const botMessage = messages.find(msg => 
      msg.author.id === client.user.id && 
      msg.embeds.length > 0 && 
      (msg.embeds[0].title === "🏪 Live Whitelist Marketplace" || msg.embeds[0].title === "🏪 Marketplace")
    );

    try {
      if (botMessage) {
        await botMessage.edit({ embeds: [embed], components: components });
        console.log(`✅ Live Marketplace message updated in #${channel.name}`);
      } else {
        await channel.send({ embeds: [embed], components: components });
        console.log(`✅ New Live Marketplace message sent in #${channel.name}`);
      }
    } catch (sendOrEditError) {
      console.error(`❌ Error sending or editing message in marketplace channel:`, sendOrEditError.message);
    }

  } catch (error) {
    console.error('❌ Error updating live marketplace:', error);
  }
}

module.exports = updateMarketplace;
