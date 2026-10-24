import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Play,
  Pause,
  RotateCcw,
  Wand2,
  Radio,
} from 'lucide-react';
import { ChatMessage } from '../types';
import {
  VOICE_FILTERS,
  VoiceFilterType,
  PcmVoiceRecorder,
  applyFilterToPcmSamples,
} from '../lib/voiceFilters';

interface ChatPanelProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSendMessage: (text: string, audioClip?: string, imageUrl?: string) => void;
}

const QUICK_PHRASES = [
  'আইডির সমস্যা কি 😒',
  'কালেকশন ছবি দিন 📸',
  'লেভেল কত? 🎮',
  'আইডি কোড দিন 🆔',
  'দাম কত রাখবেন? 💰',
  'ডিল কনফার্ম! 🤝',
];

// Sleek Custom Voice Note Player (Universal iOS Safari & Android WebM/WAV/MP4 support)
interface VoiceNotePlayerProps {
  src: string;
  isMe: boolean;
}

const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({ src, isMe }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const resolvedSrc = useMemo(() => {
    if (!src) return '';
    const isApple =
      typeof navigator !== 'undefined' &&
      (/iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent) ||
        (navigator.platform && /Mac|iPhone|iPad|iPod/i.test(navigator.platform)));

    if (isApple && src.startsWith('data:audio/webm')) {
      return src.replace(/^data:audio\/webm/i, 'data:audio/mp4');
    }
    return src;
  }, [src]);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    audio.preload = 'metadata';
    audio.src = resolvedSrc;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      if (resolvedSrc !== src) {
        audio.src = src;
      }
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.pause();
      audio.src = '';
    };
  }, [resolvedSrc, src]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        console.warn('Audio play notice:', err);
        if (audio.src.includes('audio/webm')) {
          audio.src = audio.src.replace('audio/webm', 'audio/mp4');
          try {
            await audio.play();
            setIsPlaying(true);
          } catch {}
        }
      }
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pos * duration;
    setCurrentTime(audio.currentTime);
  };

  const formatSecs = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const WAVE_BARS = [35, 65, 90, 45, 80, 100, 60, 85, 50, 95, 70, 40, 85, 60, 45, 75];

  return (
    <div
      className={`mt-2 pt-2 border-t flex items-center gap-2.5 sm:gap-3 w-56 sm:w-64 max-w-full select-none ${
        isMe ? 'border-white/20' : 'border-zinc-700/60'
      }`}
    >
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-md transition-all active:scale-95 cursor-pointer ${
          isMe
            ? 'bg-white text-orange-600 hover:bg-orange-50'
            : 'bg-gradient-to-tr from-orange-500 to-amber-500 text-white hover:brightness-110'
        }`}
        title={isPlaying ? 'বিরতি দিন' : 'চালান'}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      <div
        className="flex-1 flex flex-col justify-center gap-1.5 cursor-pointer"
        onClick={handleSeek}
      >
        <div className="flex items-center gap-[2.5px] h-6 py-1">
          {WAVE_BARS.map((heightPercent, idx) => {
            const barFraction = idx / WAVE_BARS.length;
            const isPlayed = progressPercent / 100 >= barFraction;
            return (
              <div
                key={idx}
                style={{ height: `${heightPercent}%` }}
                className={`flex-1 min-w-[2px] rounded-full transition-all duration-150 ${
                  isPlayed
                    ? isMe
                      ? 'bg-white'
                      : 'bg-orange-400'
                    : isMe
                    ? 'bg-white/40'
                    : 'bg-zinc-600'
                } ${isPlaying && isPlayed ? 'animate-pulse' : ''}`}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono leading-none">
          <span className={isMe ? 'text-white/90' : 'text-zinc-400'}>
            {formatSecs(currentTime)}
          </span>
          <span className={isMe ? 'text-white/70' : 'text-zinc-500'}>
            {duration > 0 ? formatSecs(duration) : '0:00'}
          </span>
        </div>
      </div>
    </div>
  );
};

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  currentUserId,
  onSendMessage,
}) => {
  const [inputText, setInputText] = useState('');

  // Voice Filter & Recorder Modal States
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<VoiceFilterType>('normal');
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  // Raw recorded PCM buffer in memory (ensures real duration > 0s)
  const [recordedRaw, setRecordedRaw] = useState<{
    samples: Float32Array;
    sampleRate: number;
    duration: number;
  } | null>(null);

  // Processed audio for preview
  const [processedAudio, setProcessedAudio] = useState<{
    dataUrl: string;
    duration: number;
  } | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  // Gallery image selection states
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<{ url: string; sender: string; time: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pcmRecorderRef = useRef<PcmVoiceRecorder | null>(null);
  const recordIntervalRef = useRef<any>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle ESC key to close fullscreen image
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFullscreenImage(null);
        if (!isRecording) setIsVoiceModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecording]);

  // Whenever raw samples or selected filter changes, apply filter and generate WAV data URL
  useEffect(() => {
    if (!recordedRaw || recordedRaw.samples.length === 0) {
      setProcessedAudio(null);
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
    }

    try {
      const result = applyFilterToPcmSamples(
        recordedRaw.samples,
        recordedRaw.sampleRate,
        selectedFilter
      );
      setProcessedAudio(result);
    } catch (e) {
      console.warn('Filter processing notice:', e);
    }
  }, [recordedRaw, selectedFilter]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current.src = '';
      }
    };
  }, []);

  // Compress image on client via Canvas
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
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();

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

  // Open Voice Modal so user can choose filter FIRST
  const handleOpenVoiceModal = () => {
    setIsVoiceModalOpen(true);
    setRecordedRaw(null);
    setProcessedAudio(null);
    setIsRecording(false);
    setRecordSeconds(0);
  };

  const handleCloseVoiceModal = () => {
    if (isRecording) {
      stopRecording();
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
    }
    setIsVoiceModalOpen(false);
    setRecordedRaw(null);
    setProcessedAudio(null);
  };

  // Start recording raw PCM audio in memory
  const startRecording = async () => {
    try {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        setIsPreviewPlaying(false);
      }
      setRecordedRaw(null);
      setProcessedAudio(null);

      const recorder = new PcmVoiceRecorder();
      await recorder.start();
      pcmRecorderRef.current = recorder;

      setIsRecording(true);
      setRecordSeconds(0);

      recordIntervalRef.current = setInterval(() => {
        setRecordSeconds((prev) => {
          if (prev >= 30) {
            stopRecording();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.warn('Microphone permission / access error:', err);
      alert('মাইক্রোফোন চালু করার অনুমতি দিন।');
    }
  };

  // Stop recording and retrieve actual PCM samples
  const stopRecording = () => {
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }

    if (pcmRecorderRef.current && isRecording) {
      const result = pcmRecorderRef.current.stop();
      pcmRecorderRef.current = null;
      setIsRecording(false);

      if (result.samples.length > 0) {
        setRecordedRaw(result);
      }
    }
  };

  // Toggle preview of the filtered voice note
  const handleTogglePreview = () => {
    if (!processedAudio || !processedAudio.dataUrl) return;

    if (previewAudioRef.current && isPreviewPlaying) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
      return;
    }

    const audio = new Audio(processedAudio.dataUrl);
    previewAudioRef.current = audio;
    audio.onended = () => setIsPreviewPlaying(false);
    audio.onerror = () => setIsPreviewPlaying(false);

    audio
      .play()
      .then(() => setIsPreviewPlaying(true))
      .catch((err) => {
        console.warn('Preview play notice:', err);
        setIsPreviewPlaying(false);
      });
  };

  // Send the filtered voice note
  const handleSendVoiceNote = () => {
    if (!processedAudio || !processedAudio.dataUrl) return;

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
    }

    const filterObj = VOICE_FILTERS.find((f) => f.id === selectedFilter);
    const label =
      selectedFilter === 'normal'
        ? '🎤 [ভয়েস নোট]'
        : `🎤 [ভয়েস নোট • ${filterObj?.emoji || ''} ${filterObj?.label || ''}]`;

    onSendMessage(label, processedAudio.dataUrl);
    handleCloseVoiceModal();
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
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
      <div className="px-3 sm:px-4 py-2.5 bg-zinc-900/95 border-b border-zinc-800 flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="w-4 h-4 text-orange-400 shrink-0" />
          <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wide truncate">
            লাইভ চ্যাট ও ভয়েস
          </h4>
        </div>
        <span className="text-[11px] text-zinc-400 font-mono shrink-0 bg-zinc-800/80 px-2.5 py-0.5 rounded-full border border-zinc-700/50">
          {messages.length} বার্তা
        </span>
      </div>

      {/* Messages list */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-[220px] max-h-[380px]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
            <Sparkles className="w-8 h-8 text-zinc-600 mb-2 stroke-[1.5]" />
            <p className="text-xs text-zinc-400 font-medium">এখনো কোনো মেসেজ আসেনি</p>
            <p className="text-[11px] text-zinc-600 mt-1 max-w-xs">
              কথা বলার পাশাপাশি টেক্সট, ফিল্টার করা ভয়েস নোট এবং গ্যালারি থেকে একাউন্টের ছবি শেয়ার করুন
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
                        className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/75 text-white opacity-0 group-hover:opacity-100 transition shadow cursor-pointer"
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

                  {/* Beautiful Custom Voice Note Player (Universal cross-platform) */}
                  {msg.audioClip && (
                    <VoiceNotePlayer src={msg.audioClip} isMe={isMe} />
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
            onClick={() => setSelectedImage(null)}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition cursor-pointer"
            title="ছবি বাতিল করুন"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bottom Input Bar */}
      <div className="p-2 sm:p-3 bg-zinc-900 border-t border-zinc-800">
        <form onSubmit={handleSend} className="flex items-center gap-1.5 sm:gap-2">
          {/* Gallery Image Upload Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isCompressing}
            title="গ্যালারি থেকে ছবি শেয়ার করুন"
            className={`p-2 sm:p-2.5 rounded-xl border transition flex items-center justify-center shrink-0 cursor-pointer ${
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

          {/* Voice Filter & Recording trigger button */}
          <button
            type="button"
            onClick={handleOpenVoiceModal}
            title="ফিল্টার বেছে ভয়েস পাঠান"
            className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-orange-400 border border-orange-500/40 transition shrink-0 cursor-pointer flex items-center gap-1 active:scale-95 shadow-sm"
          >
            <Mic className="w-4 h-4" />
            <span className="text-[11px] font-semibold hidden md:inline">ভয়েস ফিল্টার</span>
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              selectedImage ? 'ছবির ক্যাপশন...' : 'মেসেজ লিখুন...'
            }
            className="flex-1 min-w-0 bg-zinc-800/90 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition"
          />

          <button
            type="submit"
            disabled={!inputText.trim() && !selectedImage}
            className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100 transition shadow-md shadow-orange-500/20 shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Voice Filter & Recording Drawer (Choose filter FIRST, then record & send) */}
      {isVoiceModalOpen && (
        <div className="absolute inset-x-0 bottom-0 z-30 bg-zinc-950/98 backdrop-blur-md border-t-2 border-orange-500/60 p-3.5 sm:p-4 rounded-t-3xl shadow-2xl space-y-3 sm:space-y-4 animate-in slide-in-from-bottom duration-250 max-h-[92%] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
                <Wand2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">ভয়েস ফিল্টার ও রেকর্ডার</h4>
                <p className="text-[10px] text-zinc-400">ফিল্টার বেছে রেকর্ড করুন ও পাঠান</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCloseVoiceModal}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
              title="বন্ধ করুন"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* STEP 1: Choose Filter First */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-zinc-300">১. ফিল্টার বেছে নিন:</span>
              <span className="text-orange-400 font-medium">
                {VOICE_FILTERS.find((f) => f.id === selectedFilter)?.emoji}{' '}
                {VOICE_FILTERS.find((f) => f.id === selectedFilter)?.label}
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {VOICE_FILTERS.map((f) => {
                const isSelected = selectedFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFilter(f.id)}
                    className={`p-2 rounded-xl text-center border transition flex flex-col items-center gap-0.5 cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-b from-orange-500/25 to-amber-500/10 border-orange-500 text-white shadow-sm ring-2 ring-orange-500/40'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    <span className="text-lg">{f.emoji}</span>
                    <span className="text-[10px] font-semibold truncate w-full">{f.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 2: Record Voice (or Preview after recording) */}
          <div className="pt-2 border-t border-zinc-800 flex flex-col items-center justify-center gap-3">
            {!recordedRaw ? (
              // Recording Controls
              <div className="flex flex-col items-center gap-2.5 w-full">
                {isRecording ? (
                  <div className="flex flex-col items-center gap-3 w-full py-1">
                    <div className="flex items-center gap-2 text-xs text-red-400 font-mono font-bold animate-pulse">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                      <span>রেকর্ড হচ্ছে: {formatSeconds(recordSeconds)} / 0:30</span>
                    </div>

                    <button
                      type="button"
                      onClick={stopRecording}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition active:scale-95 cursor-pointer"
                    >
                      <Square className="w-4 h-4 fill-white" />
                      <span>রেকর্ডিং থামান (Stop)</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 w-full py-1">
                    <p className="text-[11px] text-zinc-400">
                      উপরের ফিল্টার সিলেক্ট করে নিচের বাটনে চাপ দিয়ে কথা বলুন
                    </p>
                    <button
                      type="button"
                      onClick={startRecording}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30 transition active:scale-95 cursor-pointer"
                    >
                      <Mic className="w-4 h-4" />
                      <span>রেকর্ড শুরু করুন</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // Preview & Send after recording
              <div className="w-full space-y-3">
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
                  <div className="flex items-center gap-2 text-zinc-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>রেকর্ড সম্পন্ন:</span>
                    <span className="font-mono text-white font-bold">
                      {formatSeconds(processedAudio?.duration || recordedRaw.duration)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleTogglePreview}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-orange-400 font-semibold text-xs border border-zinc-700 transition cursor-pointer active:scale-95"
                  >
                    {isPreviewPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5 fill-current" />
                        <span>বিরতি</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>শুনুন (Preview)</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRecordedRaw(null);
                      setProcessedAudio(null);
                      setIsPreviewPlaying(false);
                      startRecording();
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold border border-zinc-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>আবার রেকর্ড করুন</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendVoiceNote}
                    disabled={!processedAudio}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-rose-500 hover:brightness-110 text-white text-xs font-bold shadow-lg shadow-orange-500/25 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>ফিল্টার সহ পাঠান</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen Image Lightbox Modal */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col p-4 animate-in fade-in duration-200">
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
