const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags} = require('discord.js');
const checkAdmin = require('../../utils/checkAdmin');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setupcontrolpanel')
    .setDescription('Set up interactive control panels')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Select panel type (Member or Admin)')
        .setRequired(true)
        .addChoices(
          { name: 'Member Panel', value: 'member' },
          { name: 'Admin Panel', value: 'admin' }
        ))
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The channel to send the control panel to')
        .setRequired(false)),
  async execute(interaction) {
    try {
      // Check admin permissions
      const isAdmin = await checkAdmin(interaction);
      if (!isAdmin) return;

      const panelType = interaction.options.getString('type');
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

      if (!targetChannel.isTextBased()) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ The specified channel must be a text-based channel.")],
          flags: MessageFlags.Ephemeral
        });
      }

      if (panelType === 'member') {
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

        await targetChannel.send({ embeds: [embed], components: [row1, row2] });
      } else {
        const embed = new EmbedBuilder()
          .setTitle("🛠️ Admin Control Panel")
          .setDescription(
            "Welcome to the **Raid Boss** Admin Panel! Use the buttons below to manage the bot's features and users:\n\n" +
            "📢 **Add Tweet** — Register a tweet for a raid\n" +
            "🎁 **Add WL Item** — Add a new item to the marketplace\n" +
            "✏️ **Edit WL Item** — Edit an existing marketplace item\n" +
            "🗑️ **Remove WL Item** — Deactivate/remove a marketplace item\n" +
            "➕ **Add Points** — Reward points to a member\n" +
            "➖ **Remove Points** — Deduct points from a member\n" +
            "⚙️ **Edit Raid Points** — Modify points rewarded for a specific raid\n" +
            "📜 **Raid List** — View, filter, and manage raid submissions\n" +
            "🔍 **See Points** — View a member's points, submissions, and details\n" +
            "✅ **Approve Raid** — Manually approve a pending raid\n" +
            "❌ **Reject Raid** — Manually reject a raid submission\n" +
            "🗑️ **Delete Announcement** — Delete a raid announcement and its records\n" +
            "🎭 **Edit User WL** — Modify or remove a member's whitelist validity\n" +
            "🔑 **WL Purchases** — View active whitelist purchases & expiration dates\n" +
            "🔄 **Update Leaderboard** — Force update the leaderboard embed\n" +
            "🗑️ **Delete All Data** — Reset database, clear all point and raid records"
          )
          .setColor(0xE91E63)
          .setTimestamp();

        const row1 = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('admin_add_tweet')
              .setLabel('Add Tweet')
              .setEmoji('📢')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('admin_add_wl_item')
              .setLabel('Add WL Item')
              .setEmoji('🎁')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('admin_edit_wl_item')
              .setLabel('Edit WL Item')
              .setEmoji('✏️')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('admin_remove_wl_item')
              .setLabel('Remove WL Item')
              .setEmoji('🗑️')
              .setStyle(ButtonStyle.Danger)
          );

        const row2 = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('admin_add_points')
              .setLabel('Add Points')
              .setEmoji('➕')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('admin_remove_points')
              .setLabel('Remove Points')
              .setEmoji('➖')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId('admin_edit_raid_points')
              .setLabel('Raid Points')
              .setEmoji('⚙️')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('admin_raidlist')
              .setLabel('Raid List')
              .setEmoji('📜')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('admin_see_points')
              .setLabel('See Points')
              .setEmoji('🔍')
              .setStyle(ButtonStyle.Primary)
          );

        const row3 = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('admin_approve_raid')
              .setLabel('Approve Raid')
              .setEmoji('✅')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('admin_reject_raid')
              .setLabel('Reject Raid')
              .setEmoji('❌')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId('admin_removeraid')
              .setLabel('Delete Announcement')
              .setEmoji('🗑️')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('admin_edit_user_wl')
              .setLabel('Edit User WL')
              .setEmoji('🎭')
              .setStyle(ButtonStyle.Primary)
          );

        const row4 = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('admin_copy_raiders')
              .setLabel('Copy Raiders')
              .setEmoji('📋')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('admin_raffle_raider')
              .setLabel('Raffle Raider')
              .setEmoji('🏆')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('admin_view_active_wl')
              .setLabel('WL Purchases')
              .setEmoji('🔑')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('admin_update_leaderboard')
              .setLabel('Update Leaderboard')
              .setEmoji('🔄')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('admin_delete_all_data')
              .setLabel('Delete All Data')
              .setEmoji('🗑️')
              .setStyle(ButtonStyle.Danger)
          );

        await targetChannel.send({ embeds: [embed], components: [row1, row2, row3, row4] });
      }

      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x00FF00).setDescription(`✅ ${panelType === 'member' ? 'Member' : 'Admin'} Control Panel successfully sent to ${targetChannel}!`)],
        flags: MessageFlags.Ephemeral
      });



    } catch (error) {
      console.error('Error in setupcontrolpanel command:', error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: '❌ An error occurred while setting up the control panel.', flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ content: '❌ An error occurred while setting up the control panel.', flags: MessageFlags.Ephemeral });
        }
      } catch (e) {}
    }
  }
};
