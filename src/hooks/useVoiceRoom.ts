import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage, PeerUser } from '../types';
import { playSound } from '../lib/soundEffects';
import {
  joinFirebaseRoomPresence,
  leaveFirebaseRoomPresence,
  subscribeFirebasePeers,
  pushFirebaseChatMessage,
  subscribeFirebaseChatMessages,
} from '../lib/firebase';

export function useVoiceRoom() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const roomIdRef = useRef<string | null>(null);

  const [isHost, setIsHost] = useState(false);
  const isHostRef = useRef(false);

  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('ff_user_name') || `Player_${Math.floor(1000 + Math.random() * 9000)}`;
  });
  const userNameRef = useRef(userName);

  // Guaranteed unique peerId per tab / window instance
  const peerIdRef = useRef<string>(
    `peer_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`
  );
  const peerId = peerIdRef.current;

  const [connectionStatus, setConnectionStatus] = useState<
    'idle' | 'connecting' | 'waiting_partner' | 'connected' | 'error'
  >('idle');
  const [partner, setPartner] = useState<PeerUser | null>(null);
  const partnerRef = useRef<PeerUser | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Keep refs in sync
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    userNameRef.current = userName;
  }, [userName]);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  useEffect(() => {
    partnerRef.current = partner;
  }, [partner]);

  // Save username to local storage
  const updateUserName = useCallback((newName: string) => {
    const trimmed = newName.trim();
    if (trimmed) {
      setUserName(trimmed);
      userNameRef.current = trimmed;
      localStorage.setItem('ff_user_name', trimmed);
    }
  }, []);

  // Connect to Room via Firebase RTDB (Real-time presence & instant chat/media sync)
  const joinRoom = useCallback(
    async (targetRoomId: string, customName?: string, asHost: boolean = false) => {
      if (!targetRoomId) return;
      const cleanRoomId = targetRoomId.trim().toUpperCase();
      const finalName = customName || userNameRef.current;

      setRoomId(cleanRoomId);
      roomIdRef.current = cleanRoomId;
      setIsHost(asHost);
      isHostRef.current = asHost;
      setConnectionStatus('connecting');
      setErrorMessage(null);

      // NO automatic mic permission request on room join!
      // Microphone is only accessed when user specifically chooses to record a voice note in chat.

      // 1. Join Firebase RTDB Presence
      await joinFirebaseRoomPresence(cleanRoomId, {
        id: peerId,
        name: finalName,
        isHost: asHost,
      });

      // Also register in backend REST
      fetch(`/api/rooms/${encodeURIComponent(cleanRoomId)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peerId,
          userName: finalName,
          isHost: asHost,
        }),
      }).catch(() => {});

      // 2. Subscribe to Firebase Peers in this Room (real-time presence)
      const unsubPeers = subscribeFirebasePeers(cleanRoomId, peerId, (activePeers, metadata) => {
        if (activePeers.length > 0) {
          const other = activePeers[0];
          const isOtherHost = Boolean(metadata && metadata.hostId === other.id);

          const newPartner = {
            ...other,
            isHost: isOtherHost,
          };

          if (!partnerRef.current || partnerRef.current.id !== other.id) {
            playSound('join');
          }

          setPartner(newPartner);
          setConnectionStatus('connected');
        } else {
          // No other partner yet
          if (partnerRef.current) {
            playSound('leave');
          }
          setPartner(null);
          setConnectionStatus('waiting_partner');
        }
      });

      // 3. Subscribe to Chat Messages via Firebase RTDB
      const unsubMessages = subscribeFirebaseChatMessages(cleanRoomId, (msgs) => {
        setMessages((prev) => {
          if (msgs.length > prev.length) {
            const last = msgs[msgs.length - 1];
            if (last && last.senderId !== peerId) {
              playSound('message');
            }
          }
          return msgs;
        });
      });

      // 4. Secondary HTTP polling fallback (every 2s) to guarantee zero message loss
      const intervalId = setInterval(async () => {
        try {
          const res = await fetch(`/api/rooms/${encodeURIComponent(cleanRoomId)}/messages`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.messages) && data.messages.length > 0) {
              setMessages((prev) => {
                const existingIds = new Set(prev.map((m) => m.id));
                const newOnes = data.messages.filter((m: ChatMessage) => !existingIds.has(m.id));
                if (newOnes.length === 0) return prev;
                return [...prev, ...newOnes].sort((a, b) => a.timestamp - b.timestamp);
              });
            }
          }
        } catch {}
      }, 2000);

      // Store unsubs for cleanup on leave
      (window as any).__firebaseRoomUnsubs = [
        unsubPeers,
        unsubMessages,
        () => clearInterval(intervalId),
      ];
    },
    [peerId]
  );

  // Leave room
  const leaveRoom = useCallback(() => {
    const currentRoom = roomIdRef.current;
    if (currentRoom) {
      playSound('leave');
      leaveFirebaseRoomPresence(currentRoom, peerId);

      // Clean up unsubs
      if (Array.isArray((window as any).__firebaseRoomUnsubs)) {
        (window as any).__firebaseRoomUnsubs.forEach((fn: any) => {
          try {
            fn();
          } catch {}
        });
        (window as any).__firebaseRoomUnsubs = [];
      }

      // Notify backend
      fetch(`/api/rooms/${encodeURIComponent(currentRoom)}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId }),
      }).catch(() => {});
    }

    setRoomId(null);
    setPartner(null);
    setMessages([]);
    setConnectionStatus('idle');
    setErrorMessage(null);

    // Clean URL query param
    if (typeof window !== 'undefined' && window.history) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [peerId]);

  // Send Text, Voice Note, or Gallery Image Message
  const sendMessage = useCallback(
    (text: string, audioClip?: string, imageUrl?: string) => {
      if (!text.trim() && !audioClip && !imageUrl) return;
      const currentRoom = roomIdRef.current;
      if (!currentRoom) return;

      const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const currentSenderName = userNameRef.current;

      const newMsg: ChatMessage = {
        id: msgId,
        senderId: peerId,
        senderName: currentSenderName,
        text: text.trim(),
        timestamp: Date.now(),
        ...(audioClip ? { audioClip } : {}),
        ...(imageUrl ? { imageUrl } : {}),
      };

      // Optimistic local update
      setMessages((prev) => {
        if (prev.some((m) => m.id === msgId)) return prev;
        return [...prev, newMsg];
      });

      // Push to Firebase RTDB (global instant real-time sync across devices)
      pushFirebaseChatMessage(currentRoom, newMsg);

      // Also send to server REST endpoint as backup
      fetch(`/api/rooms/${encodeURIComponent(currentRoom)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMsg),
      }).catch(() => {});
    },
    [peerId]
  );

  return {
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
  };
}
