const { SlashCommandBuilder } = require('discord.js');
const handleRaidSubmission = require('../../utils/handleRaidSubmission');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('submitraid')
    .setDescription('Submit a social media/tweet link for raid approval')
    .addStringOption(option =>
      option.setName('link')
        .setDescription('The link of your post/tweet (proof)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('tweet_id')
        .setDescription('The Tweet ID of the raid announcement')
        .setRequired(true)),
  async execute(interaction) {
    const link = interaction.options.getString('link').trim();
    const tweetId = interaction.options.getString('tweet_id').trim();
    
    await interaction.deferReply();
    await handleRaidSubmission(interaction, link, tweetId);
  }
};
