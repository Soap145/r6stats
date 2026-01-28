require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, Collection } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Collection for slash commands
client.commands = new Collection();

// --------------------
// Define Commands Here
// --------------------
const commands = [
    {
        // Slash command
        data: new SlashCommandBuilder()
            .setName('hello')
            .setDescription('Replies with hello!'),
        // Prefix command name
        prefix: 'hello',
        // Execute function
        execute: async (interactionOrMessage) => {
            if (interactionOrMessage.reply) {
                // If it's a message (prefix)
                interactionOrMessage.reply('Hello there!');
            } else {
                // If it's a slash command (interaction)
                await interactionOrMessage.reply('Hello there!');
            }
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('ping')
            .setDescription('Replies with pong!'),
        prefix: 'ping',
        execute: async (interactionOrMessage) => {
            if (interactionOrMessage.reply) {
                interactionOrMessage.reply('Pong!');
            } else {
                await interactionOrMessage.reply('Pong!');
            }
        }
    }
];

// Add commands to collection
commands.forEach(cmd => client.commands.set(cmd.data.name, cmd));

// --------------------
// Register Slash Commands
// --------------------
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
(async () => {
    try {
        console.log('Refreshing slash commands...');
        await rest.put(
            Routes.applicationCommands("1465870253715099790"), // your bot client ID
            { body: commands.map(cmd => cmd.data.toJSON()) }
        );
        console.log('Slash commands registered!');
    } catch (error) {
        console.error(error);
    }
})();

// --------------------
// Bot Ready
// --------------------
client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

// --------------------
// Prefix Command Listener
// --------------------
const prefix = '!';
client.on('messageCreate', message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.find(cmd => cmd.prefix === commandName);
    if (command) command.execute(message);
});

// --------------------
// Slash Command Listener
// --------------------
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error!', ephemeral: true });
    }
});

// --------------------
// Login
// --------------------
client.login(process.env.DISCORD_TOKEN);

