require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, Collection, EmbedBuilder } = require('discord.js');
const http = require('http');

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
        data: new SlashCommandBuilder()
            .setName('getstat')
            .setDescription('Get R6 Siege player statistics')
            .addStringOption(option =>
                option.setName('platform')
                    .setDescription('Select platform')
                    .setRequired(true)
                    .addChoices(
                        { name: 'PC', value: 'ubi' },
                        { name: 'PlayStation', value: 'psn' },
                        { name: 'Xbox', value: 'xbl' }
                    ))
            .addStringOption(option =>
                option.setName('username')
                    .setDescription('Enter player username')
                    .setRequired(true)),
        execute: async (interaction) => {
            await interaction.deferReply();

            const platform = interaction.options.getString('platform');
            const username = interaction.options.getString('username');

            try {
                // Fetch data from Tracker.gg API
                const response = await fetch(`https://api.tracker.gg/api/v2/r6siege/standard/profile/${platform}/${encodeURIComponent(username)}`, {
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0'
                    }
                });

                if (!response.ok) {
                    if (response.status === 404) {
                        return await interaction.editReply('❌ Player not found! Please check the username and platform.');
                    }
                    return await interaction.editReply('❌ Failed to fetch player stats. Please try again later.');
                }

                const data = await response.json();

                // Extract player info
                const playerName = data.data.platformInfo.platformUserHandle;
                const avatarUrl = data.data.platformInfo.avatarUrl;

                // Find overview segment for K/D and HS%
                const overviewSegment = data.data.segments.find(s => s.type === 'overview');
                const kd = overviewSegment?.stats?.kdRatio?.displayValue || 'N/A';
                const hsPercent = overviewSegment?.stats?.headshotPercentage?.displayValue || 'N/A';
                const kills = overviewSegment?.stats?.kills?.displayValue || 'N/A';
                const deaths = overviewSegment?.stats?.deaths?.displayValue || 'N/A';
                const wins = overviewSegment?.stats?.matchesWon?.displayValue || 'N/A';
                const losses = overviewSegment?.stats?.matchesLost?.displayValue || 'N/A';
                const winRate = overviewSegment?.stats?.winPercentage?.displayValue || 'N/A';

                // Find ranked segment with rank points
                let rankInfo = null;
                let maxRankInfo = null;
                let rankedKD = 'N/A';
                let rankedWinRate = 'N/A';

                for (const segment of data.data.segments) {
                    if (segment.type === 'season' && segment.attributes.sessionType === 'ranked') {
                        if (segment.stats.rankPoints && segment.stats.rankPoints.value !== null) {
                            rankInfo = segment.stats.rankPoints.metadata;
                            maxRankInfo = segment.stats.maxRankPoints.metadata;
                            rankedKD = segment.stats.kdRatio?.displayValue || 'N/A';
                            rankedWinRate = segment.stats.winPercentage?.displayValue || 'N/A';
                            break;
                        }
                    }
                }

                // Create embed
                const embed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle(`🎮 ${playerName}'s R6 Siege Stats`)
                    .setThumbnail(avatarUrl)
                    .addFields(
                        { name: '📊 Overall Stats', value: '\u200B', inline: false },
                        { name: 'K/D Ratio', value: kd, inline: true },
                        { name: 'Headshot %', value: hsPercent, inline: true },
                        { name: 'Win Rate', value: winRate, inline: true },
                        { name: 'Kills', value: kills, inline: true },
                        { name: 'Deaths', value: deaths, inline: true },
                        { name: 'W/L', value: `${wins}/${losses}`, inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'Data from R6 Tracker' });

                // Add ranked info if available
                if (rankInfo) {
                    embed.addFields(
                        { name: '\n🏆 Ranked Stats', value: '\u200B', inline: false },
                        { name: 'Current Rank', value: rankInfo.name || 'NO RANK', inline: true },
                        { name: 'Max Rank', value: maxRankInfo?.name || 'N/A', inline: true },
                        { name: 'Ranked K/D', value: rankedKD, inline: true },
                        { name: 'Ranked Win Rate', value: rankedWinRate, inline: true }
                    );

                    if (rankInfo.imageUrl) {
                        embed.setImage(rankInfo.imageUrl);
                    }
                } else {
                    embed.addFields(
                        { name: '\n🏆 Ranked Stats', value: 'No ranked data available for current season', inline: false }
                    );
                }

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Error fetching stats:', error);
                await interaction.editReply('❌ An error occurred while fetching player stats. Please try again.');
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

const GUILD_ID = process.env.GUILD_ID;

(async () => {
    try {
        console.log('Refreshing slash commands...');
        
        if (GUILD_ID) {
            await rest.put(
                Routes.applicationGuildCommands("1465870253715099790", GUILD_ID),
                { body: commands.map(cmd => cmd.data.toJSON()) }
            );
            console.log(`Slash commands registered to guild ${GUILD_ID}!`);
        } else {
            await rest.put(
                Routes.applicationCommands("1465870253715099790"),
                { body: commands.map(cmd => cmd.data.toJSON()) }
            );
            console.log('Global slash commands registered! (may take up to 1 hour to appear)');
        }
    } catch (error) {
        console.error('Error registering commands:', error);
    }
})();

// --------------------
// Bot Ready
// --------------------
client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`Bot is in ${client.guilds.cache.size} guilds`);
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
        const reply = { content: 'There was an error executing this command!', ephemeral: true };
        if (interaction.deferred) {
            await interaction.editReply(reply);
        } else {
            await interaction.reply(reply);
        }
    }
});

// --------------------
// Health Check Server (for Render)
// --------------------
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Bot is running!');
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(PORT, () => {
    console.log(`Health check server running on port ${PORT}`);
});

// --------------------
// Login
// --------------------
client.login(process.env.DISCORD_TOKEN);
