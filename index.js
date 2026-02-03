const { Client, GatewayIntentBits } = require('discord.js');
const { Connectors } = require('shoukaku');
const { Kazagumo } = require('kazagumo');
const express = require('express');
require('dotenv').config();

// ============ EXPRESS KEEP-ALIVE ============
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is running!'));
app.get('/ping', (req, res) => res.status(200).send('Pong!'));
app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));

// ============ DISCORD CLIENT ============
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ============ LAVALINK NODES ============
const Nodes = [
    {
        name: 'Serenetia',
        url: 'lavalinkv4.serenetia.com:443',
        auth: 'https://dsc.gg/ajidevserver',
        secure: true
    }
];

// ============ KAZAGUMO v3.x SETUP ============
const kazagumo = new Kazagumo({
    defaultSearchEngine: 'youtube',
    send: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
    }
}, new Connectors.DiscordJS(client), Nodes);

// ============ EVENTS ============
kazagumo.shoukaku.on('ready', (name) => console.log(`✅ Lavalink ${name} connected!`));
kazagumo.shoukaku.on('error', (name, error) => console.error(`❌ Lavalink ${name} error:`, error));

kazagumo.on('playerStart', (player, track) => {
    const channel = client.channels.cache.get(player.textId);
    if (channel) channel.send(`🎵 Now playing: **${track.title}**`);
});

kazagumo.on('playerEmpty', (player) => {
    const channel = client.channels.cache.get(player.textId);
    if (channel) channel.send('⏹️ Queue finished!');
    player.destroy();
});

// ============ BOT READY ============
client.once('ready', () => {
    console.log(`🤖 ${client.user.tag} is online!`);
});

// ============ COMMANDS ============
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // !play
    if (command === 'play') {
        if (!message.member.voice.channel) {
            return message.reply('❌ Join voice channel dulu!');
        }
        
        const query = args.join(' ');
        if (!query) return message.reply('❌ Kasih judul lagu! Contoh: `!play never gonna give you up`');

        try {
            let player = kazagumo.players.get(message.guild.id);
            
            if (!player) {
                player = await kazagumo.createPlayer({
                    guildId: message.guild.id,
                    textId: message.channel.id,
                    voiceId: message.member.voice.channel.id,
                    volume: 80,
                    deaf: true
                });
            }

            const result = await kazagumo.search(query, { requester: message.author });
            
            if (!result || !result.tracks.length) {
                return message.reply('❌ Lagu tidak ditemukan!');
            }

            player.queue.add(result.tracks[0]);
            message.channel.send(`➕ Added: **${result.tracks[0].title}**`);

            if (!player.playing && !player.paused) player.play();
            
        } catch (error) {
            console.error('Play error:', error);
            message.reply('❌ Error saat memutar lagu!');
        }
    }

    // !skip
    if (command === 'skip') {
        const player = kazagumo.players.get(message.guild.id);
        if (!player) return message.reply('❌ Tidak ada musik!');
        player.skip();
        message.channel.send('⏭️ Skipped!');
    }

    // !stop
    if (command === 'stop') {
        const player = kazagumo.players.get(message.guild.id);
        if (!player) return message.reply('❌ Tidak ada musik!');
        player.destroy();
        message.channel.send('⏹️ Stopped!');
    }

    // !pause
    if (command === 'pause') {
        const player = kazagumo.players.get(message.guild.id);
        if (!player) return message.reply('❌ Tidak ada musik!');
        player.pause(!player.paused);
        message.channel.send(player.paused ? '⏸️ Paused!' : '▶️ Resumed!');
    }

    // !queue
    if (command === 'queue' || command === 'q') {
        const player = kazagumo.players.get(message.guild.id);
        if (!player || !player.queue.current) {
            return message.reply('❌ Queue kosong!');
        }
        
        let msg = `🎵 **Now Playing:** ${player.queue.current.title}\n\n`;
        if (player.queue.length > 0) {
            msg += `📃 **Queue:**\n`;
            player.queue.slice(0, 10).forEach((track, i) => {
                msg += `${i + 1}. ${track.title}\n`;
            });
        }
        message.channel.send(msg);
    }

    // !help
    if (command === 'help') {
        message.channel.send(`
🎵 **Music Commands:**
\`!play <lagu>\` - Putar lagu
\`!skip\` - Skip
\`!stop\` - Stop & disconnect
\`!pause\` - Pause/Resume
\`!queue\` - Lihat queue
        `);
    }
});

client.login(process.env.DISCORD_TOKEN);
