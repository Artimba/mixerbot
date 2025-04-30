import { getSongById, updateSong, addGenreToSong } from './crud.js';

const API_KEY = process.env.LASTFM_API_KEY;
const BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

const fetchJson = async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
    }
    return response.json();
}

const buildQuery = p => `${BASE_URL}?${new URLSearchParams(p).toString()}`;

const cleanArtistName = raw => {
    if (!raw) return raw;
    // Strips common suffixes from youtube channel names
    return raw
        .replace(/\s*-\s*Topic$/i, '')
        .replace(/vevo$/i, '')
        .replace(/official(?:\s+audio|\s+video)?$/i, '')
        .trim();
};


async function fetchTrackInfo({ title, artist }) {
    if (!title) throw new Error('Title is required');
    if (!artist) throw new Error('Artist is required');
    
    // Clean artist name
    artist = cleanArtistName(artist);

    try {
        const data = await fetchJson(buildQuery({
            method: 'track.getInfo', api_key: API_KEY, artist: artist, track: title,
            autocorrect: '1', format: 'json'
        }));

        // debug print
        console.log('Last.fm data:', JSON.stringify(data, null, 2));
        if (data.track) return data.track;
    }
    catch (err) {
        console.error('Error fetching track info:', err);
        throw new Error('Failed to fetch track info from Last.fm');
    }
    // fallback: search by title
    console.log(`No exact match for "${title}" by "${artist}". Trying search...`);
    try {
        const search = await fetchJson(buildQuery({
            method: 'track.search', api_key: API_KEY, track: title,
            format: 'json', limit: '1'
        }));
        const m = search?.results?.trackmatches?.track?.[0];
        if (m) {
            const info = await fetchJson(buildQuery({
                method: 'track.getInfo', api_key: API_KEY, artist: m.artist, track: m.name,
                autocorrect: '1', format: 'json'
            }));
            // debug print
            console.log('Last.fm search data:', JSON.stringify(info, null, 2));
            if (info.track) return info.track;
        }
    } catch (err) {
        console.error('Error during search:', err);
    }
    // no track found, no metadata available
    console.warn(`No metadata found for "${title}" by "${artist}"`);
    return null;
}

function parseTrack(track) {
    if (!track) return null;
    const meta = {
      album:   track.album?.title ?? null,
      duration: track.duration ? Math.round(+track.duration / 1000) : null,
      year: null,
      genres: (track.toptags?.tag?.map(t => t.name).filter(Boolean) ?? [])
    };

    if (track.wiki?.published) {
      const y = /\b(19|20)\d{2}\b/.exec(track.wiki.published)?.[0];
      if (y) meta.year = +y;
    }
    meta.primary_genre = meta.genres[0] ?? null;
    return meta;
}

// -------------------------

export async function getLastFmMetadata(title, artist) {
    const track = await fetchTrackInfo({ title, artist });
    return parseTrack(track);
}

export async function fetchTrackInfoById(songId) {
    const song = getSongById(songId);
    if (!song) throw new Error('Song not found');
    return fetchTrackInfo({ title: song.title, artist: song.artist });
}

export async function updateSongWithLastFmData(songId) {
    const track = await fetchTrackInfoById(songId);
    if (!track) throw new Error('No Last.fm data found');
    const fields = {};
    if (track.album?.title)  fields.album    = track.album.title;
    if (track.wiki?.published) {
        const y = /\b(19|20)\d{2}\b/.exec(track.wiki.published)?.[0];
        if (y) fields.year = +y;
    }

    // genres -----------------------------------------------------------
    const tags = track.toptags?.tag?.map(t => t.name).filter(Boolean) || [];
    if (tags.length) {
        fields.primary_genre = tags[0]; // Save the top tag to primary_genre
        for (const g of tags) addGenreToSong(songId, g);
    }

    return Object.keys(fields).length ? updateSong(songId, fields) : 0;
}

// Update song with Last.fm data with direct track name and artist

export default {
    getLastFmMetadata,
    fetchTrackInfoById,
    updateSongWithLastFmData,
};