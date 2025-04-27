import fetch from 'node-fetch';
import { getYouTubeMetadata, extractVideoId } from './youtube.js';
import db from './db.js';

export async function fetchMusic(channelId) {
    const url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`;

    const response = await fetch(url, {
        headers: {
            Authorization: 'Bot ' + process.env.DISCORD_TOKEN,
        },
    });

    const data = await response.json();
    if (!Array.isArray(data)) {
        throw new Error('Invalid response from Discord API');
    }

    return data
        .filter(message => !message.author.bot) // Ignore bot messages
        .map(message => {
            const timestamp = new Date(message.timestamp).getTime(); // Convert ISO timestamp to milliseconds
            console.log(`Message timestamp: ${timestamp}`);
            return {
                id: message.id,
                user: {
                    id: message.author.id,
                    username: message.author.username,
                    discriminator: message.author.discriminator,
                    avatar: message.author.avatar,
                },
                content: message.content,
                timestamp, // Use the parsed timestamp
            };
        });
}

export function extractYouTubeLinks(messages) {
    const youtubeRegex = /(https?:\/\/(?:www\.)?(?:music\.)?youtube\.com\/[^\s]+)/g;

    return messages.flatMap(msg => {
        const urls = msg.content?.match(youtubeRegex);
        if (!urls || !msg.user) {
            console.log(`Skipping message: ${msg.id}`);
            return [];
        }

        return urls.map(url => ({
            url,
            user: msg.user.username,
            id: msg.user.id,
            timestamp: msg.timestamp,
        }));
    });
}

// Insert song
export async function insertSong({ url, user, timestamp }) {
    console.log('Inserting song with data:', { url, user, timestamp });
    const videoId = extractVideoId(url);
    const metadata = videoId ? await getYouTubeMetadata(videoId) : null;

    const title = metadata?.title || 'Unknown Title';
    const artist = metadata?.artist || 'Unknown Artist';
    const album = metadata?.album || 'Unknown Album';
    const genre = metadata?.genre || 'Unknown Genre';
    const duration = metadata?.duration || 0;

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO songs (title, artist, album, year, genre, duration, url, user_id, user_name, added_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      title,
      artist,
      album,
      null, // Year is not provided, so we use `null`
      genre,
      duration,
      url,
      user.id,
      user.username,
      Math.floor(timestamp / 1000) // Convert milliseconds to seconds for SQLite
    );

    console.log(`Inserted song "${title}" by ${artist}`);
}