const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const commands = [];
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
      commands.push(command.data.toJSON());
      console.log(`🔍 Found command details: ${command.data.name} (from commands/${folder}/${file})`);
    } else {
      console.warn(`⚠️ Warning: The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
  }
}

// Check configuration parameters
if (!config.discordToken || config.discordToken.includes('your_token_here')) {
  console.error('❌ Error: DISCORD_TOKEN is not configured in the .env file.');
  process.exit(1);
}
if (!config.clientId || config.clientId.includes('your_bot_client_id_here')) {
  console.error('❌ Error: CLIENT_ID is not configured in the .env file.');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(config.discordToken);

(async () => {
  try {
    console.log(`🔄 Started refreshing ${commands.length} application (/) commands globally.`);

    const data = await rest.put(
      Routes.applicationCommands(config.clientId),
      { body: commands },
    );

    console.log(`Successfully reloaded ${data.length} application (/) commands globally.`);
    for (const cmd of data) {
      console.log(`✅ Registered: /${cmd.name}`);
    }
  } catch (error) {
    console.error('❌ Error occurred while deploying commands:', error);
  }
})();
