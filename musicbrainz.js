import { addGenreToSong, getSongById, updateSong } from './crud.js';
import { getLastFmMetadata } from './lastfm.js';

const BASE_URL = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'MixerBot/1.0 (ibiswhite23@gmail.com)';

const fetchJson = async (url) => {
    const response = await fetch(url, {
        headers: {
            'User-Agent': USER_AGENT,
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
    }
    return response.json();
}

async function searchRecording({ title, artist }) {
    const params = new URLSearchParams({
        query: artist ? `recording:"${title}" AND artist:"${artist}"` : `recording:"${title}"`,
        fmt: 'json',
        limit: '5',
    });
    const url = `${BASE_URL}/recording/?${params}`;
    const data = await fetchJson(url);
    // console.log(`MusicBrainz search URL: ${url}`);
    // console.log('MusicBrainz search result:', JSON.stringify(data, null, 2));
    return data.recordings?.[0] ?? null; // pick the first hit
}

function parseMB(recording) {
    if (!recording) return null;

    const release = recording.releases?.[0];
    // console.log('Parsed MusicBrainz recording:', JSON.stringify(recording, null, 2));
    return {
        album: release?.title || 'Unknown Album',
        year: release?.date ? +release.date.slice(0, 4) : null,
        genres: (recording.tags || []).map(t => t.name).filter(Boolean),
        primary_genre: recording.tags?.[0]?.name ?? 'Unknown Genre'
    };
}

// ---------------------------

export async function getMusicBrainzMetadata({ title, artist }) {
    console.log(`Searching MusicBrainz for: "${title}" by "${artist}"`);
    // Search MusicBrainz using only recording title
    let meta = parseMB(await searchRecording({ title, artist: null }));
    console.log('Initial MusicBrainz metadata:', JSON.stringify(meta, null, 2));
    if (meta?.genres?.length) return meta;

    // If no genres found, search last.fm using title
    meta = await getLastFmMetadata(title, artist);
    if (meta?.genres?.length) return meta;

    // If still no genres, search MusicBrainz with artist
    console.log(`No genres found for "${title}", searching with artist "${artist}"`);
    meta = parseMB(await searchRecording({ title: null, artist }));

    // Forfeit, caller should prompt user to add genres manually
    return meta || null;
}

export async function updateSongWithMBData(songId) {
    const song = getSongById(songId);
    if (!song) throw new Error('Song not found');
  
    const meta = await getMusicBrainzMetadata(song.title, song.artist);
    if (!meta) throw new Error('No metadata');
  
    const fields = {};
    if (meta.album)    fields.album    = meta.album;
    if (meta.year)     fields.year     = meta.year;
    if (meta.primary_genre && !song.primary_genre) fields.primary_genre = meta.primary_genre;
  
    for (const g of meta.genres || []) addGenreToSong(songId, g);
  
    return Object.keys(fields).length ? updateSong(songId, fields) : 0;
}

export async function fetchRecordingInfoById(songId) {
    const song = getSongById(songId);
    if (!song) throw new Error('Song not found');
    return searchRecording({ title: song.title, artist: song.artist });
}
  
export default {
    getMusicBrainzMetadata,
    updateSongWithMBData,
    fetchRecordingInfoById,
};
  