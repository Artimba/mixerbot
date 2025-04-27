import 'dotenv/config';
import { capitalize, InstallGlobalCommands, InstallGuildCommands } from './utils.js';

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


const ALL_COMMANDS = [TEST_COMMAND, SET_CHANNEL_COMMAND, RECENT_SONGS_COMMAND, SCAN_CHANNEL_COMMAND, QUERY_SONGS_COMMAND];

// InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
InstallGuildCommands(process.env.APP_ID, process.env.GUILD_ID, ALL_COMMANDS);