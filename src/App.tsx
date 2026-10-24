import React, { useState, useEffect, useRef } from 'react';
import { useVoiceRoom } from './hooks/useVoiceRoom';
import { Navbar } from './components/Navbar';
import { LobbyView } from './components/LobbyView';
import { VoiceRoomView } from './components/VoiceRoomView';

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
    errorMessage,
    joinRoom,
    leaveRoom,
    sendMessage,
  } = useVoiceRoom();

  const [urlRoomId, setUrlRoomId] = useState<string>('');
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
        connectionStatus={connectionStatus}
      />

      {/* Main View Area */}
      <main className="flex-1 flex flex-col w-full max-w-full overflow-x-hidden">
        {roomId ? (
          <VoiceRoomView
            roomId={roomId}
            userName={userName}
            peerId={peerId}
            isHost={isHost}
            partner={partner}
            connectionStatus={connectionStatus}
            messages={messages}
            errorMessage={errorMessage}
            onSendMessage={sendMessage}
            onLeaveRoom={leaveRoom}
          />
        ) : (
          <LobbyView
            userName={userName}
            onUpdateUserName={updateUserName}
            onJoinRoom={joinRoom}
            initialRoomId={urlRoomId}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-4 px-6 text-center text-xs text-zinc-600 bg-zinc-950/80">
        <p>FF Duo Voice Connect • Real-Time WebRTC Audio & Firebase Realtime Database</p>
      </footer>
    </div>
  );
}
