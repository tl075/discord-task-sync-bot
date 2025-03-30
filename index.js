const { Client, GatewayIntentBits } = require('discord.js');
const { google } = require('googleapis');
require('dotenv').config();
const axios = require('axios');

// Discordクライアントを作成
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
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

    // 今日のタスクとして追加
    if (message.channel.id === process.env.TODAY_CHANNEL_ID) {
        try {
            const today = new Date();
            today.setHours(23, 59, 59, 0);  // 今日の23:59:59を設定

            const formattedTodayDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString();

            const task = await tasks.tasks.insert({
                tasklist: '@default',
                requestBody: {
                    title: message.content,
                    notes: 'Discordから追加されたタスク',
                    due: formattedTodayDate  // 今日のタスクに due を設定する
                }
            });

            message.reply('✅ 今日のタスクとしてGoogle Tasksに登録しました！');
            console.log(`Task created: ${task.data.id}`);
        } catch (error) {
            console.error('Error adding task:', error.response?.data || error.message);
            message.reply('❌ タスクの追加に失敗しました。');
        }
    }

    // 明日のタスクとして追加
    if (message.channel.id === process.env.TOMORROW_CHANNEL_ID) {
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(23, 59, 59, 0);  // 明日の23:59:59を設定

            const formattedDueDate = new Date(tomorrow.getTime() - (tomorrow.getTimezoneOffset() * 60000)).toISOString();

            const task = await tasks.tasks.insert({
                tasklist: '@default',
                requestBody: {
                    title: message.content,
                    notes: 'Discordから追加されたタスク',
                    due: formattedDueDate  // 明日のタスクに due を設定する
                }
            });

            message.reply('✅ 明日のタスクとしてGoogle Tasksに登録しました！');
            console.log(`Task created: ${task.data.id}`);
        } catch (error) {
            console.error('Error adding task:', error.response?.data || error.message);
            message.reply('❌ タスクの追加に失敗しました。');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);