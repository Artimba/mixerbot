import 'dotenv/config';
import fs from 'fs';

export async function DiscordRequest(endpoint, options) {
  // append endpoint to root API URL
  const url = 'https://discord.com/api/v10/' + endpoint;
  // Stringify payloads
  if (options.body) options.body = JSON.stringify(options.body);
  // Use fetch to make requests
  const res = await fetch(url, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent': 'DiscordBot (https://github.com/discord/discord-example-app, 1.0.0)',
    },
    ...options
  });
  // throw API errors
  if (!res.ok) {
    const data = await res.json();
    console.log(res.status);
    throw new Error(JSON.stringify(data));
  }
  // return original response
  return res;
}

export async function InstallGlobalCommands(appId, commands) {
  // API endpoint to overwrite global commands
  const endpoint = `applications/${appId}/commands`;

  try {
    // This is calling the bulk overwrite endpoint: https://discord.com/developers/docs/interactions/application-commands#bulk-overwrite-global-application-commands
    const res = await DiscordRequest(endpoint, { method: 'PUT', body: commands });
    console.log(`Registering ${commands.length} global command(s): ${commands.map(c => c.name).join(', ')} - response: ${res.status}`);
  } catch (err) {
    console.error(err);
  }
}

export async function InstallGuildCommands(appId, guildId, commands) {
  const endpoint = `/applications/${appId}/guilds/${guildId}/commands`;

  try {
    const res = await DiscordRequest(endpoint, { method: 'PUT', body: commands });
    console.log(`✅ Registered ${commands.length} guild command(s): ${commands.map(c => c.name).join(', ')} - Status: ${res.status}`);
    const data = await res.json();
    console.log('Response:', data);
  } catch (err) {
    console.error('❌ Failed to register guild commands:', err);
  }
}

// Simple method that returns a random emoji from list
export function getRandomEmoji() {
  const emojiList = ['😭','😄','😌','🤓','😎','😤','🤖','😶‍🌫️','🌏','📸','💿','👋','🌊','✨'];
  return emojiList[Math.floor(Math.random() * emojiList.length)];
}

export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function saveChannelId(channelId) {
  fs.writeFileSync('./channel-config.json', JSON.stringify({ targetChannelID: channelId}));
}

export function loadChannelId() {
  if (fs.existsSync('./channel-config.json')) {
    const data = fs.readFileSync('./channel-config.json', 'utf8');
    const config = JSON.parse(data);
    return config.targetChannelID;
  }
  return null;
}