const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function updateMemberPanel(client) {
  try {
    const channelId = '1518136821136232558';
    let channel = client.channels.cache.get(channelId);
    if (!channel) {
      try {
        channel = await client.channels.fetch(channelId);
      } catch (err) {
        console.error(`❌ Error fetching Member Panel channel (${channelId}):`, err.message);
        return;
      }
    }

    if (!channel || !channel.isTextBased()) {
      console.warn(`⚠️ Warning: Member Panel channel (${channelId}) is not a text-based channel.`);
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("⚡ Member Control Panel")
      .setDescription(
        "Welcome to the **Raid Boss** Member Panel! Use the buttons below to interact with the bot without typing any commands:\n\n" +
        "🎟️ **Submit Raid** — Submit your proof link for a tweet raid\n" +
        "🐦 **Set Twitter** — Connect/link your Twitter/X handle\n" +
        "🔌 **Disconnect Twitter** — Unlink your Twitter/X handle\n" +
        "💰 **Check My Points** — View your current points & statistics\n" +
        "📜 **My Raid History** — View your last 5 submitted raids\n" +
        "❌ **Remove My Raid** — Delete a submission to fix a mistake\n" +
        "🏆 **Leaderboard** — Show the top 10 raiders on the server"
      )
      .setColor(0x5865F2)
      .setTimestamp();

    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('panel_submit_raid')
          .setLabel('Submit Raid')
          .setEmoji('🎟️')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('panel_set_twitter')
          .setLabel('Set Twitter')
          .setEmoji('🐦')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('panel_disconnect_twitter')
          .setLabel('Disconnect Twitter')
          .setEmoji('🔌')
          .setStyle(ButtonStyle.Danger)
      );

    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('panel_my_points')
          .setLabel('My Points')
          .setEmoji('💰')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('panel_my_raid_history')
          .setLabel('Raid History')
          .setEmoji('📜')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('panel_remove_raid')
          .setLabel('Remove My Raid')
          .setEmoji('❌')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('panel_leaderboard')
          .setLabel('Leaderboard')
          .setEmoji('🏆')
          .setStyle(ButtonStyle.Secondary)
      );

    const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
    let panelMessage = null;

    if (messages) {
      panelMessage = messages.find(msg => 
        msg.author.id === client.user.id && 
        msg.embeds.length > 0 && 
        msg.embeds[0].title === "⚡ Member Control Panel"
      );
    }

    if (panelMessage) {
      await panelMessage.edit({ embeds: [embed], components: [row1, row2] });
      console.log(`✅ Member Control Panel message updated in #${channel.name}`);
    } else {
      await channel.send({ embeds: [embed], components: [row1, row2] });
      console.log(`✅ New Member Control Panel message sent in #${channel.name}`);
    }

  } catch (error) {
    console.error('❌ Error updating Member Control Panel:', error);
  }
}

module.exports = updateMemberPanel;
