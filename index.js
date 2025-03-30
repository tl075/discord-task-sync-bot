const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
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
            const todayISO = today.toISOString();  // フルISOフォーマット

            const task = await tasks.tasks.insert({
              tasklist: '@default',
              requestBody: {
                    title: message.content,
                    notes: 'Discordから追加されたタスク',
                    due: todayISO  // ここをフルISOフォーマットに変更
             }
        });

            const taskTitle = task.data.title;

            // ユーザーのメッセージを削除する
            await message.delete();

            // Botからタスク名を返信
            const sentMessage = await message.channel.send(`✅ 今日のタスクとして「**${taskTitle}**」をGoogle Tasksに登録しました！`);
            console.log(`Task created: ${task.data.id}`);

            // メッセージにリアクションを追加
            await sentMessage.react('✅');
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
            const tomorrowISO = tomorrow.toISOString();  // フルISOフォーマットで渡す

            const task = await tasks.tasks.insert({
                tasklist: '@default',
                requestBody: {
                    title: message.content,
                    notes: 'Discordから追加されたタスク',
                    due: tomorrowISO  // フルISOフォーマットを使用
                }
            });

            const taskTitle = task.data.title;

            // ユーザーのメッセージを削除する
            await message.delete();

            // Botからタスク名を返信
            const sentMessage = await message.channel.send(`✅ 明日のタスクとして「**${taskTitle}**」をGoogle Tasksに登録しました！`);
            console.log(`Task created: ${task.data.id}`);

            // メッセージにリアクションを追加
            await sentMessage.react('✅');
        } catch (error) {
            console.error('Error adding task:', error.response?.data || error.message);
            message.reply('❌ タスクの追加に失敗しました。');
        }
    }
});

// リアクションイベントを処理
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return; // Botのリアクションは無視

    const message = reaction.message;

    // リアクションが ✅ であることを確認
    if (reaction.emoji.name === '✅') {
        try {
            // メッセージに含まれる Task ID を取得 (例: Task created: <task_id>)
            const taskIdMatch = message.content.match(/Task created: (\S+)/);
            if (!taskIdMatch) return;

            const taskId = taskIdMatch[1];
            const tasklist = '@default';

            // Google Tasks API からタスクを削除
            await tasks.tasks.delete({
                tasklist,
                task: taskId,
            });

            // メッセージを削除
            await message.delete();

            console.log(`Task deleted: ${taskId}`);
        } catch (error) {
            console.error('Error deleting task:', error.response?.data || error.message);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);