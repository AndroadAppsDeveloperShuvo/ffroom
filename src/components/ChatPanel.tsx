import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Square, MessageSquare, Volume2, Sparkles } from 'lucide-react';
import { ChatMessage } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSendMessage: (text: string, audioClip?: string) => void;
}

const QUICK_PHRASES = [
  'Enemy Ahead! 🎯',
  'Rush Karo! ⚡',
  'Cover Me! 🛡️',
  'Revive Me! 💉',
  'Safe Zone-এ চলো 🏃',
  'Ready Duo! 🔥',
];

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  currentUserId,
  onSendMessage,
}) => {
  const [inputText, setInputText] = useState('');
  const [isRecordingNote, setIsRecordingNote] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  const handleQuickPhrase = (phrase: string) => {
    onSendMessage(phrase);
  };

  // Start voice note recording
  const startRecordingVoiceNote = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Convert to base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          onSendMessage('🎤 [ভয়েস নোট]', base64Audio);
        };
        // Stop stream tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecordingNote(true);
      setRecordingDuration(0);

      recordIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= 30) {
            // max 30 sec auto stop
            stopRecordingVoiceNote();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (e) {
      console.warn('Cannot record voice clip:', e);
    }
  };

  const stopRecordingVoiceNote = () => {
    if (mediaRecorderRef.current && isRecordingNote) {
      mediaRecorderRef.current.stop();
      setIsRecordingNote(false);
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/90 rounded-2xl border border-zinc-800 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-orange-400" />
          <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
            রিয়েল-টাইম লাইভ চ্যাট
          </h4>
        </div>
        <span className="text-[11px] text-zinc-500 font-mono">
          {messages.length} টি বার্তা
        </span>
      </div>

      {/* Messages list */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-[220px] max-h-[360px]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
            <Sparkles className="w-8 h-8 text-zinc-600 mb-2 stroke-[1.5]" />
            <p className="text-xs text-zinc-400">এখনো কোনো মেসেজ আসেনি</p>
            <p className="text-[11px] text-zinc-600 mt-1">
              কথা বলার পাশাপাশি এখানে টেক্সট বা দ্রুত ভয়েস নোট পাঠাতে পারেন
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <span className="text-[10px] text-zinc-400 mb-0.5 px-1">
                  {isMe ? 'আপনি' : msg.senderName}
                </span>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs shadow-sm ${
                    isMe
                      ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-tr-none'
                      : 'bg-zinc-800 text-zinc-200 border border-zinc-700/60 rounded-tl-none'
                  }`}
                >
                  <p className="break-words leading-relaxed">{msg.text}</p>

                  {/* Render audio player if voice note */}
                  {msg.audioClip && (
                    <div className="mt-2 pt-1 border-t border-white/20">
                      <audio controls src={msg.audioClip} className="h-7 w-48 max-w-full" />
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-zinc-500 mt-0.5 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Tactical Phrases */}
      <div className="px-3 py-2 bg-zinc-950/40 border-t border-zinc-800/80 overflow-x-auto no-scrollbar flex items-center gap-1.5">
        {QUICK_PHRASES.map((phrase) => (
          <button
            key={phrase}
            type="button"
            onClick={() => handleQuickPhrase(phrase)}
            className="shrink-0 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/50 transition cursor-pointer active:scale-95"
          >
            {phrase}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <div className="p-3 bg-zinc-900 border-t border-zinc-800">
        {isRecordingNote ? (
          <div className="flex items-center justify-between p-2 rounded-xl bg-red-950/40 border border-red-500/50 text-red-300 animate-pulse">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
              <span>ভয়েস নোট রেকর্ড হচ্ছে... ({recordingDuration}s)</span>
            </div>
            <button
              type="button"
              onClick={stopRecordingVoiceNote}
              className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition"
            >
              <Square className="w-3 h-3 fill-white" />
              পাঠান
            </button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex items-center gap-2">
            {/* Voice Note Record Button */}
            <button
              type="button"
              onClick={startRecordingVoiceNote}
              title="ভয়েস নোট রেকর্ড করুন"
              className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-orange-400 border border-zinc-700/60 transition"
            >
              <Mic className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="মেসেজ লিখুন..."
              className="flex-1 bg-zinc-800/90 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition"
            />

            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100 transition shadow-md shadow-orange-500/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
