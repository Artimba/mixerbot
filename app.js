import 'dotenv/config';
import express from 'express';
import {
  ButtonStyleTypes,
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  MessageComponentTypes,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { fetchMusic, extractYouTubeLinks, insertSong } from './mixer.js';
import { saveChannelId, loadChannelId } from './utils.js';
import { updateSongWithLastFmData } from './lastfm.js';
import { getSongById } from './crud.js';
import db from './db.js';

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
const DISCORD_API = 'https://discord.com/api/v10';
const APP_ID = process.env.APP_ID; 
const targetChannelID = loadChannelId();


// Helper to build a Discord embed from a song row ------------------
const songEmbed = song => ({
  title: `🎧  ${song.title}`,
  description: `by **${song.artist}**`,
  color: 0x1db954,
  fields: [
    song.album   ? { name: 'Album',   value: song.album,   inline: true } : null,
    song.primary_genre   ? { name: 'primary_genre',   value: song.primary_genre,   inline: true } : null,
    song.year    ? { name: 'Year',    value: String(song.year), inline: true } : null,
    song.duration? { name: 'Length',  value: `${song.duration}s`, inline: true } : null,
  ].filter(Boolean),
  footer: { text: `Added by <@${song.user_id}> • ID ${song.id}` },
});

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 * Parse request body and verifies incoming requests using discord-interactions package
 */
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  // Interaction id, type and data
  const { id, type, data } = req.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "test" command
    if (name === 'test') {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          // Fetches a random emoji to send from a helper function
          content: `Hello world, I'm alive!`,
        },
      });
    }

    // # Set Music Channel Command
    if (name === 'setchannel') {
      const memberPermissions = req.body.member?.permissions;

      // 0x8 is ADMINISTRATOR
      if ((parseInt(memberPermissions) & 0x8) !== 0x8) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: 'You must be an admin to use this command.',
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }

      // get Channel ID from options, save it to the target channel
      const channelId = data.options.find(opt => opt.name === 'channel').value;
      // Save the channel ID to a file
      saveChannelId(channelId);

      // Send a message into the channel where command was triggered from
      console.log(`Setting music channel to ${channelId}`);

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `Music channel set to <#${channelId}>`,
        },
      });
    }

    // Query recent songs command
    if (name === 'recentsongs') {
      try {
        const recentSongs = db.prepare('SELECT * FROM songs ORDER BY added_at DESC, id DESC LIMIT 10').all();

        if (recentSongs.length === 0) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: 'No recent songs found.',
              flags: InteractionResponseFlags.SUPPRESS_EMBEDS,
            },
          });
        }

        // Create an embed object
        const embed = {
          title: '🎵  Recent Songs',
          description: 'Here are the most recently added songs:',
          color: 0x1db954, // Spotify green color
          fields: recentSongs.map(song => ({
            name: "**" + song.title + "** by **" + song.artist + "**",
            value: [
              `**[Link to Song](${song.url})**`,
              song.album && song.album !== 'Unknown Album' ? `**Album**: ${song.album}` : '',
              `**Genre**: ${song.primary_genre || 'Unknown genre'}`,
              `**Added by**: <@${song.user_id}> on <t:${song.added_at}:F>`,
            ]
              .filter(Boolean) // Remove empty values
              .join('\n')
          })),
          footer: {
            text: 'Use /querysongs to search for specific songs!',
          },
        };

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [embed],
          },
        });
      } catch (err) {
        console.error('Error in recentsongs:', err);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ Failed to fetch recent songs.',
            flags: InteractionResponseFlags.SUPPRESS_EMBEDS,
          },
        });
      }
    }

    // // Scan channel command
    // if (name === 'scanmusic') {
    //   try {
    //     const messages = await fetchMusic(targetChannelID);
    //     const urls = extractYouTubeLinks(messages);
    //     const existing = db.prepare('SELECT url FROM songs').all().map(s => s.url);

    //     let newCount = 0;
    //     for (const { url, user, id, timestamp } of urls) {
    //       if (!existing.includes(url)) {
    //         await insertSong({ url, user: { id: id, username: user }, timestamp });
    //         newCount++;
    //       }
    //     }

    //     return res.send({
    //       type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    //       data: {
    //         content: `✅ Scanned ${urls.length} links. ${newCount} new songs added.`,
    //       },
    //     });
    //   } catch (err) {
    //     console.error('Error scanning music:', err);
    //     return res.send({
    //       type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    //       data: {
    //         content: '❌ An error occurred while scanning the channel.',
    //       },
    //     });
    //   }
    // }
    if (name === 'scanmusic') {
      // 1️⃣  Defer right away so Discord shows “*Bot is thinking…*”
      res.send({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      });
    
      // 2️⃣  Do the heavy work in the background
      (async () => {
        try {
          const messages = await fetchMusic(targetChannelID);
          const urls     = extractYouTubeLinks(messages);
          const existing = db.prepare('SELECT url FROM songs').all().map(r => r.url);
    
          let newCount = 0;
          for (const { url, user, id, timestamp } of urls) {
            if (!existing.includes(url)) {
              await insertSong({ url, user: { id, username: user }, timestamp });
              newCount++;
            }
          }
    
          // 3️⃣  Edit the original reply to show the result
          await fetch(
            `${DISCORD_API}/webhooks/${APP_ID}/${req.body.token}/messages/@original`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: `✅ Scanned ${urls.length} links. **${newCount}** new songs added.`,
              }),
            }
          );
        } catch (err) {
          console.error('Error scanning music:', err);
    
          // Update the deferred reply with an error message
          await fetch(
            `${DISCORD_API}/webhooks/${APP_ID}/${req.body.token}/messages/@original`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: '❌ An error occurred while scanning the channel.',
              }),
            }
          );
        }
      })();
    
      return;              // we already responded; nothing else to send
    }

    // Query songs command
    if (name === 'querysongs') {
      try {
        const options = data.options || [];
        let userQuery = options.find(o => o.name === 'user')?.value?.toLowerCase();
        const artistQuery = options.find(o => o.name === 'artist')?.value?.toLowerCase();
        const titleQuery = options.find(o => o.name === 'title')?.value?.toLowerCase();

        let userId = null;
        const mentionMatch = userQuery?.match(/^<@!?(\d+)>$/);
        if (mentionMatch) {
          userId = mentionMatch[1];
          userQuery = null; // Clear userQuery if we have a userId
        }

        let query = 'SELECT * FROM songs WHERE 1=1';
        const params = [];

        if (userId) {
          query += ' AND user_id = ?';
          params.push(userId);
        } else if (userQuery) {
          query += ' AND LOWER(user_name) LIKE ?';
          params.push(`%${userQuery}%`);
        }
        if (artistQuery) {
          query += ' AND LOWER(artist) LIKE ?';
          params.push(`%${artistQuery}%`);
        }
        if (titleQuery) {
          query += ' AND LOWER(title) LIKE ?';
          params.push(`%${titleQuery}%`);
        }

        query += ' ORDER BY id DESC LIMIT 10';

        const matches = db.prepare(query).all(...params);

        if (matches.length === 0) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ No matching songs found.',
              flags: InteractionResponseFlags.SUPPRESS_EMBEDS,
            },
          });
        }

        // Create an embed object
        const embed = {
          title: '🔍 Query Results',
          description: 'Here are the songs matching your query:',
          color: 0x1db954, // Spotify green color
          fields: matches.map(song => ({
            name: `**${song.title}** by **${song.artist}**`,
            value: [
              `**[Link to Song](${song.url})**`,
              song.album && song.album !== 'Unknown Album' ? `**Album**: ${song.album}` : '',
              `**Genre**: ${song.primary_genre || 'Unknown genre'}`,
              `**Added by**: <@${song.user_id}> on <t:${song.added_at}:F>`,
            ]
              .filter(Boolean) // Remove empty values
              .join('\n'),
          }))
        };

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [embed],
          },
        });
      } catch (err) {
        console.error('Error in querysongs:', err);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ Something went wrong while searching songs.',
            flags: InteractionResponseFlags.SUPPRESS_EMBEDS,
          },
        });
      }
    }

    // Update song metadata with Last.fm command
    if (name === 'lastfm') {
      console.dir(req.body, { depth: null });   // <-- delete later
      // 1. Grab the "title" option (required)
      const options = data.options || [];
      const titleQuery = options.find(o => o.name === 'title')?.value?.toLowerCase();
      if (!titleQuery) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `Unable to find song ${titleQuery} in database.`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }

      // 2. Fuzzy match: pick most recent song whose title contains the query
      const row = db
        .prepare('SELECT * FROM songs WHERE LOWER(title) LIKE ? ORDER BY id DESC LIMIT 1')
        .get(`%${titleQuery}%`);

      if (!row) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ No song found matching that title.',
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }

      // 3. Enrich via Last.fm (fills album/year/primary_genre/duration if missing)
      try {
        await updateSongWithLastFmData(row.id);
      } catch (err) {
        console.error('Error updating song with Last.fm data:', err);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ Failed to update song metadata with Last.fm.',
            flags: InteractionResponseFlags.SUPPRESS_EMBEDS,
          },
        });
      }

      // 4. Fetch fresh row & craft embed
      const updated = getSongById(row.id);
      const embed   = songEmbed(updated);

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '✅ Metadata updated!',
          embeds: [embed],
        },
      });
    }

    console.error(`unknown command: ${name}`);
    return res.status(400).json({ error: 'unknown command' });
  }

  /**
   * Handle requests from interactive components
   * See https://discord.com/developers/docs/interactions/message-components#responding-to-a-component-interaction
   */
  if (type === InteractionType.MESSAGE_COMPONENT) {
    // custom_id set in payload when sending message component
    const componentId = data.custom_id;

    // Add your MESSAGE_COMPONENT handling logic here if needed
  }

  console.error('unknown interaction type', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});


app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
