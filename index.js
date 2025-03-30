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
        GatewayIntentBits.GuildMessageReactions // リアクションのために追加
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
            const todayISO = today.toISOString().split('T')[0]; // YYYY-MM-DD 形式

            const task = await tasks.tasks.insert({
                tasklist: '@default',
                requestBody: {
                    title: message.content,
                    notes: 'Discordから追加されたタスク',
                    due: `${todayISO}T00:00:00.000Z`  // タスクの期限をUTC 0時に設定
                }
            });

            const taskTitle = task.data.title;

            await message.delete();
            const replyMessage = await message.channel.send(`✅ 今日のタスクとして「**${taskTitle}**」をGoogle Tasksに登録しました！`);
            console.log(`Task created: ${task.data.id}`);

            await replyMessage.react('✅'); // リアクション追加
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
            const tomorrowISO = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD 形式

            const task = await tasks.tasks.insert({
                tasklist: '@default',
                requestBody: {
                    title: message.content,
                    notes: 'Discordから追加されたタスク',
                    due: `${tomorrowISO}T00:00:00.000Z`  // タスクの期限をUTC 0時に設定
                }
            });

            const taskTitle = task.data.title;

            await message.delete();
            const replyMessage = await message.channel.send(`✅ 明日のタスクとして「**${taskTitle}**」をGoogle Tasksに登録しました！`);
            console.log(`Task created: ${task.data.id}`);

            await replyMessage.react('✅'); // リアクション追加
        } catch (error) {
            console.error('Error adding task:', error.response?.data || error.message);
            message.reply('❌ タスクの追加に失敗しました。');
        }
    }
});

client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.emoji.name === '✅') {
        try {
            const message = reaction.message;
            const taskTitle = message.content.match(/「\*\*(.*)\*\*」/)[1]; // タスク名を取り出す正規表現

            const taskLists = await tasks.tasklists.list();
            const taskListId = taskLists.data.items[0].id;

            const taskList = await tasks.tasks.list({
                tasklist: taskListId
            });

            const task = taskList.data.items.find(t => t.title === taskTitle);

            if (task) {
                await tasks.tasks.delete({
                    tasklist: taskListId,
                    task: task.id
                });

                await message.delete(); // メッセージを削除
                console.log(`Task deleted: ${task.id}`);
            } else {
                console.log(`Task not found: ${taskTitle}`);
            }
        } catch (error) {
            console.error('Error deleting task:', error.response?.data || error.message);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);