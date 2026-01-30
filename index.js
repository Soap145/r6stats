require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, Collection, EmbedBuilder } = require('discord.js');
const http = require('http');
const axios = require('axios');

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
            // Reply immediately to avoid timeout
            await interaction.reply('🔍 Fetching player stats...');

            const platform = interaction.options.getString('platform');
            const username = interaction.options.getString('username');

            try {
                // Fetch data from Tracker.gg API
                const apiUrl = `https://api.tracker.gg/api/v2/r6siege/standard/profile/${platform}/${encodeURIComponent(username)}`;
                
                const response = await axios.get(apiUrl, {
                    headers: {
                        'accept': 'application/json, text/plain, */*',
                        'accept-encoding': 'gzip, deflate, br, zstd',
                        'accept-language': 'en-US,en;q=0.9',
                        'cache-control': 'no-cache',
                        'cookie': 'cf_clearance=FCMKgdLmXh3sWEkelzuTlXdo985zCQdhH6h.5adFNos-1769401263-1.2.1.1-bAyhEcYxuOKBJ_wrwMPVCuLoGvCik9QTVa_KNVUtCGxEq34DXzMKMI8xJcagXzh3S4GWhQPdONoUmIe.oCfRkBY4QrH3Vk_PWd7rBE0AgHnH62frz8J.mW.vmw2XnvnwSswQB3wrpo7Z6ebnX2Gu7dLUtJENF4_lSorPZyMdEjDCUTmPGpCjwBtEP1G9KohESTqm0MiCGuFhQfqnorY5LngjfGibnnzKuvJOC77OsuA; __cf_bm=vDnh5xrAXFxWJRcloa87nG_Vco5ZctbB2u1qEbrB948-1769732328-1.0.1.1-Ng7qlW8dP.nCiDehWwmNpV9.0IdbRjFJJ79yeYr8_FWNIO4fZA7skQe9pe_ULLDoOuK9s75iAsZZTsj2Z8AciDBT16H5Pd6cf7CmYP8gz68TpBGOxShJods_Ba5TGmzp; __cflb=02DiuFQAkRrzD1P1mdm7CzyRFveZ6PaUWsYerqNirfYfn',
                        'origin': 'https://r6.tracker.network',
                        'pragma': 'no-cache',
                        'priority': 'u=1, i',
                        'referer': 'https://r6.tracker.network/',
                        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="144", "Brave";v="144"',
                        'sec-ch-ua-mobile': '?0',
                        'sec-ch-ua-platform': '"Windows"',
                        'sec-fetch-dest': 'empty',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-site': 'cross-site',
                        'sec-gpc': '1',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36'
                    },
                    validateStatus: function (status) {
                        return status < 500; // Don't throw on 4xx errors
                    }
                });

                if (response.status !== 200) {
                    if (response.status === 404) {
                        return await interaction.editReply(`❌ Player not found! Please check the username and platform.\n\n**Debug URL:** ${apiUrl}`);
                    }
                    if (response.status === 403) {
                        return await interaction.editReply(`❌ Access denied by Tracker.gg (403). Cookie may have expired.\n\n**Debug URL:** ${apiUrl}`);
                    }
                    return await interaction.editReply(`❌ Failed to fetch player stats (Status: ${response.status})\n\n**Debug URL:** ${apiUrl}`);
                }

                const data = response.data;

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

                await interaction.editReply({ content: '', embeds: [embed] });

            } catch (error) {
                console.error('Error fetching stats:', error);
                const apiUrl = `https://api.tracker.gg/api/v2/r6siege/standard/profile/${platform}/${encodeURIComponent(username)}`;
                await interaction.editReply(`❌ An error occurred while fetching player stats.\n\n**Debug URL:** ${apiUrl}\n**Error:** ${error.message}`);
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

