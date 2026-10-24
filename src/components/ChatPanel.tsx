import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Mic,
  Square,
  MessageSquare,
  Sparkles,
  Image as ImageIcon,
  X,
  Maximize2,
  Download,
  Loader2,
} from 'lucide-react';
import { ChatMessage } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSendMessage: (text: string, audioClip?: string, imageUrl?: string) => void;
}

const QUICK_PHRASES = [
  'Ready Duo! 🔥',
  'কালেকশন ছবি দিন 📸',
  'লেভেল কত? 🎮',
  'আইডি কোড দিন 🆔',
  'দাম কত রাখবেন? 💰',
  'ডিল কনফার্ম! 🤝',
];

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  currentUserId,
  onSendMessage,
}) => {
  const [inputText, setInputText] = useState('');
  const [isRecordingNote, setIsRecordingNote] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Gallery image selection & compression states
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<{ url: string; sender: string; time: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle ESC key to close fullscreen image
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFullscreenImage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compress image on client via Canvas to ensure fast real-time transfer
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          const maxDimension = 1200;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(event.target?.result as string);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          // Compress to JPEG with 0.72 quality (~40-80KB)
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.72);
          resolve(compressedDataUrl);
        };
        img.onerror = () => reject(new Error('Image decode error'));
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsDataURL(file);
    });
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) return;

    setIsCompressing(true);
    try {
      const compressedBase64 = await compressImage(file);
      setSelectedImage(compressedBase64);
    } catch (err) {
      console.warn('Image compression notice:', err);
    } finally {
      setIsCompressing(false);
      // Reset input value so user can re-select same file if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveSelectedImage = () => {
    setSelectedImage(null);
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();

    // Check if sending text, image, or both
    if (trimmed || selectedImage) {
      const messageText = trimmed || (selectedImage ? '📷 [গ্যালারির ছবি]' : '');
      onSendMessage(messageText, undefined, selectedImage || undefined);
      setInputText('');
      setSelectedImage(null);
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
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          onSendMessage('🎤 [ভয়েস নোট]', base64Audio);
        };
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecordingNote(true);
      setRecordingDuration(0);

      recordIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= 30) {
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

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/90 rounded-2xl border border-zinc-800 shadow-xl overflow-hidden relative">
      {/* Hidden file input for photo gallery */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleImageFileChange}
        className="hidden"
      />

      {/* Header */}
      <div className="px-4 py-3 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-orange-400" />
          <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
            রিয়েল-টাইম লাইভ চ্যাট ও ছবি
          </h4>
        </div>
        <span className="text-[11px] text-zinc-500 font-mono">
          {messages.length} টি বার্তা
        </span>
      </div>

      {/* Messages list */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-[220px] max-h-[380px]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
            <Sparkles className="w-8 h-8 text-zinc-600 mb-2 stroke-[1.5]" />
            <p className="text-xs text-zinc-400 font-medium">এখনো কোনো মেসেজ বা ছবি আসেনি</p>
            <p className="text-[11px] text-zinc-600 mt-1 max-w-xs">
              কথা বলার পাশাপাশি এখানে টেক্সট, ভয়েস নোট এবং গ্যালারি থেকে একাউন্টের ছবি/স্ক্রিনশট শেয়ার করতে পারেন
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            const hasTextCaption = msg.text && msg.text !== '📷 [গ্যালারির ছবি]';

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <span className="text-[10px] text-zinc-400 mb-0.5 px-1">
                  {isMe ? 'আপনি' : msg.senderName}
                </span>

                <div
                  className={`max-w-[85%] rounded-2xl p-2.5 text-xs shadow-sm ${
                    isMe
                      ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-tr-none'
                      : 'bg-zinc-800 text-zinc-200 border border-zinc-700/60 rounded-tl-none'
                  }`}
                >
                  {/* Shared Gallery Image */}
                  {msg.imageUrl && (
                    <div className="relative group overflow-hidden rounded-xl border border-black/20 my-1 bg-black/40">
                      <img
                        src={msg.imageUrl}
                        alt="Shared in room"
                        className="w-full max-h-60 object-cover cursor-pointer hover:opacity-95 transition rounded-xl"
                        onClick={() =>
                          setFullscreenImage({
                            url: msg.imageUrl!,
                            sender: msg.senderName,
                            time: msg.timestamp,
                          })
                        }
                        loading="lazy"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setFullscreenImage({
                            url: msg.imageUrl!,
                            sender: msg.senderName,
                            time: msg.timestamp,
                          })
                        }
                        className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/75 text-white opacity-0 group-hover:opacity-100 transition shadow"
                        title="বড় করে দেখুন"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Text or caption */}
                  {hasTextCaption && (
                    <p className="break-words leading-relaxed px-1 mt-0.5">
                      {msg.text}
                    </p>
                  )}

                  {/* Voice note audio player */}
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

      {/* Quick Tactical & Deal Phrases */}
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

      {/* Selected Image Preview Floating Banner before sending */}
      {selectedImage && (
        <div className="px-3 py-2 bg-zinc-950/90 border-t border-zinc-800 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2.5">
            <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-orange-500/50 bg-black shrink-0">
              <img
                src={selectedImage}
                alt="Selected preview"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-white flex items-center gap-1">
                <span>ছবি সংযুক্ত করা হয়েছে</span>
              </p>
              <p className="text-[10px] text-zinc-400">পাঠাতে সেন্ড বাটনে চাপুন</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemoveSelectedImage}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition"
            title="ছবি বাতিল করুন"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
            {/* Gallery Image Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isCompressing}
              title="গ্যালারি থেকে ছবি বা স্ক্রিনশট শেয়ার করুন"
              className={`p-2.5 rounded-xl border transition flex items-center justify-center ${
                selectedImage
                  ? 'bg-orange-500/20 text-orange-400 border-orange-500/50'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-orange-400 border-zinc-700/60'
              }`}
            >
              {isCompressing ? (
                <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
              ) : (
                <ImageIcon className="w-4 h-4" />
              )}
            </button>

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
              placeholder={
                selectedImage ? 'ছবির সাথে ক্যাপশন লিখুন (ঐচ্ছিক)...' : 'মেসেজ লিখুন...'
              }
              className="flex-1 bg-zinc-800/90 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition"
            />

            <button
              type="submit"
              disabled={!inputText.trim() && !selectedImage}
              className="p-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100 transition shadow-md shadow-orange-500/20 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>

      {/* Fullscreen Image Lightbox Modal */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col p-4 animate-in fade-in duration-200">
          {/* Lightbox Header */}
          <div className="flex items-center justify-between text-white pb-3 max-w-5xl mx-auto w-full">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{fullscreenImage.sender}</span>
              <span className="text-xs text-zinc-400">
                • {new Date(fullscreenImage.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  downloadImage(fullscreenImage.url, `deal_photo_${Date.now()}.jpg`)
                }
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white transition flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                title="ছবি ডাউনলোড করুন"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">ডাউনলোড</span>
              </button>
              <button
                type="button"
                onClick={() => setFullscreenImage(null)}
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition cursor-pointer"
                title="বন্ধ করুন"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Fullscreen Image Container */}
          <div
            className="flex-1 flex items-center justify-center overflow-auto max-w-5xl mx-auto w-full cursor-zoom-out"
            onClick={() => setFullscreenImage(null)}
          >
            <img
              src={fullscreenImage.url}
              alt="Full view"
              className="max-h-[82vh] max-w-full object-contain rounded-xl shadow-2xl border border-zinc-800 cursor-default"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};
