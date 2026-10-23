import { TelegramSendResult } from '../types';

export const DEFAULT_TELEGRAM_CHAT_ID = '5440151107';

export interface SendToTelegramOptions {
  roomId: string;
  hostName: string;
  chatId?: string;
  customNote?: string;
}

export async function sendRoomToTelegramBot(options: SendToTelegramOptions): Promise<TelegramSendResult> {
  try {
    const origin = window.location.origin;
    const response = await fetch('/api/telegram/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...options,
        appOrigin: origin,
      }),
    });

    const data = await response.json();
    if (response.ok && data.success) {
      return {
        success: true,
        messageId: data.messageId,
        joinUrl: data.joinUrl,
      };
    } else {
      return {
        success: false,
        error: data.error || 'Failed to send to Telegram',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network request failed',
    };
  }
}

export async function fetchTelegramBotInfo() {
  try {
    const response = await fetch('/api/telegram/bot-info');
    const data = await response.json();
    return data;
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
