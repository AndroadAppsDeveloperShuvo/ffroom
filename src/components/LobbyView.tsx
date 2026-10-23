import React, { useState } from 'react';
import {
  Flame,
  PlusCircle,
  LogIn,
  Bot,
  Sparkles,
  Dice5,
  Send,
  CheckCircle2,
  AlertCircle,
  Copy,
  Radio,
  ExternalLink,
  Shield,
} from 'lucide-react';
import { sendRoomToTelegramBot } from '../lib/telegram';
import { playSound } from '../lib/soundEffects';

interface LobbyViewProps {
  userName: string;
  onUpdateUserName: (name: string) => void;
  onJoinRoom: (roomId: string, hostName?: string, asHost?: boolean) => void;
  initialRoomId?: string;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  userName,
  onUpdateUserName,
  onJoinRoom,
  initialRoomId = '',
}) => {
  // Generate random 6-character unique ID
  const generateUniqueId = () => {
    const num = Math.floor(1000 + Math.random() * 9000);
    return `FF-${num}`;
  };

  const [createRoomId, setCreateRoomId] = useState(generateUniqueId);
  const [joinRoomIdInput, setJoinRoomIdInput] = useState(initialRoomId);
  const [customNote, setCustomNote] = useState('');
  const [autoSendTelegram, setAutoSendTelegram] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [createStatus, setCreateStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  const handleRandomizeId = () => {
    setCreateRoomId(generateUniqueId());
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createRoomId.trim()) return;

    setIsCreating(true);
    setCreateStatus(null);
    const targetRoomId = createRoomId.trim().toUpperCase();

    // If autoSendTelegram is checked, dispatch to Telegram Bot securely via backend
    if (autoSendTelegram) {
      try {
        const tgResult = await sendRoomToTelegramBot({
          roomId: targetRoomId,
          hostName: userName,
          customNote: customNote || 'ফ্রি ফায়ার ডুও রুম তৈরি হয়েছে!',
        });

        if (tgResult.success) {
          playSound('telegram');
          setCreateStatus({
            success: true,
            message: 'টেলিগ্রাম বটে ইউনিক রুম আইডি পাঠানো হয়েছে!',
          });
        } else {
          setCreateStatus({
            success: false,
            message: `টেলিগ্রাম সতর্কতা: ${tgResult.error}`,
          });
        }
      } catch (err) {
        console.warn('Telegram send warning:', err);
      }
    }

    // Join room directly as host
    setTimeout(() => {
      setIsCreating(false);
      onJoinRoom(targetRoomId, userName, true);
    }, 600);
  };

  const handleJoinExisting = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinRoomIdInput.trim().toUpperCase();
    if (cleaned) {
      onJoinRoom(cleaned, userName, false);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        // extract room code if url
        const match = text.match(/room=([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          setJoinRoomIdInput(match[1]);
        } else {
          setJoinRoomIdInput(text.trim());
        }
      }
    } catch {
      // clipboard read denied
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">
      {/* Hero Section */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-semibold">
          <Flame className="w-4 h-4 text-orange-500" />
          <span>রিয়েল-টাইম ২ জনের লাইভ ভয়েস প্ল্যাটফর্ম</span>
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
          ইউনিক রুম তৈরি করুন ও{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-rose-400">
            টেলিগ্রাম বটে শেয়ার করুন
          </span>
        </h2>
        <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          একটি রুম তৈরি করুন, টেলিগ্রাম বটে তাৎক্ষণিক রুম আইডি ও সরাসরি লিংক পাঠিয়ে দিন।
          বটের মেসেজ থেকে আপনার বন্ধু ১-ক্লিকেই আপনার রুমে জয়েন করে সরাসরি কথা বলতে পারবে।
        </p>
      </div>

      {/* Main Action Cards: Create & Join */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Create Unique Room */}
        <div className="relative rounded-3xl bg-zinc-900/90 border border-zinc-800 p-6 sm:p-7 shadow-2xl flex flex-col justify-between overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
                <PlusCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">নতুন ইউনিক রুম তৈরি করুন</h3>
                <p className="text-xs text-zinc-400">Create Unique Duo Voice Room</p>
              </div>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              {/* Unique Room ID generator */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                  <span>ইউনিক রুম আইডি:</span>
                  <button
                    type="button"
                    onClick={handleRandomizeId}
                    className="text-orange-400 hover:text-orange-300 flex items-center gap-1 text-[11px]"
                  >
                    <Dice5 className="w-3.5 h-3.5" />
                    নতুন আইডি
                  </button>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={createRoomId}
                    onChange={(e) => setCreateRoomId(e.target.value.toUpperCase())}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-zinc-800/90 border border-zinc-700 text-white font-mono font-bold text-base tracking-wider focus:outline-none focus:border-orange-500 transition uppercase"
                  />
                  <span className="absolute right-3 top-3.5 text-xs text-zinc-500 font-mono">
                    UNIQUE
                  </span>
                </div>
              </div>

              {/* Host / Your Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  আপনার নাম / গেমার ট্যাগ:
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => onUpdateUserName(e.target.value)}
                  required
                  placeholder="e.g. Pro Player"
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-800/90 border border-zinc-700 text-white text-sm focus:outline-none focus:border-orange-500 transition"
                />
              </div>

              {/* Custom Note for Telegram */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  মেসেজ নোট (টেলিগ্রামে যাবে):
                </label>
                <input
                  type="text"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="e.g. কাস্টম ম্যাচ খেলব, দ্রুত আসো!"
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-800/90 border border-zinc-700 text-white text-sm focus:outline-none focus:border-orange-500 transition"
                />
              </div>

              {/* Auto send to Telegram Bot toggle */}
              <div className="p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/60">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-semibold text-zinc-200">
                      টেলিগ্রাম বটে স্বয়ংক্রিয়ভাবে পাঠান
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoSendTelegram}
                    onChange={(e) => setAutoSendTelegram(e.target.checked)}
                    className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
                  />
                </label>
              </div>

              {/* Status Message */}
              {createStatus && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    createStatus.success
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                  }`}
                >
                  {createStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{createStatus.message}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isCreating}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-rose-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-orange-500/25 hover:brightness-110 active:scale-[0.99] transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <span>রুম তৈরি হচ্ছে...</span>
                ) : (
                  <>
                    <Flame className="w-4 h-4" />
                    <span>রুম তৈরি করুন ও প্রবেশ করুন</span>
                    {autoSendTelegram && <Send className="w-3.5 h-3.5 ml-1 text-white/80" />}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Card 2: Join Existing Room */}
        <div className="relative rounded-3xl bg-zinc-900/90 border border-zinc-800 p-6 sm:p-7 shadow-2xl flex flex-col justify-between overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
                <LogIn className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">সরাসরি রুমে যোগ দিন</h3>
                <p className="text-xs text-zinc-400">Join via Unique Room ID</p>
              </div>
            </div>

            <form onSubmit={handleJoinExisting} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                  <span>রুম আইডি লিখুন:</span>
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="text-sky-400 hover:text-sky-300 flex items-center gap-1 text-[11px]"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    পেস্ট করুন
                  </button>
                </label>
                <input
                  type="text"
                  value={joinRoomIdInput}
                  onChange={(e) => setJoinRoomIdInput(e.target.value.toUpperCase())}
                  required
                  placeholder="e.g. FF-8294"
                  className="w-full px-4 py-3 rounded-xl bg-zinc-800/90 border border-zinc-700 text-white font-mono font-bold text-base tracking-wider focus:outline-none focus:border-sky-500 transition uppercase"
                />
              </div>

              <div className="p-4 rounded-xl bg-zinc-800/40 border border-zinc-700/50 space-y-2 text-xs text-zinc-300">
                <div className="flex items-center gap-2 font-semibold text-sky-300">
                  <Bot className="w-4 h-4" />
                  <span>টেলিগ্রাম থেকে কীভাবে জয়েন করবেন?</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  টেলিগ্রাম বটে আসা মেসেজের <b>"🎙️ সরাসরি রুমে জয়েন করুন"</b> বাটনে চাপলে সরাসরি ব্রাউজারে রুম ওপেন হবে এবং মাইক্রোফোন চালু হয়ে ২ জন কথা বলতে পারবেন।
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  disabled={!joinRoomIdInput.trim()}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 text-white font-bold text-sm tracking-wide shadow-lg shadow-sky-600/25 hover:brightness-110 active:scale-[0.99] transition cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>রুমে জয়েন করুন</span>
                </button>
              </div>
            </form>
          </div>

          {/* Quick Info footer */}
          <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500">
            <span>ক্যাপাসিটি: ২ জন (1-on-1 Duo)</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              WebRTC P2P Voice
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
