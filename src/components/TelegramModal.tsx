import React, { useState, useEffect } from 'react';
import { Bot, Send, CheckCircle2, AlertCircle, X, Shield, RefreshCw } from 'lucide-react';
import { fetchTelegramBotInfo, DEFAULT_TELEGRAM_CHAT_ID } from '../lib/telegram';

interface TelegramModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
  onUpdateChatId: (newChatId: string) => void;
}

export const TelegramModal: React.FC<TelegramModalProps> = ({
  isOpen,
  onClose,
  chatId,
  onUpdateChatId,
}) => {
  const [botInfo, setBotInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [inputChatId, setInputChatId] = useState(chatId || DEFAULT_TELEGRAM_CHAT_ID);

  useEffect(() => {
    if (isOpen) {
      loadBot();
    }
  }, [isOpen]);

  const loadBot = async () => {
    setLoading(true);
    setTestStatus(null);
    const data = await fetchTelegramBotInfo();
    if (data.success && data.bot) {
      setBotInfo(data.bot);
    } else {
      setBotInfo({ error: data.error });
    }
    setLoading(false);
  };

  const handleSendTest = async () => {
    setLoading(true);
    setTestStatus(null);
    try {
      const response = await fetch('/api/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: 'TEST-ROOM-101',
          hostName: 'System Test',
          chatId: inputChatId,
          customNote: 'এটি একটি টেস্ট বার্তা। বট সফলভাবে কাজ করছে!',
        }),
      });
      const resData = await response.json();
      if (resData.success) {
        setTestStatus({
          success: true,
          message: `টেস্ট মেসেজ সফলভাবে চ্যাট আইডি ${inputChatId}-তে পাঠানো হয়েছে! (মেসেজ আইডি: #${resData.messageId})`,
        });
      } else {
        setTestStatus({
          success: false,
          message: resData.error || 'মেসেজ পাঠাতে সমস্যা হয়েছে',
        });
      }
    } catch (e: any) {
      setTestStatus({
        success: false,
        message: e.message || 'নেটওয়ার্ক এরর',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChatId = () => {
    onUpdateChatId(inputChatId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">টেলিগ্রাম বট ইন্টিগ্রেশন</h3>
              <p className="text-xs text-zinc-400">Telegram Bot & Chat Configuration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Bot Card Status */}
          <div className="p-4 rounded-xl bg-zinc-800/60 border border-zinc-700/60">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-medium text-zinc-300">সংযুক্ত বট স্ট্যাটাস:</span>
              </div>
              <button
                onClick={loadBot}
                disabled={loading}
                className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                রিফ্রেশ
              </button>
            </div>

            {botInfo && !botInfo.error ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-sm font-semibold text-white">{botInfo.first_name}</span>
                  {botInfo.username && (
                    <span className="text-xs text-sky-400">@{botInfo.username}</span>
                  )}
                </div>
                <p className="text-xs text-zinc-400">
                  বট আইডি: <span className="font-mono text-zinc-300">{botInfo.id}</span>
                </p>
              </div>
            ) : (
              <div className="text-xs text-amber-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>বট টোকেন কনফিগার করা আছে (টোকেন: 6784439390:AAG7...)</span>
              </div>
            )}
          </div>

          {/* Chat ID Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">
              টার্গেট টেলিগ্রাম চ্যাট আইডি (Target Chat ID):
            </label>
            <input
              type="text"
              value={inputChatId}
              onChange={(e) => setInputChatId(e.target.value)}
              placeholder="e.g. 5440151107"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-white font-mono text-sm focus:outline-none focus:border-sky-500 transition"
            />
            <p className="text-[11px] text-zinc-500">
              ডিফল্ট চ্যাট আইডি: <code className="text-zinc-400">5440151107</code>। ব্যবহারকারী বা চ্যানেলে রুম লিংক পাঠাতে এটি ব্যবহার হয়।
            </p>
          </div>

          {/* Test Status feedback */}
          {testStatus && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                testStatus.success
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/40 border-red-500/40 text-red-300'
              }`}
            >
              {testStatus.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-medium">{testStatus.message}</p>
                {!testStatus.success && (
                  <p className="mt-1 text-[11px] opacity-80">
                    টিপস: টেলিগ্রামে আপনার বটে গিয়ে প্রথমে <b>/start</b> কমান্ড চাপুন যাতে বট মেসেজ পাঠাতে অনুমতি পায়।
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Instructions Box */}
          <div className="p-4 rounded-xl bg-sky-950/20 border border-sky-800/30 text-xs space-y-2 text-zinc-300">
            <p className="font-semibold text-sky-300 flex items-center gap-1.5">
              <span>💡 কীভাবে কাজ করে?</span>
            </p>
            <ol className="list-decimal list-inside space-y-1 text-zinc-400 text-[11px] leading-relaxed">
              <li>আপনি যখন ওয়েবসাইট থেকে নতুন রুম তৈরি করবেন, তখন স্বয়ংক্রিয়ভাবে বা ১-ক্লিকে টেলিগ্রাম বটে মেসেজ চলে যাবে।</li>
              <li>মেসেজে থাকবে ইউনিক রুম আইডি এবং সরাসরি যোগ দেওয়ার বাটন/লিংক।</li>
              <li>যে কেউ টেলিগ্রামের সেই লিংকে ক্লিক করলেই ব্রাউজারে রুম ওপেন হবে এবং ২ জন সরাসরি ভয়েস কলে কথা বলতে পারবে।</li>
            </ol>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-zinc-800 bg-zinc-900/90">
          <button
            type="button"
            onClick={handleSendTest}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border border-sky-500/30 transition disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            টেস্ট মেসেজ পাঠান
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition"
            >
              বাতিল
            </button>
            <button
              type="button"
              onClick={handleSaveChatId}
              className="px-4 py-2 text-xs font-medium rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:brightness-110 shadow-lg shadow-emerald-500/20 transition"
            >
              সংরক্ষণ করুন
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
