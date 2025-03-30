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
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
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
const taskIdMap = new Map();

async function getDefaultTaskListId() {
    const res = await tasks.tasklists.list();
    if (res.data.items && res.data.items.length > 0) {
        return res.data.items[0].id;
    }
    throw new Error('Google Tasks のデフォルトタスクリストが見つかりません。');
}

client.once('ready', () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    try {
        const taskListId = await getDefaultTaskListId();  // デフォルトタスクリストIDを取得

        // 今日のタスクとして追加
        if (message.channel.id === process.env.TODAY_CHANNEL_ID) {
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD の形式

            const task = await tasks.tasks.insert({
                tasklist: taskListId,
                requestBody: {
                    title: message.content,
                    notes: 'Discordから追加されたタスク',
                    due: today  // ここを修正: YYYY-MM-DD の形式で指定する
                }
            });

            const taskTitle = task.data.title;
            const taskId = task.data.id;

            await message.delete();
            const botMessage = await message.channel.send(`✅ 今日のタスクとして「**${taskTitle}**」をGoogle Tasksに登録しました！`);
            await botMessage.react('❌');

            taskIdMap.set(botMessage.id, taskId);
            console.log(`Task created: ${taskId}`);
        }

        // 明日のタスクとして追加
        if (message.channel.id === process.env.TOMORROW_CHANNEL_ID) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowISO = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD の形式

            const task = await tasks.tasks.insert({
                tasklist: taskListId,
                requestBody: {
                    title: message.content,
                    notes: 'Discordから追加されたタスク',
                    due: tomorrowISO  // ここを修正: YYYY-MM-DD の形式で指定する
                }
            });

            const taskTitle = task.data.title;
            const taskId = task.data.id;

            await message.delete();
            const botMessage = await message.channel.send(`✅ 明日のタスクとして「**${taskTitle}**」をGoogle Tasksに登録しました！`);
            await botMessage.react('❌');

            taskIdMap.set(botMessage.id, taskId);
            console.log(`Task created: ${taskId}`);
        }
    } catch (error) {
        console.error('Error adding task:', error.response?.data || error.message);
        message.reply('❌ タスクの追加に失敗しました。');
    }
});

client.on('messageReactionAdd', async (reaction, user) => {
    if (reaction.emoji.name !== '❌' || user.bot) return;

    const messageId = reaction.message.id;
    const taskId = taskIdMap.get(messageId);

    if (!taskId) return;

    try {
        const taskListId = await getDefaultTaskListId(); // デフォルトタスクリストIDを取得

        await tasks.tasks.delete({
            tasklist: taskListId,
            task: taskId
        });

        console.log(`Task deleted: ${taskId}`);
        await reaction.message.delete();
        taskIdMap.delete(messageId);
    } catch (error) {
        console.error('Error deleting task:', error.response?.data || error.message);
    }
});

client.login(process.env.DISCORD_TOKEN);