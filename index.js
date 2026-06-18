const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const connectDB = require('./database/db');

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
    const errMessage = "❌ একটা error হয়েছে। আবার চেষ্টা করো।";
    
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

// Bot ready event
client.once('ready', () => {
  console.log("✅ Marketplace Boss Bot online!");
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
