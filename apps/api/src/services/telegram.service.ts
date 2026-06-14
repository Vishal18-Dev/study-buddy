// Telegram notification service — STUBBED for MVP
// Wire live keys in TELEGRAM_BOT_TOKEN env var when ready

export interface TelegramMessage {
  chatId: string;
  text: string;
}

export async function sendTelegramMessage(params: TelegramMessage): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN === 'your-telegram-token-here') {
    console.log(`[Telegram STUB] Would send to ${params.chatId}: ${params.text}`);
    return;
  }

  // Live implementation — uncomment when TELEGRAM_BOT_TOKEN is set
  // const TelegramBot = require('node-telegram-bot-api');
  // const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
  // await bot.sendMessage(params.chatId, params.text);
  console.log(`[Telegram] Message queued for ${params.chatId}`);
}

export async function sendStreakMilestone(telegramId: string, message: string): Promise<void> {
  await sendTelegramMessage({ chatId: telegramId, text: `🔥 ${message}` });
}
