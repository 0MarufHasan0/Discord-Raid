const { SlashCommandBuilder } = require('discord.js');
const handleClaimWhitelist = require('../../utils/handleClaimWhitelist');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('claimwl')
    .setDescription('Claim an item from the marketplace')
    .addStringOption(option =>
      option.setName('item_name')
        .setDescription('Name of the item you want to claim')
        .setRequired(true)),
  async execute(interaction) {
    const itemName = interaction.options.getString('item_name').trim();
    await handleClaimWhitelist(interaction, itemName);
  }
};
