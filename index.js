const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { Connectors } = require('shoukaku');
const { Kazagumo } = require('kazagumo');
const express = require('express');

// ============ EXPRESS ============
const app = express();
app.get('/', (req, res) => res.send('Bot Online'));
app.listen(3000, () => console.log('🌐 Server running on port 3000'));

// ============ CEK TOKEN ============
const TOKEN = process.env.DISCORD_TOKEN;

console.log('='.repeat(50));
console.log('🔍 TOKEN CHECK:');
console.log('- Exists:', TOKEN ? 'YES' : 'NO');
console.log('- Length:', TOKEN?.length || 0);
console.log('- First 20:', TOKEN?.substring(0, 20) || 'NONE');
console.log('='.repeat(50));

if (!TOKEN) {
    console.error('❌ DISCORD_TOKEN tidak ditemukan!');
    console.error('👉 Set di Render Dashboard → Environment');
    process.exit(1);
}

// ============ CLIENT ============
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ============ LAVALINK ============
const kazagumo = new Kazagumo(
    {
        defaultSearchEngine: 'youtube',
        send: (guildId, payload) => {
            const guild = client.guilds.cache.get(guildId);
            if (guild) guild.shard.send(payload);
        }
    },
    new Connectors.DiscordJS(client),
    [{ name: 'Main', url: 'lavalink-q7yu.onrender.com:443', auth: 'ToingDc', secure: true }]
);

kazagumo.shoukaku.on('ready', (name) => console.log(`✅ Lavalink ${name} connected`));
kazagumo.shoukaku.on('error', (name, err) => console.error(`❌ Lavalink error:`, err.message));

kazagumo.on('playerStart', (player, track) => {
    const ch = client.channels.cache.get(player.textId);
    if (ch) ch.send({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🎵 Now Playing').setDescription(`**${track.title}**`)] });
});

kazagumo.on('playerEmpty', (player) => {
    const ch = client.channels.cache.get(player.textId);
    if (ch) ch.send('⏹️ Queue finished');
    player.destroy();
});

// ============ READY ============
client.once('ready', () => {
    console.log('='.repeat(50));
    console.log(`✅ BOT ONLINE: ${client.user.tag}`);
    console.log(`📊 Servers: ${client.guilds.cache.size}`);
    console.log('='.repeat(50));
    client.user.setActivity('!help', { type: 2 });
});

// ============ COMMANDS ============
client.on('messageCreate', async (msg) => {
    if (msg.author.bot || !msg.content.startsWith('!')) return;
    const args = msg.content.slice(1).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    if (cmd === 'ping') {
        msg.channel.send(`🏓 Pong! ${client.ws.ping}ms`);
    }

    if (cmd === 'play' || cmd === 'p') {
        if (!msg.member.voice.channel) return msg.reply('❌ Join voice channel dulu!');
        const query = args.join(' ');
        if (!query) return msg.reply('❌ Kasih nama lagu! Contoh: `!play never gonna give you up`');

        let player = kazagumo.players.get(msg.guild.id);
        if (!player) {
            player = await kazagumo.createPlayer({
                guildId: msg.guild.id,
                textId: msg.channel.id,
                voiceId: msg.member.voice.channel.id,
                volume: 70,
                deaf: true
            });
        }

        const result = await kazagumo.search(query, { requester: msg.author });
        if (!result?.tracks.length) return msg.reply('❌ Lagu tidak ditemukan!');

        player.queue.add(result.tracks[0]);
        if (!player.playing) player.play();
        msg.channel.send(`➕ Added: **${result.tracks[0].title}**`);
    }

    if (cmd === 'skip' || cmd === 's') {
        const player = kazagumo.players.get(msg.guild.id);
        if (player) { player.skip(); msg.react('⏭️'); }
    }

    if (cmd === 'stop') {
        const player = kazagumo.players.get(msg.guild.id);
        if (player) { player.destroy(); msg.react('⏹️'); }
    }

    if (cmd === 'pause') {
        const player = kazagumo.players.get(msg.guild.id);
        if (player) { player.pause(true); msg.react('⏸️'); }
    }

    if (cmd === 'resume') {
        const player = kazagumo.players.get(msg.guild.id);
        if (player) { player.pause(false); msg.react('▶️'); }
    }

    if (cmd === 'help') {
        msg.channel.send('**Commands:** `!play` `!skip` `!stop` `!pause` `!resume` `!ping`');
    }
});

// ============ LOGIN ============
console.log('🔐 Mencoba login...');

client.login(TOKEN)
    .then(() => console.log('✅ LOGIN BERHASIL!'))
    .catch(err => {
        console.error('='.repeat(50));
        console.error('❌ LOGIN GAGAL!');
        console.error('Error:', err.message);
        console.error('='.repeat(50));
        console.error('KEMUNGKINAN MASALAH:');
        console.error('1. Token salah/expired');
        console.error('2. MESSAGE CONTENT INTENT belum aktif');
        console.error('3. Bot belum diverifikasi');
        console.error('='.repeat(50));
        process.exit(1);
    });
