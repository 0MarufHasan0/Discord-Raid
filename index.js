const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const connectDB = require('./database/db');
const updateMarketplace = require('./utils/updateMarketplace');
const updateLeaderboard = require('./utils/updateLeaderboard');

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

// Setup command collection
client.commands = new Collection();

const commandFolders = ['admin', 'user'];
for (const folder of commandFolders) {
  const folderPath = path.join(__dirname, 'commands', folder);
  if (!fs.existsSync(folderPath)) {
    console.warn(`⚠️ Warning: Folder ${folderPath} does not exist.`);
    continue;
  }
  
  const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
  
  for (const file of commandFiles) {
    const filePath = path.join(folderPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      console.log(`📡 Loaded command: /${command.data.name} (from ${folder}/${file})`);
    } else {
      console.warn(`⚠️ Warning: The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
  }
}

// Handle slash command interactions
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`❌ No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`❌ Error executing /${interaction.commandName}:`, error);
    const errMessage = "❌ An error occurred. Please try again.";
    
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errMessage, ephemeral: true });
      }
    } catch (replyError) {
      // Silently catch in case the channel or interaction was destroyed
    }
  }
});

// Handle button and modal interactions
client.on('interactionCreate', async interaction => {
  if (interaction.isButton()) {
    if (interaction.customId.startsWith('copy_tweet_id_')) {
      const tweetId = interaction.customId.replace('copy_tweet_id_', '');
      try {
        await interaction.reply({
          content: `${tweetId}`,
          ephemeral: true
        });
      } catch (error) {
        console.error('Error replying to copy button:', error);
      }
    } else if (interaction.customId.startsWith('submit_raid_btn_')) {
      const tweetId = interaction.customId.replace('submit_raid_btn_', '');
      try {
        const User = require('./database/models/User');
        const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

        // Check if user has registered their Twitter handle
        const userDoc = await User.findOne({ discordId: interaction.user.id });
        if (!userDoc || !userDoc.twitter) {
          return await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription("❌ You must connect your Twitter/X account before submitting a raid!\n\nUse `/settwitter` to link your Twitter username first.")
            ],
            ephemeral: true
          });
        }

        // Show submit raid modal
        const modal = new ModalBuilder()
          .setCustomId(`submit_raid_modal_${tweetId}`)
          .setTitle(`Submit Raid #${tweetId}`);

        const proofInput = new TextInputBuilder()
          .setCustomId('proof_link')
          .setLabel('Paste comment/reply proof link')
          .setPlaceholder('https://x.com/yourhandle/status/com...')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const firstActionRow = new ActionRowBuilder().addComponents(proofInput);
        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);
      } catch (error) {
        console.error('Error opening submit raid modal:', error);
      }
    }
  } else if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('submit_raid_modal_')) {
      const tweetId = interaction.customId.replace('submit_raid_modal_', '');
      const link = interaction.fields.getTextInputValue('proof_link').trim();
      try {
        // Defer response ephemerally
        await interaction.deferReply({ ephemeral: true });

        const handleRaidSubmission = require('./utils/handleRaidSubmission');
        await handleRaidSubmission(interaction, link, tweetId);
      } catch (error) {
        console.error('Error handling submit raid modal submission:', error);
      }
    }
  }
});

// Bot ready event
client.once('ready', async () => {
  console.log("✅ Marketplace Boss Bot online!");
  await updateMarketplace(client);
  await updateLeaderboard(client);
});

// Keep-alive HTTP Server for 24/7 Hosting (Render/Koyeb)
const http = require('http');
http.createServer((req, res) => {
  res.write("Bot is running!");
  res.end();
}).listen(process.env.PORT || 3000, () => {
  console.log("📡 Keep-alive server is listening on port " + (process.env.PORT || 3000));
});

// Bot startup lifecycle
(async () => {
  try {
    // 1. Connect to MongoDB Atlas
    await connectDB();
    
    // 2. Login to Discord
    if (!config.discordToken || config.discordToken.includes('your_token_here')) {
      throw new Error("DISCORD_TOKEN is not configured or contains placeholder in .env file.");
    }
    
    await client.login(config.discordToken);
  } catch (error) {
    console.error("❌ Bot startup failed:", error.message);
    process.exit(1);
  }
})();
