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
        GatewayIntentBits.GuildMessageReactions // 追加
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction] // 部分的にロードする必要がある
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

    // 今日のタスクとして追加
    if (message.channel.id === process.env.TODAY_CHANNEL_ID) {
        try {
            const today = new Date();
            const todayISO = today.toISOString().split('T')[0]; 

            const task = await tasks.tasks.insert({
                tasklist: '@default',
                requestBody: {
                    title: message.content,
                    notes: 'Discordから追加されたタスク',
                    due: todayISO
                }
            });

            const taskTitle = task.data.title;
            const taskId = task.data.id;

            await message.delete();

            const replyMessage = await message.channel.send(`✅ 今日のタスクとして「**${taskTitle}**」をGoogle Tasksに登録しました！`);
            taskMap.set(replyMessage.id, taskId);

            await replyMessage.react('❌');
            console.log(`Task created: ${taskId}`);
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
            const tomorrowISO = tomorrow.toISOString().split('T')[0];  

            const task = await tasks.tasks.insert({
                tasklist: '@default',
                requestBody: {
                    title: message.content,
                    notes: 'Discordから追加されたタスク',
                    due: tomorrowISO
                }
            });

            const taskTitle = task.data.title;
            const taskId = task.data.id;

            await message.delete();

            const replyMessage = await message.channel.send(`✅ 明日のタスクとして「**${taskTitle}**」をGoogle Tasksに登録しました！`);
            taskMap.set(replyMessage.id, taskId);

            await replyMessage.react('❌');
            console.log(`Task created: ${taskId}`);
        } catch (error) {
            console.error('Error adding task:', error.response?.data || error.message);
            message.reply('❌ タスクの追加に失敗しました。');
        }
    }
});

// リアクションでタスクを削除
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;

    if (reaction.emoji.name === '❌') {
        const messageId = reaction.message.id;

        if (taskMap.has(messageId)) {
            const taskId = taskMap.get(messageId);
            try {
                await tasks.tasks.delete({
                    tasklist: '@default',
                    task: taskId
                });
                
                await reaction.message.channel.send(`✅ タスク「${reaction.message.content}」を削除しました！`);
                taskMap.delete(messageId); 
            } catch (error) {
                console.error('Error deleting task:', error.response?.data || error.message);
            }
        }
    }
});

client.login(process.env.DISCORD_TOKEN);