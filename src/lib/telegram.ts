import { TelegramSendResult } from '../types';

export interface SendToTelegramOptions {
  roomId: string;
  hostName: string;
  customNote?: string;
}

const DEFAULT_BOT_TOKEN = '6784439390:AAG7Kxh2F04J-3HAmFEwErDxPo84qXe0L9s';
const DEFAULT_CHAT_ID = '5440151107';
const SITE_URL = 'https://ffroom.vercel.app/';

export async function sendRoomToTelegramBot(options: SendToTelegramOptions): Promise<TelegramSendResult> {
  const banglaTime = new Date().toLocaleTimeString('bn-BD', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const captionText = 
`🎮 <b>নতুন ডুও ভয়েস রুম তৈরি হয়েছে!</b>
━━━━━━━━━━━━━━━━━━━━
🆔 <b>রুম আইডি:</b> <code>${options.roomId}</code>
👤 <b>হোস্ট:</b> ${options.hostName || 'Player'}
⏰ <b>সময়:</b> ${banglaTime}
${options.customNote ? `📝 <b>নোট:</b> ${options.customNote}\n` : ''}━━━━━━━━━━━━━━━━━━━━
👉 <b>নিচের বাটনে চাপ দিয়ে সাইটে গিয়ে রুম আইডিটি লিখুন এবং সরাসরি রুমে জয়েন করুন।</b>`;

  const directTelegramPayload = {
    chat_id: DEFAULT_CHAT_ID,
    text: captionText,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🌐 সাইট ওপেন করুন',
            url: SITE_URL,
          },
        ],
      ],
    },
  };

  // 1. Try local/backend API first (if available on fullstack server)
  try {
    const response = await fetch('/api/telegram/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (response.ok && data.success) {
        return {
          success: true,
          messageId: data.messageId,
        };
      }
    }
  } catch {
    // If backend endpoint is missing or returns HTML (e.g. Vercel static deployment),
    // proceed to direct Telegram Bot API dispatch below.
  }

  // 2. Direct Telegram Bot API dispatch (Works 100% on Vercel, static SPA, and all browsers)
  try {
    const directRes = await fetch(`https://api.telegram.org/bot${DEFAULT_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(directTelegramPayload),
    });

    const text = await directRes.text();
    let directData: any = {};
    try {
      directData = JSON.parse(text);
    } catch {
      return {
        success: false,
        error: 'টেলিগ্রাম সার্ভার থেকে অপ্রত্যাশিত উত্তর এসেছে।',
      };
    }

    if (directData.ok) {
      return {
        success: true,
        messageId: directData.result?.message_id,
      };
    } else {
      return {
        success: false,
        error: directData.description || 'টেলিগ্রাম বট মেসেজ পাঠাতে পারেনি।',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'টেলিগ্রাম নেটওয়ার্ক সংযোগ ব্যর্থ হয়েছে।',
    };
  }
}
