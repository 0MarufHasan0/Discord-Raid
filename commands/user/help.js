const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Learn how to use the bot and view user commands'),
  async execute(interaction) {
    try {
      const welcomeEmbed = new EmbedBuilder()
        .setTitle('🤝 Marketplace Boss Bot Help Menu')
        .setDescription(
          `Welcome to the bot! This bot handles raid submissions, point tracking, and whitelists.\n\n` +
          `Please select a category below using the buttons to view the respective commands and information.`
        )
        .setColor(0x5865F2)
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('help_user_commands')
          .setLabel('User Commands')
          .setEmoji('👤')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('help_system_info')
          .setLabel('Bot Info')
          .setEmoji('ℹ️')
          .setStyle(ButtonStyle.Secondary)
      );

      const response = await interaction.reply({
        embeds: [welcomeEmbed],
        components: [row],
        flags: MessageFlags.Ephemeral
      });

      // Collector to handle buttons ephemerally
      const collector = response.createMessageComponentCollector({ time: 60000 });

      collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: '❌ You cannot interact with this menu.', flags: MessageFlags.Ephemeral });
        }

        if (i.customId === 'help_user_commands') {
          const userCommandsEmbed = new EmbedBuilder()
            .setTitle('👤 User Commands List')
            .setColor(0x5865F2)
            .setDescription('Here is a detailed list of all user commands:')
            .addFields(
              {
                name: '📋 `/submitraid link:<proof_link> tweet_id:<tweet_id>`',
                value: 'Submit proof of a completed raid (like your reply, retweet, or quote link) along with the announcement Tweet ID. Auto-approves and rewards points.'
              },
              {
                name: '🛒 `/claimwl item_name:<name>`',
                value: 'Exchange your points to claim a whitelist role or item from the marketplace.'
              },
              {
                name: '💰 `/mypoints`',
                value: 'Check your current points balance, submitted raids, and approved raids statistics.'
              },
              {
                name: '📜 `/myraidhistory`',
                value: 'View your last 5 raid submissions and their current status (Pending/Approved/Rejected).'
              },
              {
                name: '🏪 `/marketplace`',
                value: 'Browse all active marketplace items, point costs, and claimed/available slots.'
              },
              {
                name: '🏆 `/leaderboard`',
                value: 'View the server leaderboard containing the top 10 users ranked by points.'
              },
              {
                name: '🐦 `/settwitter username:<handle>`',
                value: 'Link your Twitter/X account username (without @) for automatic raid verification.'
              },
              {
                name: '🔌 `/disconnecttwitter`',
                value: 'Unlink your Twitter/X account from the bot.'
              },
              {
                name: '❌ `/removemyraid tweet_id:<tweet_id>`',
                value: 'Delete a submitted raid to fix mistakes (only if the raid is not expired). Deducts the rewarded points (if approved) and lets you resubmit.'
              }
            )
            .setTimestamp();

          await i.update({ embeds: [userCommandsEmbed], components: [row] });
        } else if (i.customId === 'help_system_info') {
          const infoEmbed = new EmbedBuilder()
            .setTitle('ℹ️ Marketplace Boss Bot Info')
            .setColor(0x5865F2)
            .setDescription(
              `This bot helps automate twitter raids and reward users with points that can be redeemed for whitelist roles in the marketplace.\n\n` +
              `• **Points Per Raid:** Dynamic (Default: 1 point)\n` +
              `• **How to Claim Whitelists:** Use \`/claimwl\` to purchase roles. Once claimed, please open a ticket with proof.\n` +
              `• **Need Help?** Contact an Administrator or open a ticket in the server.`
            )
            .setTimestamp();

          await i.update({ embeds: [infoEmbed], components: [row] });
        }
      });

      collector.on('end', () => {
        // Disable buttons after collector expires
        const disabledRow = new ActionRowBuilder().addComponents(
          row.components.map(button => ButtonBuilder.from(button).setDisabled(true))
        );
        interaction.editReply({ components: [disabledRow] }).catch(() => {});
      });

    } catch (error) {
      console.error('Error in /help command:', error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: '❌ An error occurred. Please try again.', flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ content: '❌ An error occurred. Please try again.', flags: MessageFlags.Ephemeral });
        }
      } catch (err) {}
    }
  }
};
