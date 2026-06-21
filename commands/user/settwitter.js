const { SlashCommandBuilder, EmbedBuilder, MessageFlags} = require('discord.js');
const User = require('../../database/models/User');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('settwitter')
    .setDescription('Connect/register your Twitter/X username for raid verification')
    .addStringOption(option =>
      option.setName('username')
        .setDescription('Your Twitter/X handle/username (without @)')
        .setRequired(true)),
  async execute(interaction) {
    try {
      let twitterHandle = interaction.options.getString('username').trim();
      
      // Strip leading '@' if the user included it
      if (twitterHandle.startsWith('@')) {
        twitterHandle = twitterHandle.substring(1);
      }
      twitterHandle = twitterHandle.trim();

      // Twitter username validation rules: 1-15 characters, alphanumeric & underscores
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

      // Check if this twitter handle is already linked to another Discord user
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

      // Find and update or create the User doc
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
        .setColor(0x00FF00) // Success Green
        .setTitle("🐦 Twitter Account Connected")
        .setDescription(`✅ Successfully linked your Twitter/X account: **@${twitterHandle}**!\n\nYou can now submit raids for approval.`)
        .setTimestamp();

      return interaction.reply({ embeds: [successEmbed] });

    } catch (error) {
      console.error('Error in /settwitter command:', error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: "❌ An error occurred while linking your Twitter account.", flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ content: "❌ An error occurred while linking your Twitter account.", flags: MessageFlags.Ephemeral });
        }
      } catch (err) {
        // Silently catch errors if interaction already finished/closed
      }
    }
  }
};
