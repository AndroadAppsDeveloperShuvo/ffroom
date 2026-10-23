import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneOff,
  Copy,
  Check,
  Share2,
  Bot,
  Users,
  Clock,
  Sparkles,
  ShieldCheck,
  Send,
  AlertTriangle,
} from 'lucide-react';
import { PeerUser, ChatMessage } from '../types';
import { AudioWave } from './AudioWave';
import { ChatPanel } from './ChatPanel';
import { sendRoomToTelegramBot } from '../lib/telegram';
import { playSound } from '../lib/soundEffects';

interface VoiceRoomViewProps {
  roomId: string;
  userName: string;
  peerId: string;
  partner: PeerUser | null;
  connectionStatus: 'idle' | 'connecting' | 'waiting_partner' | 'connected' | 'call_connected' | 'error';
  messages: ChatMessage[];
  isMuted: boolean;
  isDeafened: boolean;
  localVolume: number;
  remoteVolume: number;
  callDuration: number;
  telegramChatId: string;
  errorMessage: string | null;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onSendMessage: (text: string, audioClip?: string) => void;
  onLeaveRoom: () => void;
}

export const VoiceRoomView: React.FC<VoiceRoomViewProps> = ({
  roomId,
  userName,
  peerId,
  partner,
  connectionStatus,
  messages,
  isMuted,
  isDeafened,
  localVolume,
  remoteVolume,
  callDuration,
  telegramChatId,
  errorMessage,
  onToggleMute,
  onToggleDeafen,
  onSendMessage,
  onLeaveRoom,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);

  // Format call duration MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

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
      chatId: telegramChatId,
      customNote: partner ? 'রুমটিতে ইতিমধ্যে ১ জন যুক্ত আছে!' : 'ডুও পার্টনারের জন্য অপেক্ষা করা হচ্ছে!',
    });

    setIsSendingTelegram(false);
    if (result.success) {
      setTelegramStatus(`টেলিগ্রাম চ্যাটে আইডি পাঠানো হয়েছে! (মেসেজ #${result.messageId})`);
    } else {
      setTelegramStatus(`ত্রুটি: ${result.error || 'টেলিগ্রামে পাঠানো যায়নি'}`);
    }
    setTimeout(() => setTelegramStatus(null), 5000);
  };

  const isLocalSpeaking = Boolean(!isMuted && localVolume > 12);
  const isRemoteSpeaking = Boolean(!isDeafened && partner && !partner.isMuted && remoteVolume > 12);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Room Header Banner */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Room ID and Status */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30 px-3.5 py-1.5 rounded-xl">
              <span className="text-xs text-orange-400 font-medium">রুম আইডি:</span>
              <span className="font-mono font-bold text-white tracking-widest text-base sm:text-lg">
                {roomId}
              </span>
              <button
                onClick={handleCopyId}
                className="p-1 hover:text-orange-400 text-zinc-400 transition"
                title="রুম আইডি কপি করুন"
              >
                {copiedId ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Capacity Badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                partner
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>{partner ? '২/২ জন (ডুও পূর্ণ 🔥)' : '১/২ জন (অপেক্ষায়...)'}</span>
            </div>

            {/* Call Duration if connected */}
            {partner && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/80 border border-zinc-700/60 text-xs font-mono text-zinc-300">
                <Clock className="w-3.5 h-3.5 text-orange-400" />
                <span>{formatTime(callDuration)}</span>
              </div>
            )}
          </div>

          {/* Action Buttons: Telegram & Share */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSendToTelegram}
              disabled={isSendingTelegram}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-sky-600/20 active:scale-95 transition disabled:opacity-50"
            >
              <Bot className="w-4 h-4" />
              <span>{isSendingTelegram ? 'পাঠানো হচ্ছে...' : 'টেলিগ্রাম বটে পাঠান'}</span>
            </button>

            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-medium transition"
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">লিংক কপি হয়েছে!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 text-zinc-400" />
                  <span>লিংক শেয়ার করুন</span>
                </>
              )}
            </button>

            <button
              onClick={onLeaveRoom}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600/20 hover:bg-red-600 border border-red-500/40 text-red-300 hover:text-white text-xs font-semibold transition"
            >
              <PhoneOff className="w-4 h-4" />
              <span>রুম ত্যাগ</span>
            </button>
          </div>
        </div>

        {/* Telegram Feedback Notification */}
        {telegramStatus && (
          <div className="mt-3 p-2.5 rounded-xl bg-sky-950/40 border border-sky-500/40 text-sky-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-sky-400 shrink-0" />
              <span>{telegramStatus}</span>
            </div>
            <span className="text-[10px] text-sky-400/80">চ্যাট আইডি: {telegramChatId}</span>
          </div>
        )}

        {/* Error notification if any */}
        {errorMessage && (
          <div className="mt-3 p-2.5 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Main Grid: 2-Person Voice Stage + Live Chat Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: 2-Person Voice Arena (8 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Duo Stage Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Player 1 Card (You) */}
            <div
              className={`relative flex flex-col items-center p-6 rounded-2xl bg-zinc-900 border transition-all duration-200 overflow-hidden ${
                isLocalSpeaking
                  ? 'border-emerald-500/80 shadow-[0_0_25px_rgba(16,185,129,0.25)]'
                  : 'border-zinc-800'
              }`}
            >
              <div className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-orange-500/10 border border-orange-500/30 text-[10px] font-bold text-orange-400 uppercase tracking-wider">
                হোস্ট / আপনি
              </div>

              {/* Avatar with speaking wave ring */}
              <div className="relative my-4">
                {isLocalSpeaking && (
                  <div className="absolute -inset-2.5 rounded-full bg-emerald-500/20 animate-ping opacity-75"></div>
                )}
                <div
                  className={`relative w-24 h-24 rounded-full flex items-center justify-center font-black text-2xl text-white shadow-xl bg-gradient-to-tr from-orange-600 via-amber-600 to-yellow-500 border-4 ${
                    isLocalSpeaking
                      ? 'border-emerald-400 scale-105'
                      : isMuted
                      ? 'border-red-500/60 opacity-80'
                      : 'border-zinc-700'
                  } transition-all`}
                >
                  {userName.charAt(0).toUpperCase()}
                </div>

                {/* Mic Status Icon Badge */}
                <div
                  className={`absolute -bottom-1 -right-1 p-1.5 rounded-full border-2 border-zinc-900 ${
                    isMuted ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
                  }`}
                >
                  {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </div>
              </div>

              {/* Name & Title */}
              <h3 className="font-bold text-white text-base tracking-wide max-w-full truncate">
                {userName}
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {isMuted ? 'মাইক্রোফোন মিউট করা' : isLocalSpeaking ? 'কথা বলছেন...' : 'কথা শুনছেন'}
              </p>

              {/* Audio visualizer wave */}
              <div className="mt-4">
                <AudioWave
                  volume={localVolume}
                  isSpeaking={isLocalSpeaking}
                  isMuted={isMuted}
                  color="from-amber-400 to-orange-500"
                />
              </div>
            </div>

            {/* Player 2 Card (Partner) */}
            <div
              className={`relative flex flex-col items-center justify-center p-6 rounded-2xl bg-zinc-900 border transition-all duration-200 overflow-hidden ${
                partner
                  ? isRemoteSpeaking
                    ? 'border-emerald-500/80 shadow-[0_0_25px_rgba(16,185,129,0.25)]'
                    : 'border-zinc-800'
                  : 'border-dashed border-zinc-700/80 bg-zinc-900/40'
              }`}
            >
              <div className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/30 text-[10px] font-bold text-sky-400 uppercase tracking-wider">
                ডুও পার্টনার
              </div>

              {partner ? (
                <>
                  {/* Partner Connected */}
                  <div className="relative my-4">
                    {isRemoteSpeaking && (
                      <div className="absolute -inset-2.5 rounded-full bg-emerald-500/20 animate-ping opacity-75"></div>
                    )}
                    <div
                      className={`relative w-24 h-24 rounded-full flex items-center justify-center font-black text-2xl text-white shadow-xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-purple-600 border-4 ${
                        isRemoteSpeaking
                          ? 'border-emerald-400 scale-105'
                          : partner.isMuted
                          ? 'border-red-500/60 opacity-80'
                          : 'border-zinc-700'
                      } transition-all`}
                    >
                      {partner.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Mic Status Icon Badge */}
                    <div
                      className={`absolute -bottom-1 -right-1 p-1.5 rounded-full border-2 border-zinc-900 ${
                        partner.isMuted ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
                      }`}
                    >
                      {partner.isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    </div>
                  </div>

                  <h3 className="font-bold text-white text-base tracking-wide max-w-full truncate">
                    {partner.name}
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {partner.isMuted
                      ? 'পার্টনার মিউট'
                      : isRemoteSpeaking
                      ? 'কথা বলছেন...'
                      : 'কানেক্টেড'}
                  </p>

                  <div className="mt-4">
                    <AudioWave
                      volume={remoteVolume}
                      isSpeaking={isRemoteSpeaking}
                      isMuted={isDeafened || partner.isMuted}
                      color="from-sky-400 to-emerald-400"
                    />
                  </div>
                </>
              ) : (
                /* Waiting for Partner Radar */
                <div className="my-6 flex flex-col items-center text-center space-y-3">
                  <div className="relative w-20 h-20 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-2 border-orange-500/40 animate-ping"></div>
                    <Users className="w-8 h-8 text-zinc-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-zinc-200 text-sm">
                      পার্টনারের জন্য অপেক্ষা...
                    </h4>
                    <p className="text-[11px] text-zinc-500 mt-1 max-w-[200px]">
                      টেলিগ্রাম বটে রুম আইডি পাঠানো হয়েছে। লিংক শেয়ার করুন যাতে পার্টনার সরাসরি যোগ দিতে পারে।
                    </p>
                  </div>
                  <button
                    onClick={handleSendToTelegram}
                    className="px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-medium flex items-center gap-1.5 transition"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    টেলিগ্রামে মনে করিয়ে দিন
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Audio Control Dock */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            {/* Mic Toggle Button */}
            <button
              onClick={onToggleMute}
              className={`flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-bold text-sm tracking-wide shadow-lg transition-all active:scale-95 cursor-pointer ${
                isMuted
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30 ring-2 ring-red-400/50'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 ring-2 ring-emerald-400/50'
              }`}
            >
              {isMuted ? (
                <>
                  <MicOff className="w-5 h-5" />
                  <span>আনমিউট করুন (Muted)</span>
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5 animate-pulse" />
                  <span>কথা বলুন (Mic ON)</span>
                </>
              )}
            </button>

            {/* Deafen Toggle Button */}
            <button
              onClick={onToggleDeafen}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-semibold border transition ${
                isDeafened
                  ? 'bg-red-950/60 border-red-500 text-red-300'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-700'
              }`}
            >
              {isDeafened ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span>{isDeafened ? 'স্পিকার বন্ধ (Deafened)' : 'স্পিকার চালু'}</span>
            </button>
          </div>

          {/* Tips Card */}
          <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-xs text-zinc-400 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold text-zinc-200">হাই-কোয়ালিটি WebRTC অডিও:</span>{' '}
              আপনার ভয়েস Peer-to-Peer সরাসরি এনক্রিপ্ট হয়ে পার্টনারের কাছে পৌঁছে যাচ্ছে। ব্যাকগ্রাউন্ড নয়েজ সাপ্রেশন ও অটো-ইকো ক্যান্সেলেশন সক্রিয় রয়েছে।
            </div>
          </div>
        </div>

        {/* Right: Real-time Live Chat Panel (5 cols) */}
        <div className="lg:col-span-5">
          <ChatPanel
            messages={messages}
            currentUserId={peerId}
            onSendMessage={onSendMessage}
          />
        </div>
      </div>
    </div>
  );
};
