import { TelegramSendResult } from '../types';

export interface SendToTelegramOptions {
  roomId: string;
  hostName: string;
  customNote?: string;
}

export async function sendRoomToTelegramBot(options: SendToTelegramOptions): Promise<TelegramSendResult> {
  try {
    const response = await fetch('/api/telegram/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });

    const data = await response.json();
    if (response.ok && data.success) {
      return {
        success: true,
        messageId: data.messageId,
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
