import fetch from 'node-fetch';
import emojiRegex from 'emoji-regex';
import { getYouTubeMetadata, extractVideoId } from './youtube.js';
// import { getLastFmMetadata } from './lastfm.js';
import { getMusicBrainzMetadata } from './musicbrainz.js';
import { addGenre, addGenreToSong } from './crud.js';
import db from './db.js';

export async function fetchMusic(channelId, limit = 500) {
    const allMessages = [];
    let lastMessageId = null;

    while (allMessages.length < limit) {
        const batchSize = Math.min(100, limit - allMessages.length);
        const url = new URL(`https://discord.com/api/v10/channels/${channelId}/messages`);
        url.searchParams.set('limit', batchSize);
        if (lastMessageId) {
            url.searchParams.set('before', lastMessageId);
        }

        console.log(`Fetching ${batchSize} messages${lastMessageId ? ` before ${lastMessageId}` : ''}`);

        const response = await fetch(url.toString(), {
            headers: {
                Authorization: 'Bot ' + process.env.DISCORD_TOKEN,
            },
        });

        const data = await response.json();

        if (!Array.isArray(data)) {
            console.error('Invalid response from Discord API:', data);
            throw new Error('Invalid response from Discord API');
        }

        if (data.length === 0) {
            console.log('No more messages returned by Discord API.');
            break;
        }

        allMessages.push(...data);
        lastMessageId = data[data.length - 1].id;

        console.log(`Fetched ${data.length} messages. Total so far: ${allMessages.length}`);
    }

    return allMessages
        .filter(message => !message.author?.bot)
        .map(message => {
            const timestamp = new Date(message.timestamp).getTime();
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
                timestamp,
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
    const songId = info.lastInsertRowid;

    if (meta?.genres?.length && songId) {
        for (const genre of meta.genres) {
            addGenreToSong(songId, genre);
        }
    }

    console.log(`Inserted song "${title}" by ${artist}`);
}