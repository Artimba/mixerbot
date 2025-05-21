import 'dotenv/config';
import { capitalize, InstallGlobalCommands, InstallGuildCommands } from './utils.js';
import db from './db.js';

// Get the game choices from game.js
function createCommandChoices() {
  const choices = getRPSChoices();
  const commandChoices = [];

  for (let choice of choices) {
    commandChoices.push({
      name: capitalize(choice),
      value: choice.toLowerCase(),
    });
  }

  return commandChoices;
}

function createGenreChoices() {
  const genres = db.prepare('SELECT name FROM genres ORDER BY name').all();
  return genres.map(genre => ({
    name: capitalize(genre.name),
    value: genre.name.toLowerCase(),
  }));
}

// Simple test command
const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Music channel command
const SET_CHANNEL_COMMAND = {
  name: 'setchannel',
  description: ' Set the music channel',
  type: 1,
  options: [
    {
      type: 7, // Channel type
      name: 'channel',
      description: 'The channel to set as the music channel',
      required: true,
    },
  ],
  integration_types: [0, 1],
  contexts: [0, 2],
  // only admins can run this command
  default_member_permissions: 8, // 8 is the permission for administrator
}

const SET_BOT_CONTROLLER_ROLE_COMMAND = {
  name: 'setadminrole',
  type: 1,
  description: 'Set the role that can access admin-privileged commands.',
  options: [
    {
      type: 8, // Role type
      name: 'role',
      description: 'The role to set as the Bot Controller role.',
      required: true,
    },
  ],
  // only admins can run this command
  default_member_permissions: 8, // 8 is the permission for administrator
  integration_types: [0, 1],
  contexts: [0, 2]
};

// Recent songs command
const RECENT_SONGS_COMMAND = {
  name: 'recentsongs',
  description: 'Get the last 10 songs added to the music channel',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

// Scan channel command
const SCAN_CHANNEL_COMMAND = {
  name: 'scanmusic',
  description: 'Scan the entire channel for music links not in the DB',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

// query songs
const QUERY_SONGS_COMMAND = {
  name: 'querysongs',
  description: 'Search songs by user, artist, or title',
  type: 1,
  options: [
    {
      type: 3,
      name: 'user',
      description: 'Discord username or user ID (e.g. skyibiz)',
      required: false,
    },
    {
      type: 3,
      name: 'artist',
      description: 'Artist name (partial match allowed)',
      required: false,
    },
    {
      type: 3,
      name: 'title',
      description: 'Song title (partial match allowed)',
      required: false,
    },
  ],
  integration_types: [0, 1],
  contexts: [0, 2],
};

// Update song with last FM metadata
const UPDATE_SONG_METADATA_COMMAND = {
  name: 'lastfm',
  description: 'Update song metadata with Last.fm data',
  type: 1,
  options: [
    {
      // song name
      type: 3, // String type
      name: 'title',
      description: 'The name of the song to update',
      required: true,
    },
  ],
  integration_types: [0, 1],
  contexts: [0, 2],
};

// Random song command (with genre/user prompt) [TODO]
const RANDOM_SONG_COMMAND = {
  name: 'randomsong',
  description: 'Get a random song from the music channel',
  type: 1,
  options: [
    {
      type: 3,
      name: 'genre1',
      description: 'First genre',
      required: false,
      autocomplete: true
    },
    {
      type: 3,
      name: 'genre2',
      description: 'Second genre',
      required: false,
      autocomplete: true
    },
    {
      type: 3,
      name: 'genre3',
      description: 'Third genre',
      required: false,
      autocomplete: true
    },
    {
      type: 6,
      name: 'user1',
      description: 'First user',
      required: false,
    },
    {
      type: 6,
      name: 'user2',
      description: 'Second user',
      required: false,
    },
    {
      type: 6,
      name: 'user3',
      description: 'Third user',
      required: false,
    }
  ],
  integration_types: [0, 1],
  contexts: [0, 2],
}

const DELETE_SONG_COMMAND = {
  name: 'deletesong',
  description: 'Delete a song or set of songs from the database',
  type: 1,
  options: [
    {
      type: 3,
      name: 'url',
      description: 'URL of the song to delete',
      required: false,
    },
    {
      type: 4, // INTEGER
      name: 'id',
      description: 'Song ID to delete',
      required: false,
    },
    {
      type: 3,
      name: 'title',
      description: 'Delete song(s) by title (partial match)',
      required: false,
    },
    {
      type: 6,
      name: 'user',
      description: 'Delete all songs added by this user (admin only)',
      required: false,
    },
    {
      type: 3,
      name: 'artist',
      description: 'Delete all songs by artist (admin only)',
      required: false,
    },
  ],
  integration_types: [0, 1],
  contexts: [0, 2],
};

// fix genres
const FIX_GENRES_COMMAND = {
  name: 'fixgenres',
  description: 'Auto prompt all unknown genres to be fixed',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
  default_member_permissions: 8, // 8 is the permission for administrator
};

const SET_GENRE_COMMAND = {
  name: 'setgenre',
  description: 'Set one or more genres for the current song',
  type: 1,
  options: [
    {
      type: 3,
      name: 'genre1',
      description: 'Primary genre',
      required: true,
      autocomplete: true,
    },
    {
      type: 3,
      name: 'genre2',
      description: 'Secondary genre (optional)',
      required: false,
      autocomplete: true,
    },
    {
      type: 3,
      name: 'genre3',
      description: 'Third genre (optional)',
      required: false,
      autocomplete: true,
    },
    {
      type: 3,
      name: 'genre4',
      description: 'Fourth genre (optional)',
      required: false,
      autocomplete: true,
    },
  ],
  integration_types: [0, 1],
  contexts: [0, 2],
};

const ALL_COMMANDS = [TEST_COMMAND, SET_CHANNEL_COMMAND, RECENT_SONGS_COMMAND, SCAN_CHANNEL_COMMAND, QUERY_SONGS_COMMAND, UPDATE_SONG_METADATA_COMMAND, SET_BOT_CONTROLLER_ROLE_COMMAND, RANDOM_SONG_COMMAND, DELETE_SONG_COMMAND, FIX_GENRES_COMMAND, SET_GENRE_COMMAND];

// InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
InstallGuildCommands(process.env.APP_ID, process.env.GUILD_ID, ALL_COMMANDS);