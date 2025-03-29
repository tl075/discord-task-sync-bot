const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

// クライアントを作成する
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Botがオンラインになった時にログを表示する
client.once('ready', () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
});

// メッセージを受け取った時に処理する
client.on('messageCreate', async (message) => {
    // Bot自身のメッセージは無視する
    if (message.author.bot) return;

    // 今日用チャンネルに送信された場合
    if (message.channel.id === process.env.TODAY_CHANNEL_ID) {
        message.reply('✅ 今日のタスクとして登録しました！');
    }

    // 明日用チャンネルに送信された場合
    if (message.channel.id === process.env.TOMORROW_CHANNEL_ID) {
        message.reply('✅ 明日のタスクとして登録しました！');
    }
});

// Discordにログインする
client.login(process.env.DISCORD_TOKEN);