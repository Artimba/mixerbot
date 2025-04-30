import fetch from 'node-fetch';
import emojiRegex from 'emoji-regex';
import { getYouTubeMetadata, extractVideoId } from './youtube.js';
// import { getLastFmMetadata } from './lastfm.js';
import { getMusicBrainzMetadata } from './musicbrainz.js';
import { addGenreToSong } from './crud.js';
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
        console.error('Invalid response from Discord API:', data);
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
    const youtubeRegex = /(https?:\/\/(?:www\.)?(?:music\.)?youtube\.com\/[^\s]+|https?:\/\/youtu\.be\/[^\s]+)/g;

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

function cleanTitle(title) {
    if (!title) return 'Unknown Title';
    return title
      .replace(/\s*-\s*Topic$/i, '')
      .replace(/vevo$/i, '')
      .replace(/official(?:\s+audio|\s+video)?$/i, '')
      .replace(emojiRegex(), '')
      .trim() || 'Unknown Title';
}

function cleanArtist(artist) {
    if (!artist) return 'Unknown Artist';
    return artist
        .replace(/\s*-\s*Topic$/i, '')
        .replace(/vevo$/i, '')
        .replace(/official(?:\s+audio|\s+video)?$/i, '')
        .replace(emojiRegex(), '')
        .trim() || 'Unknown Artist';
}

// Insert song
export async function insertSong({ url, user, timestamp }) {
    console.log('Inserting song with data:', { url, user, timestamp });
    const videoId = extractVideoId(url);
    const metadata = videoId ? await getYouTubeMetadata(videoId) : null;
    
    // Clean title and artist names
    const title = cleanTitle(metadata?.title);
    const artist = cleanArtist(metadata?.artist);
    // const album = metadata?.album || 'Unknown Album';
    // const primary_genre = metadata?.primary_genre || 'Unknown genre';
    const duration = metadata?.duration || 0;
    // Attempt to fetch Last.fm metadata for album, genres, and year
    console.log(`Inserting song: ${title} by ${artist}, duration: ${duration}, url: ${url}`);
    const meta = await getMusicBrainzMetadata({title, artist}) || {};
    const album = meta?.album || "Unknown Album";
    const primary_genre = meta?.primary_genre || 'Unknown Genre';
    const year = meta?.year || null;

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO songs (title, artist, album, year, primary_genre, duration, url, user_id, user_name, added_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      title,
      artist,
      album,
      null, // Year is not provided, so we use `null`
      primary_genre,
      duration,
      url,
      user.id,
      user.username,
      Math.floor(timestamp / 1000) // Convert milliseconds to seconds for SQLite
    );

    // // Retrieve the last inserted row ID
    // const songId = info.lastInsertRowid;

    // // Add rest of genres to the song
    // if (meta?.genres?.length) {
    //     for (const genre of meta.genres) {
    //         addGenreToSong({ songId, genre });
    //     }
    // }

    console.log(`Inserted song "${title}" by ${artist}`);
}