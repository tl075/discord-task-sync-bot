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
        GatewayIntentBits.GuildMessageReactions // これを追加
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

const taskMap = new Map();

client.once('ready', () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const channelId = message.channel.id;

    if (channelId === process.env.TODAY_CHANNEL_ID || channelId === process.env.TOMORROW_CHANNEL_ID) {
        try {
            const taskDate = channelId === process.env.TODAY_CHANNEL_ID ? new Date() : new Date(new Date().setDate(new Date().getDate() + 1));
            const dueDate = taskDate.toISOString().split('T')[0];

            const task = await tasks.tasks.insert({
                tasklist: '@default',
                requestBody: {
                    title: message.content,
                    notes: 'Discordから追加されたタスク',
                    due: dueDate
                }
            });

            const taskTitle = task.data.title;
            const taskId = task.data.id;

            await message.delete();

            const sentMessage = await message.channel.send(`✅ ${channelId === process.env.TODAY_CHANNEL_ID ? '今日' : '明日'}のタスクとして「**${taskTitle}**」をGoogle Tasksに登録しました！`);
            await sentMessage.react('🗑️');

            taskMap.set(sentMessage.id, taskId);
            console.log(`Task created: ${taskId}`);
        } catch (error) {
            await message.delete();
            console.error('Error adding task:', error.response?.data || error.message);
            message.channel.send(`❌ タスク「${message.content}」の追加に失敗しました。`);
        }
    }
});

client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.emoji.name !== '🗑️') return;

    const messageId = reaction.message.id;
    const taskId = taskMap.get(messageId);

    if (!taskId) {
        console.log(`🗑️ Task ID not found for message ID: ${messageId}`);
        return;
    }

    try {
        await tasks.tasks.delete({
            tasklist: '@default',
            task: taskId
        });

        await reaction.message.delete();
        taskMap.delete(messageId);

        console.log('🗑️ Task deleted successfully.');
    } catch (error) {
        console.error('Error deleting task:', error.response?.data || error.message);
    }
});

client.login(process.env.DISCORD_TOKEN);