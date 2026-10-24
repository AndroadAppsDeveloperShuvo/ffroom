import React, { useState } from 'react';
import {
  PhoneOff,
  Copy,
  Check,
  Share2,
  Bot,
  Users,
  AlertTriangle,
  ArrowRightLeft,
} from 'lucide-react';
import { PeerUser, ChatMessage } from '../types';
import { ChatPanel } from './ChatPanel';
import { sendRoomToTelegramBot } from '../lib/telegram';
import { playSound } from '../lib/soundEffects';

interface VoiceRoomViewProps {
  roomId: string;
  userName: string;
  peerId: string;
  isHost: boolean;
  partner: PeerUser | null;
  connectionStatus: 'idle' | 'connecting' | 'waiting_partner' | 'connected' | 'call_connected' | 'error';
  messages: ChatMessage[];
  errorMessage: string | null;
  onSendMessage: (text: string, audioClip?: string, imageUrl?: string) => void;
  onLeaveRoom: () => void;
}

export const VoiceRoomView: React.FC<VoiceRoomViewProps> = ({
  roomId,
  userName,
  peerId,
  isHost,
  partner,
  connectionStatus,
  messages,
  errorMessage,
  onSendMessage,
  onLeaveRoom,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);

  const roomLink = `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(roomLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(roomId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSendToTelegram = async () => {
    setIsSendingTelegram(true);
    setTelegramStatus(null);
    playSound('telegram');

    const result = await sendRoomToTelegramBot({
      roomId,
      hostName: userName,
      customNote: partner ? 'রুমটিতে ইতিমধ্যে ১ জন যুক্ত আছে!' : 'ডুও পার্টনারের জন্য অপেক্ষা করা হচ্ছে!',
    });

    setIsSendingTelegram(false);
    if (result.success) {
      setTelegramStatus('টেলিগ্রাম বটে ইউনিক রুম আইডি পাঠানো হয়েছে!');
    } else {
      setTelegramStatus(`ত্রুটি: ${result.error || 'টেলিগ্রামে পাঠানো যায়নি'}`);
    }
    setTimeout(() => setTelegramStatus(null), 5000);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-2.5 sm:px-4 py-2 sm:py-4 space-y-2.5 sm:space-y-3.5 overflow-hidden">
      {/* Top Header Card: Responsive & Clean (Never breaks horizontally on mobile) */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3 sm:p-4 shadow-xl backdrop-blur-md space-y-2.5">
        {/* Row 1: Room ID, Capacity & Room Leave button */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-wrap">
            {/* Room ID Badge */}
            <div className="flex items-center gap-1.5 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30 px-2.5 py-1 rounded-xl shrink-0">
              <span className="text-[11px] text-orange-400 font-medium">রুম:</span>
              <span className="font-mono font-bold text-white tracking-wide text-xs sm:text-sm">
                {roomId}
              </span>
              <button
                onClick={handleCopyId}
                className="p-1 hover:text-orange-400 text-zinc-400 transition"
                title="রুম আইডি কপি করুন"
              >
                {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Capacity Badge */}
            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-semibold shrink-0 whitespace-nowrap ${
                partner
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
              }`}
            >
              <Users className="w-3 h-3 shrink-0" />
              <span>{partner ? '২/২ ডুও 🔥' : '১/২ অপেক্ষমান'}</span>
            </div>
          </div>

          {/* Leave Button */}
          <button
            onClick={onLeaveRoom}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600 border border-red-500/40 text-red-300 hover:text-white text-xs font-semibold transition shrink-0 active:scale-95"
            title="রুম ত্যাগ করুন"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">রুম ত্যাগ</span>
            <span className="xs:hidden">ত্যাগ</span>
          </button>
        </div>

        {/* Row 2: 2-Column Action Grid (Always fits on all phones without clipping) */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleSendToTelegram}
            disabled={isSendingTelegram}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-sky-600/20 active:scale-95 transition disabled:opacity-50 min-w-0"
          >
            <Bot className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{isSendingTelegram ? 'পাঠানো হচ্ছে...' : 'টেলিগ্রাম বটে পাঠান'}</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-medium transition active:scale-95 min-w-0"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-emerald-400 truncate">কপি হয়েছে!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="truncate">লিংক শেয়ার</span>
              </>
            )}
          </button>
        </div>

        {/* Telegram Feedback Notification */}
        {telegramStatus && (
          <div className="p-2 rounded-xl bg-sky-950/40 border border-sky-500/40 text-sky-300 text-xs flex items-center gap-2">
            <Bot className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="text-[11px] leading-tight truncate">{telegramStatus}</span>
          </div>
        )}

        {/* Error notification if any */}
        {errorMessage && (
          <div className="p-2 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="text-[11px] leading-tight truncate">{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Compact Duo Presence Circles Bar (Side-by-side, sleek, responsive on all devices) */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900/95 to-zinc-900 border border-zinc-800/90 rounded-2xl p-2 sm:p-3 shadow-lg">
        <div className="grid grid-cols-2 gap-2 relative">
          
          {/* Center Connector Indicator */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
            <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shadow-lg">
              <ArrowRightLeft className="w-3 h-3 text-orange-400" />
            </div>
          </div>

          {/* User 1 Circle (You) */}
          <div className="flex items-center gap-2 p-2 rounded-xl bg-zinc-800/40 border border-zinc-700/40 min-w-0 pr-3.5">
            <div className="relative shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm sm:text-base text-white shadow-md bg-gradient-to-tr from-orange-600 via-amber-600 to-yellow-500 border-2 border-orange-400/80">
                {userName.charAt(0).toUpperCase()}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-zinc-900 rounded-full"></span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 min-w-0">
                <span className="font-semibold text-white text-xs truncate">
                  {userName}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[9px] px-1 py-0.2 rounded bg-orange-500/20 text-orange-300 font-medium whitespace-nowrap">
                  {isHost ? '👑 হোস্ট' : '🎮 আপনি'}
                </span>
                <span className="text-[9px] text-emerald-400 font-medium hidden sm:inline whitespace-nowrap">
                  ● অনলাইন
                </span>
              </div>
            </div>
          </div>

          {/* User 2 Circle (Partner or Waiting) */}
          <div className="flex items-center gap-2 p-2 rounded-xl bg-zinc-800/40 border border-zinc-700/40 min-w-0 pl-3.5">
            {partner ? (
              <>
                <div className="relative shrink-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm sm:text-base text-white shadow-md bg-gradient-to-tr from-sky-600 via-indigo-600 to-purple-600 border-2 border-sky-400/80">
                    {partner.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-zinc-900 rounded-full"></span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="font-semibold text-white text-xs truncate">
                      {partner.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[9px] px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 font-medium whitespace-nowrap">
                      {partner.isHost ? '👑 হোস্ট' : '🎮 ডুও'}
                    </span>
                    <span className="text-[9px] text-emerald-400 font-medium hidden sm:inline whitespace-nowrap">
                      ● যুক্ত 🔥
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="relative shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-dashed border-amber-500/50 bg-amber-500/10 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></div>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-amber-300 text-xs block truncate">
                    অপেক্ষায়...
                  </span>
                  <span className="text-[9px] text-zinc-400 block truncate">
                    ১ জন বাকি
                  </span>
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      {/* Main Room Interaction Area: Responsive Chat Panel (Voice Filters + Text + Photos) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
        <ChatPanel
          messages={messages}
          currentUserId={peerId}
          onSendMessage={onSendMessage}
        />
      </div>
    </div>
  );
};
