const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const { google } = require('googleapis');
require('dotenv').config();
const axios = require('axios');

// Discordクライアントを作成
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.MessageReactions // リアクションイベントのために追加
    ]
});

// Google Tasks API 設定
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
);

oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const tasks = google.tasks({ version: 'v1', auth: oauth2Client });

client.once('ready', () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const originalContent = message.content;

    // 今日のタスクとして追加
    if (message.channel.id === process.env.TODAY_CHANNEL_ID) {
        try {
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            const todayISO = today.toISOString();

            const task = await tasks.tasks.insert({
                tasklist: '@default',
                requestBody: {
                    title: originalContent,
                    notes: 'Discordから追加されたタスク',
                    due: todayISO
                }
            });

            const taskTitle = task.data.title;

            await message.delete();
            const replyMessage = await message.channel.send(`✅ 今日のタスクとして「**${taskTitle}**」をGoogle Tasksに登録しました！`);
            console.log(`Task created: ${task.data.id}`);

            await replyMessage.react('🗑️'); // ゴミ箱アイコンに変更
        } catch (error) {
            console.error('Error adding task:', error.response?.data || error.message);
            await message.delete();
            await message.channel.send(`❌ タスク「**${originalContent}**」の追加に失敗しました。`);
        }
    }

    // 明日のタスクとして追加
    if (message.channel.id === process.env.TOMORROW_CHANNEL_ID) {
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setUTCHours(0, 0, 0, 0);
            const tomorrowISO = tomorrow.toISOString();

            const task = await tasks.tasks.insert({
                tasklist: '@default',
                requestBody: {
                    title: originalContent,
                    notes: 'Discordから追加されたタスク',
                    due: tomorrowISO
                }
            });

            const taskTitle = task.data.title;

            await message.delete();
            const replyMessage = await message.channel.send(`✅ 明日のタスクとして「**${taskTitle}**」をGoogle Tasksに登録しました！`);
            console.log(`Task created: ${task.data.id}`);

            await replyMessage.react('🗑️'); // ゴミ箱アイコンに変更
        } catch (error) {
            console.error('Error adding task:', error.response?.data || error.message);
            await message.delete();
            await message.channel.send(`❌ タスク「**${originalContent}**」の追加に失敗しました。`);
        }
    }
});

// リアクションが押されたときのイベント
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;

    if (reaction.emoji.name === '🗑️') {
        try {
            await reaction.message.delete();
            console.log('🗑️ Task message deleted successfully.');
        } catch (error) {
            console.error('Failed to delete task message:', error);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);