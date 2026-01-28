/**
 * Simple Hello Bot
 * Simplified from original Minecraft Server Status Bot
 */

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent // REQUIRED to read messages
    ]
});

// Bot ready
client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

// Message listener
client.on('messageCreate', message => {
    // Ignore bot messages (including itself)
    if (message.author.bot) return;

    message.reply('hello');
});

// Login
client.login(process.env.DISCORD_TOKEN);
