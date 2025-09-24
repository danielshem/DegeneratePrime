const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');

// Initialize Firebase Admin SDK
admin.initializeApp();

// --- Discord Client Setup ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// --- Command Handler ---
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if (('data' in command || 'name' in command) && 'execute' in command) {
    const commandName = command.data ? command.data.name : command.name;
    client.commands.set(commandName, command);
    console.log(`Loaded command: ${commandName}`);
  } else {
    console.log(`[WARNING] A command file is missing a required "data", "name", or "execute" property.`);
  }
}

// --- Event Listeners ---
client.once('ready', () => {
  console.log(`Ready! Logged in as ${client.user.tag}`);
});

// --- LISTENER FOR SLASH (/) COMMANDS ---
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);
  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
    } else {
      await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
  }
});

// --- LISTENER FOR PREFIX (!) COMMANDS ---
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const prefix = '!';
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command = client.commands.get(commandName);
  if (!command) return;

  try {
    await command.execute(message, args);
  } catch (error) {
    console.error(`Error executing prefix command ${commandName}:`, error);
    message.reply('There was an error trying to execute that command!');
  }
});


// --- Firebase Cloud Function ---
// This function will be triggered by an HTTP request.
// We will log in to Discord only when the function is invoked.
exports.discordBot = functions.https.onRequest(async (req, res) => {
  // Use Firebase's runtime configuration for secrets
  const discordToken = functions.config().discord.token;

  if (!client.isReady()) {
    await client.login(discordToken);
  }

  // A simple response to let us know the function is alive when we hit its URL
  res.send('Function is ready. Bot is connecting to Discord...');
});
