import db from './db.js';

// region[Song CRUD]
// INSERT song found in mixer.js

// READ/Get songs from database
export function getSongById(id) {
    const stmt = db.prepare('SELECT * FROM songs WHERE id = ?');
    return stmt.get(id);
}

export function getSongByUrl(url) {
    const stmt = db.prepare('SELECT * FROM songs WHERE url = ?');
    return stmt.get(url);
}

export function getSongsByUserId(userId) {
    const stmt = db.prepare('SELECT * FROM songs WHERE user_id = ? ORDER BY added_at DESC');
    return stmt.all(userId);
}

// UPDATE a song's details in database
export function updateSong(id, fields = {}) {
    const keys = Object.keys(fields);
    if (keys.length === 0) return;
    const set = keys.map(k => `${k} = @${k}`).join(', ');
    const stmt = db.prepare(`UPDATE songs SET ${set} WHERE id = @id`);
    return stmt.run({ id, ...fields }).changes;
}

// DELETE a song by ID
export function deleteSong(id) {
    const stmt = db.prepare('DELETE FROM songs WHERE id = ?');
    return stmt.run(id).changes;
}
// endregion
// region[Playlist CRUD]


// CREATE a new playlist
const insertPlaylist = db.prepare(`INSERT INTO playlists
    (name, description, user_id, user_name)
    VALUES (@name, @description, @user_id, @user_name)`);
export const addPlaylist = pl => insertPlaylist.run(pl).lastInsertRowid;

// READ a playlist by ID or name
export const getPlaylistById   = id   => db.prepare(`SELECT * FROM playlists WHERE id   = ?`).get(id);
export const getPlaylistByName = name => db.prepare(`SELECT * FROM playlists WHERE name = ?`).get(name);
export const listPlaylists     = ({ limit = 100, offset = 0 } = {}) =>
    db.prepare(`SELECT * FROM playlists ORDER BY id DESC LIMIT ? OFFSET ?`).all(limit, offset);

// UPDATE a playlist's details
export function updatePlaylist(id, fields = {}) {
    const keys = Object.keys(fields);
    if (!keys.length) return 0;
    const set = keys.map(k => `${k} = @${k}`).join(', ');
    const stmt = db.prepare(`UPDATE playlists SET ${set} WHERE id = @id`);
    return stmt.run({ ...fields, id }).changes;
}

// DELETE a playlist by ID
export const deletePlaylist = id => db.prepare(`DELETE FROM playlists WHERE id = ?`).run(id).changes;

// region[Playlist CRUD]
// endregion

// region[Genre CRUD]
const insertGenre = db.prepare(`INSERT OR IGNORE INTO genres (name) VALUES (?)`);
const selectGenre = db.prepare(`SELECT * FROM genres WHERE name = ?`);
const linkSongGenre = db.prepare(`INSERT OR IGNORE INTO song_genres (song_id, genre_id) VALUES (?, ?)`);

export function addGenre(name) {
    insertGenre.run(name);
    return selectGenre.get(name).id;
}

export function addGenreToSong(songId, genreName) {
    const gid = addGenre(genreName);
    return linkSongGenre.run(songId, gid).changes;
}

export function removeGenreFromSong(songId, genreName) {
    const row = selectGenre.get(genreName);
    if (!row) return 0; // Genre not found

    return db.prepare(`DELETE FROM song_genres WHERE song_id = ? AND genre_id = ?`)
        .run(songId, row.id).changes;
}

export const listGenresOfSong = songId =>
    db.prepare(`SELECT g.name
                FROM genres g
                JOIN song_genres sg ON sg.genre_id = g.id
                WHERE sg.song_id = ?`)
      .all(songId)
      .map(r => r.name);

// endregion

// region[Utils]
const linkSong = db.prepare(`INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id) VALUES (?, ?)`);
export const addSongToPlaylist = (playlistId, songId) => linkSong.run(playlistId, songId).changes;

export const removeSongFromPlaylist = (playlistId, songId) =>
    db.prepare(`DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?`).run(playlistId, songId).changes;

export const getSongsInPlaylist = playlistId => db.prepare(`
    SELECT s.*
    FROM songs s
    JOIN playlist_songs ps ON ps.song_id = s.id
    WHERE ps.playlist_id = ?
    ORDER BY ps.added_at
`).all(playlistId);

export const getPlaylistsForSong = songId => db.prepare(`
    SELECT p.*
    FROM playlists p
    JOIN playlist_songs ps ON ps.playlist_id = p.id
    WHERE ps.song_id = ?
`).all(songId);

export const runInTransaction = db.transaction(fn => fn());

// endergion


export default {
    // song CRUD operations
    getSongById,
    getSongByUrl,
    getSongsByUserId,
    updateSong,
    deleteSong,
    // Playlist CRUD oeprations
    addPlaylist,
    getPlaylistById,
    getPlaylistByName,
    listPlaylists,
    updatePlaylist,
    deletePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    getSongsInPlaylist,
    getPlaylistsForSong,
    // Genre CRUD operations
    addGenre,
    addGenreToSong,
    removeGenreFromSong,
    listGenresOfSong,
    // Utils
    linkSong,
    runInTransaction
};