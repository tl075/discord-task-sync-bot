require("dotenv").config();
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const fetch = require("node-fetch");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.MessageReactions
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.Channel]
});

// 設定値
const todayChannelId = process.env.TODAY_CHANNEL_ID;
const tomorrowChannelId = process.env.TOMORROW_CHANNEL_ID;
const taskMap = new Map(); // replyMsgId -> taskId

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const channelId = message.channel.id;
  let dueDate = new Date();

  if (channelId === tomorrowChannelId) {
    dueDate.setDate(dueDate.getDate() + 1); // 明日
  } else if (channelId === todayChannelId) {
    // 何もしない（今日のまま）
  } else {
    return; // 他チャンネルは無視
  }

  dueDate.setHours(9, 0, 0, 0);

  // GASへ送信してタスク登録
  const res = await fetch(process.env.GAS_WEBHOOK_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "create",
      content: message.content,
      due: dueDate.toISOString()
    }),
    headers: { "Content-Type": "application/json" }
  });

  const result = await res.json();

  // Botが返信して ❌リアクションをつける
  const reply = await message.reply(`✅ 「${message.content}」をタスクに追加しました！`);
  await reply.react("❌");

  // taskId保存
  taskMap.set(reply.id, result.taskId);
});

client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;
  if (reaction.emoji.name !== "❌") return;

  const messageId = reaction.message.id;
  const taskId = taskMap.get(messageId);
  if (!taskId) return;

  // GASへ削除リクエスト
  await fetch(process.env.GAS_WEBHOOK_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "delete",
      taskId
    }),
    headers: { "Content-Type": "application/json" }
  });

  await reaction.message.reply("🗑️ タスクを削除しました！");
  taskMap.delete(messageId);
});

client.login(process.env.DISCORD_TOKEN);