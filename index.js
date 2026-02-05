const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { Connectors } = require('shoukaku');
const { Kazagumo } = require('kazagumo');
const express = require('express');

// ============ TOKEN LANGSUNG ============
const TOKEN = "MTQ2ODc5NzEyMzkyNjQyNTYzMQ.GxnVWv.Ag_fTdHreZOB7OUmHg8RRIVsAMeArYX2mMjN3A";

// ============ BOT INFO ============
const BOT_INFO = {
    name: 'Melodify',
    version: '1.0.0',
    description: 'Music Bot',
    color: '#5865F2'
};

// ============ EXPRESS ============
const app = express();
app.get('/', (req, res) => res.send('Bot Online'));
app.listen(3000, () => console.log('🌐 Server running on port 3000'));

// ============ DISCORD CLIENT ============
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ============ LAVALINK ============
const Nodes = [
    {
        name: 'Main',
        url: 'lavalink-q7yu.onrender.com:443',
        auth: 'ToingDc',
        secure: true
    }
];

const kazagumo = new Kazagumo(
    {
        defaultSearchEngine: 'youtube',
        send: (guildId, payload) => {
            const guild = client.guilds.cache.get(guildId);
            if (guild) guild.shard.send(payload);
        }
    },
    new Connectors.DiscordJS(client),
    Nodes
);

kazagumo.shoukaku.on('ready', (name) => console.log(`✅ Lavalink ${name} connected`));
kazagumo.shoukaku.on('error', (name, error) => console.error(`❌ Lavalink error:`, error));

// ============ PLAYER EVENTS ============
kazagumo.on('playerStart', (player, track) => {
    const channel = client.channels.cache.get(player.textId);
    if (!channel) return;
    const embed = new EmbedBuilder()
        .setColor(BOT_INFO.color)
        .setTitle('🎵 Now Playing')
        .setDescription(`**${track.title}**`)
        .addFields({ name: 'Duration', value: formatDuration(track.length), inline: true });
    channel.send({ embeds: [embed] });
});

kazagumo.on('playerEmpty', (player) => {
    const channel = client.channels.cache.get(player.textId);
    if (channel) channel.send('⏹️ Queue finished');
    player.destroy();
});

// ============ BOT READY ============
client.once('ready', () => {
    console.log(`🤖 ${client.user.tag} is online!`);
    console.log(`📊 Servers: ${client.guilds.cache.size}`);
    client.user.setActivity('!help', { type: 2 });
});

// ============ HELPER ============
function formatDuration(ms) {
    if (!ms) return '🔴 Live';
    const s = Math.floor((ms / 1000) % 60);
    const m = Math.floor((ms / 60000) % 60);
    const h = Math.floor(ms / 3600000);
    return h > 0 ? `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}` : `${m}:${s.toString().padStart(2,'0')}`;
}

function errorEmbed(msg) {
    return new EmbedBuilder().setColor('#ff6b6b').setDescription(`❌ ${msg}`);
}

function successEmbed(msg) {
    return new EmbedBuilder().setColor(BOT_INFO.color).setDescription(msg);
}

// ============ COMMANDS ============
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    // PLAY
    if (cmd === 'play' || cmd === 'p') {
        if (!message.member.voice.channel) return message.reply({ embeds: [errorEmbed('Join voice channel first!')] });
        const query = args.join(' ');
        if (!query) return message.reply({ embeds: [errorEmbed('Provide a song name!')] });

        try {
            let player = kazagumo.players.get(message.guild.id);
            if (!player) {
                player = await kazagumo.createPlayer({
                    guildId: message.guild.id,
                    textId: message.channel.id,
                    voiceId: message.member.voice.channel.id,
                    volume: 70,
                    deaf: true
                });
            }

            const result = await kazagumo.search(query, { requester: message.author });
            if (!result?.tracks.length) return message.reply({ embeds: [errorEmbed('No results!')] });

            if (result.type === 'PLAYLIST') {
                for (const track of result.tracks) player.queue.add(track);
                message.channel.send({ embeds: [successEmbed(`📃 Added ${result.tracks.length} tracks`)] });
            } else {
                player.queue.add(result.tracks[0]);
                if (player.playing) message.channel.send({ embeds: [successEmbed(`➕ Added: **${result.tracks[0].title}**`)] });
            }

            if (!player.playing && !player.paused) player.play();
        } catch (e) {
            console.error(e);
            message.reply({ embeds: [errorEmbed('Error occurred!')] });
        }
    }

    // SKIP
    if (cmd === 'skip' || cmd === 's') {
        const player = kazagumo.players.get(message.guild.id);
        if (!player?.queue.current) return message.reply({ embeds: [errorEmbed('Nothing playing!')] });
        player.skip();
        message.react('⏭️');
    }

    // STOP
    if (cmd === 'stop') {
        const player = kazagumo.players.get(message.guild.id);
        if (!player) return message.reply({ embeds: [errorEmbed('Nothing playing!')] });
        player.destroy();
        message.react('⏹️');
    }

    // PAUSE
    if (cmd === 'pause') {
        const player = kazagumo.players.get(message.guild.id);
        if (!player) return message.reply({ embeds: [errorEmbed('Nothing playing!')] });
        player.pause(true);
        message.react('⏸️');
    }

    // RESUME
    if (cmd === 'resume') {
        const player = kazagumo.players.get(message.guild.id);
        if (!player) return message.reply({ embeds: [errorEmbed('Nothing playing!')] });
        player.pause(false);
        message.react('▶️');
    }

    // QUEUE
    if (cmd === 'queue' || cmd === 'q') {
        const player = kazagumo.players.get(message.guild.id);
        if (!player?.queue.current) return message.reply({ embeds: [errorEmbed('Queue empty!')] });
        
        let desc = `**Now:** ${player.queue.current.title}\n\n`;
        player.queue.slice(0, 10).forEach((t, i) => desc += `${i+1}. ${t.title}\n`);
        
        message.channel.send({ embeds: [new EmbedBuilder().setColor(BOT_INFO.color).setTitle('Queue').setDescription(desc)] });
    }

    // PING
    if (cmd === 'ping') {
        message.channel.send({ embeds: [successEmbed(`🏓 Pong! ${client.ws.ping}ms`)] });
    }

    // HELP
    if (cmd === 'help') {
        const embed = new EmbedBuilder()
            .setColor(BOT_INFO.color)
            .setTitle('Commands')
            .setDescription('`!play` `!skip` `!stop` `!pause` `!resume` `!queue` `!ping`');
        message.channel.send({ embeds: [embed] });
    }
});

// ============ LOGIN ============
console.log('🔐 Logging in...');
client.login(TOKEN)
    .then(() => console.log('✅ LOGIN SUCCESS!'))
    .catch(err => console.error('❌ LOGIN FAILED:', err.message));
