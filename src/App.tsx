import React, { useState, useEffect, useRef } from 'react';
import { useVoiceRoom } from './hooks/useVoiceRoom';
import { Navbar } from './components/Navbar';
import { LobbyView } from './components/LobbyView';
import { VoiceRoomView } from './components/VoiceRoomView';
import { TelegramModal } from './components/TelegramModal';
import { DEFAULT_TELEGRAM_CHAT_ID } from './lib/telegram';

export default function App() {
  const {
    roomId,
    peerId,
    userName,
    isHost,
    updateUserName,
    partner,
    connectionStatus,
    messages,
    isMuted,
    isDeafened,
    localVolume,
    remoteVolume,
    callDuration,
    errorMessage,
    joinRoom,
    leaveRoom,
    toggleMute,
    toggleDeafen,
    sendMessage,
  } = useVoiceRoom();

  const [telegramChatId, setTelegramChatId] = useState<string>(() => {
    return localStorage.getItem('ff_telegram_chat_id') || DEFAULT_TELEGRAM_CHAT_ID;
  });

  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [urlRoomId, setUrlRoomId] = useState<string>('');

  // Save chat ID preference
  const handleUpdateChatId = (newId: string) => {
    const trimmed = newId.trim();
    if (trimmed) {
      setTelegramChatId(trimmed);
      localStorage.setItem('ff_telegram_chat_id', trimmed);
    }
  };

  const hasAutoJoinedRef = useRef(false);

  // Check URL query parameters for direct room joining (from Telegram link click)
  useEffect(() => {
    if (hasAutoJoinedRef.current) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam) {
        hasAutoJoinedRef.current = true;
        const cleaned = roomParam.trim().toUpperCase();
        setUrlRoomId(cleaned);
        // Automatically join as participant (not host) when clicking link
        joinRoom(cleaned, undefined, false);
      }
    } catch (e) {
      console.warn('URL parsing error:', e);
    }
  }, [joinRoom]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-orange-500/30 selection:text-orange-200">
      {/* Top Navbar */}
      <Navbar
        userName={userName}
        onUpdateUserName={updateUserName}
        onOpenTelegramModal={() => setIsTelegramModalOpen(true)}
        telegramChatId={telegramChatId}
        connectionStatus={connectionStatus}
      />

      {/* Main View Area */}
      <main className="flex-1 flex flex-col">
        {roomId ? (
          <VoiceRoomView
            roomId={roomId}
            userName={userName}
            peerId={peerId}
            isHost={isHost}
            partner={partner}
            connectionStatus={connectionStatus}
            messages={messages}
            isMuted={isMuted}
            isDeafened={isDeafened}
            localVolume={localVolume}
            remoteVolume={remoteVolume}
            callDuration={callDuration}
            telegramChatId={telegramChatId}
            errorMessage={errorMessage}
            onToggleMute={toggleMute}
            onToggleDeafen={toggleDeafen}
            onSendMessage={sendMessage}
            onLeaveRoom={leaveRoom}
          />
        ) : (
          <LobbyView
            userName={userName}
            onUpdateUserName={updateUserName}
            onJoinRoom={joinRoom}
            telegramChatId={telegramChatId}
            onUpdateChatId={handleUpdateChatId}
            initialRoomId={urlRoomId}
          />
        )}
      </main>

      {/* Telegram Configuration Modal */}
      <TelegramModal
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
        chatId={telegramChatId}
        onUpdateChatId={handleUpdateChatId}
      />

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-4 px-6 text-center text-xs text-zinc-600 bg-zinc-950/80">
        <p>
          FF Duo Voice Connect • Real-Time WebRTC Audio & Firebase Realtime Database • Telegram Bot API
        </p>
      </footer>
    </div>
  );
}
