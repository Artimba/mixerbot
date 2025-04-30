import { Client, GatewayIntentBits } from 'discord.js';
import { loadChannelId } from './utils.js';
import db from './db.js';
import { getYouTubeMetadata, extractVideoId } from './youtube.js';
import { insertSong } from './mixer.js';

const targetChannelID = loadChannelId();
const recentSongs = [];


const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

client.once('ready', () => {
    console.log(`Bot is live mixing as ${client.user.tag}`);
  });

client.on('messageCreate', async (message) => {
    if (message.channel.id !== targetChannelID) return;
    if (message.author.bot) return;

    const youtubeRegex = /(https?:\/\/(?:www\.)?(?:music\.)?youtube\.com\/[^\s]+|https?:\/\/youtu\.be\/[^\s]+)/g;
    const urls = message.content.match(youtubeRegex);

    if (urls) {
        console.log(`Found ${urls.length} YouTube URLs in message from ${message.author.username}: ${urls.join(', ')}`);
        urls.forEach(url => {
        console.log(`Timestamp: ${message.createdTimestamp}`);
        insertSong({ url, user: message.author , timestamp: message.createdTimestamp });

        recentSongs.push({
            url,
            user: {
                id: message.author.id,
                username: message.author.username,
                discriminator: message.author.discriminator,
                avatar: message.author.avatarURL(),
            },
            timestamp: message.createdTimestamp,
        });
        console.log(`Added song URL: ${url} by user: ${message.author.username}`);
        });
        // Limit recent songs to the last 10 entries
        if (recentSongs.length > 10) {
            recentSongs.shift(); // Remove the oldest song
        }
    }
});

client.login(process.env.DISCORD_TOKEN);