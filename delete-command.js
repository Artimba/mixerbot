import 'dotenv/config';
import { REST, Routes } from 'discord.js';

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

const CLIENT_ID = process.env.APP_ID;   // your app ID
const COMMAND_ID = '1200002413772406874';  // the ID you just copied
// const GUILD_ID   = '123456789012345678';   // omit for global cmd

(async () => {
  try {
    // Global commands
    // Global commands
    const globals = await rest.get(Routes.applicationCommands(CLIENT_ID));
    console.log('Global:', globals.map(c => `${c.id} → ${c.name}`));
    // ▸ GLOBAL  ▸ DELETE /applications/{app.id}/commands/{cmd.id}
    // await rest.delete(Routes.applicationCommand(CLIENT_ID, COMMAND_ID));
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });

    // ▸ GUILD   ▸ DELETE /applications/{app.id}/guilds/{guild.id}/commands/{cmd.id}
    // await rest.delete(
    //   Routes.applicationGuildCommand(CLIENT_ID, GUILD_ID, COMMAND_ID),
    // );

    console.log('🗑️  Command deleted.');
  } catch (err) {
    console.error(err);
  }
})();
