const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { google } = require('googleapis');
require('dotenv').config();
const axios = require('axios');

// Discordクライアントを作成
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions // リアクションの取得に必要
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction] // リアクション取得用に設定
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

// タスクIDを保存するためのMap
const taskMap = new Map();

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

            const taskId = task.data.id;
            const taskTitle = task.data.title;

            // メッセージIDとタスクIDを保存
            taskMap.set(message.id, taskId);

            await message.delete();
            const replyMessage = await message.channel.send(`✅ 今日のタスクとして「**${taskTitle}**」をGoogle Tasksに登録しました！`);
            console.log(`Task created: ${taskId}`);

            await replyMessage.react('🗑️'); // ゴミ箱アイコンに変更
            taskMap.set(replyMessage.id, taskId); // **返信メッセージのIDとタスクIDを紐づける**
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

    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Error fetching the message:', error);
            return;
        }
    }

    if (reaction.emoji.name === '🗑️') {
        const messageId = reaction.message.id;
        const taskId = taskMap.get(messageId);

        if (!taskId) {
            console.error(`🗑️ Task ID not found for message ID: ${messageId}`);
            return;
        }

        try {
            // Google Tasksのタスクを削除
            await tasks.tasks.delete({
                tasklist: '@default',
                task: taskId,
            });

            console.log(`🗑️ Task ${taskId} deleted from Google Tasks.`);
            taskMap.delete(messageId);

            // Discordのメッセージを削除
            await reaction.message.delete();
        } catch (error) {
            console.error('Failed to delete task:', error);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);