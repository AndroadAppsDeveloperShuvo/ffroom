import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage, PeerUser } from '../types';
import { playSound } from '../lib/soundEffects';
import { syncRoomToFirebase, pushChatMessageToFirebase, subscribeFirebaseRoom } from '../lib/firebase';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export function useVoiceRoom() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const roomIdRef = useRef<string | null>(null);

  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('ff_user_name') || `Player_${Math.floor(1000 + Math.random() * 9000)}`;
  });
  const userNameRef = useRef(userName);

  // Truly unique peerId per tab / window instance
  const peerIdRef = useRef<string>(
    `peer_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`
  );
  const peerId = peerIdRef.current;

  const [connectionStatus, setConnectionStatus] = useState<
    'idle' | 'connecting' | 'waiting_partner' | 'connected' | 'call_connected' | 'error'
  >('idle');
  const [partner, setPartner] = useState<PeerUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [localVolume, setLocalVolume] = useState(0);
  const [remoteVolume, setRemoteVolume] = useState(0);
  const [callDuration, setCallDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const remoteAnalyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const isInitiatorRef = useRef<boolean>(false);
  const syncIntervalRef = useRef<any>(null);

  // Keep refs in sync
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    userNameRef.current = userName;
  }, [userName]);

  // Save username to local storage
  const updateUserName = useCallback((newName: string) => {
    const trimmed = newName.trim();
    if (trimmed) {
      setUserName(trimmed);
      userNameRef.current = trimmed;
      localStorage.setItem('ff_user_name', trimmed);
    }
  }, []);

  // Audio elements setup
  useEffect(() => {
    const audio = new Audio();
    audio.autoplay = true;
    remoteAudioRef.current = audio;
    return () => {
      audio.pause();
      audio.srcObject = null;
    };
  }, []);

  // Update deafen state on remote audio element
  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = isDeafened;
    }
  }, [isDeafened]);

  // Call timer
  useEffect(() => {
    if (partner && connectionStatus === 'call_connected') {
      timerIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [partner, connectionStatus]);

  // Periodic REST message sync (ensures messages from creator or joiner are NEVER missed)
  useEffect(() => {
    if (!roomId) {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      return;
    }

    const fetchLatestMessages = async () => {
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/messages`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.messages)) {
            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.id));
              const incoming = data.messages.filter((m: ChatMessage) => !existingIds.has(m.id));
              if (incoming.length === 0) return prev;
              return [...prev, ...incoming];
            });
          }
        }
      } catch {
        // silent sync fallback
      }
    };

    // Immediate initial sync
    fetchLatestMessages();

    // Poll every 2.5 seconds as safety net
    syncIntervalRef.current = setInterval(fetchLatestMessages, 2500);

    // Also subscribe to Firebase RTDB for real-time room sync
    const unsubscribeFirebase = subscribeFirebaseRoom(roomId, (roomData) => {
      if (roomData?.messages && typeof roomData.messages === 'object') {
        const fbMessages = Object.values(roomData.messages) as ChatMessage[];
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const incoming = fbMessages.filter((m: ChatMessage) => m.id && !existingIds.has(m.id));
          if (incoming.length === 0) return prev;
          return [...prev, ...incoming];
        });
      }
    });

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      unsubscribeFirebase();
    };
  }, [roomId]);

  // Audio level meter loop
  useEffect(() => {
    let lastSpeakingTime = 0;
    const updateLevels = () => {
      if (localAnalyserRef.current) {
        const dataArray = new Uint8Array(localAnalyserRef.current.frequencyBinCount);
        localAnalyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const vol = Math.min(100, Math.round((avg / 128) * 100));
        setLocalVolume(isMuted ? 0 : vol);

        const isSpeaking = !isMuted && vol > 12;
        if (isSpeaking && Date.now() - lastSpeakingTime > 300) {
          lastSpeakingTime = Date.now();
          sendWsMessage('peer-state-update', { isMuted, isSpeaking: true });
        }
      }

      if (remoteAnalyserRef.current) {
        const dataArray = new Uint8Array(remoteAnalyserRef.current.frequencyBinCount);
        remoteAnalyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const vol = Math.min(100, Math.round((avg / 128) * 100));
        setRemoteVolume(isDeafened ? 0 : vol);
      }

      animFrameRef.current = requestAnimationFrame(updateLevels);
    };

    animFrameRef.current = requestAnimationFrame(updateLevels);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isMuted, isDeafened]);

  // Setup Web Audio Analyser
  const setupAudioAnalyser = (stream: MediaStream, isLocal: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);

      if (isLocal) {
        localAnalyserRef.current = analyser;
      } else {
        remoteAnalyserRef.current = analyser;
      }
    } catch (e) {
      console.warn('AudioContext setup notice:', e);
    }
  };

  // Helper to send message over WebSocket
  const sendWsMessage = (type: string, payload: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  };

  // Initialize Local Microphone
  const initLocalAudio = async () => {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      localStreamRef.current = stream;
      setupAudioAnalyser(stream, true);
      return stream;
    } catch (err: any) {
      console.warn('Microphone permission notice:', err);
      return null;
    }
  };

  // Create RTCPeerConnection
  const createPeerConnection = (targetId: string) => {
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {}
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    // Add local audio tracks if ready
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendWsMessage('signal', {
          targetPeerId: targetId,
          signalType: 'ice-candidate',
          data: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch(() => {});
        setupAudioAnalyser(stream, false);
        setConnectionStatus('call_connected');
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setConnectionStatus('call_connected');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setConnectionStatus('waiting_partner');
      }
    };

    return pc;
  };

  // Initiate WebRTC Call (as caller)
  const initiateCall = async (targetId: string) => {
    try {
      await initLocalAudio();
      const pc = createPeerConnection(targetId);
      isInitiatorRef.current = true;

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
      });
      await pc.setLocalDescription(offer);

      sendWsMessage('signal', {
        targetPeerId: targetId,
        signalType: 'offer',
        data: offer,
      });
    } catch (err) {
      console.warn('Notice initiating WebRTC call:', err);
    }
  };

  // Handle incoming WebRTC signal
  const handleSignal = async (payload: { senderPeerId: string; signalType: string; data: any }) => {
    const { senderPeerId, signalType, data } = payload;

    try {
      if (signalType === 'offer') {
        await initLocalAudio();
        const pc = createPeerConnection(senderPeerId);
        isInitiatorRef.current = false;

        await pc.setRemoteDescription(new RTCSessionDescription(data));

        while (pendingCandidates.current.length) {
          const candidate = pendingCandidates.current.shift();
          if (candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
          }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        sendWsMessage('signal', {
          targetPeerId: senderPeerId,
          signalType: 'answer',
          data: answer,
        });
      } else if (signalType === 'answer') {
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data));
          while (pendingCandidates.current.length) {
            const candidate = pendingCandidates.current.shift();
            if (candidate) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
            }
          }
        }
      } else if (signalType === 'ice-candidate') {
        if (pcRef.current && pcRef.current.remoteDescription) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(data));
        } else {
          pendingCandidates.current.push(data);
        }
      }
    } catch (err) {
      console.warn('Error handling WebRTC signal:', err);
    }
  };

  // Connect to Room
  const joinRoom = useCallback((targetRoomId: string, customName?: string) => {
    if (!targetRoomId) return;
    const cleanRoomId = targetRoomId.trim().toUpperCase();
    const finalName = customName || userNameRef.current;

    // Clean up previous socket if any
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    setRoomId(cleanRoomId);
    roomIdRef.current = cleanRoomId;
    setConnectionStatus('connecting');
    setErrorMessage(null);

    // Request mic access
    initLocalAudio().catch(() => {});

    // Setup WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'join-room',
          payload: {
            roomId: cleanRoomId,
            peerId,
            userName: finalName,
          },
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { type, payload } = msg;

        switch (type) {
          case 'room-joined': {
            // Receive past messages from the room so joiner immediately sees creator's messages
            if (payload.messages && Array.isArray(payload.messages)) {
              setMessages((prev) => {
                const existingIds = new Set(prev.map((m) => m.id));
                const newOnes = payload.messages.filter((m: ChatMessage) => !existingIds.has(m.id));
                return [...prev, ...newOnes];
              });
            }

            if (payload.peers && payload.peers.length > 0) {
              const existingPartner = payload.peers[0];
              setPartner({
                id: existingPartner.peerId,
                name: existingPartner.userName,
                isMuted: existingPartner.isMuted,
                isSpeaking: false,
                joinedAt: Date.now(),
              });
              setConnectionStatus('connected');
              playSound('join');
              initiateCall(existingPartner.peerId);
            } else {
              setPartner(null);
              setConnectionStatus('waiting_partner');
            }

            // Sync room to Firebase RTDB
            syncRoomToFirebase(cleanRoomId, {
              roomId: cleanRoomId,
              creatorName: finalName,
              activePeersCount: (payload.peers?.length || 0) + 1,
              status: payload.peers?.length > 0 ? 'connected' : 'waiting',
            });
            break;
          }

          case 'peer-joined': {
            setPartner({
              id: payload.peerId,
              name: payload.userName,
              isMuted: false,
              isSpeaking: false,
              joinedAt: Date.now(),
            });
            setConnectionStatus('connected');
            playSound('join');
            initiateCall(payload.peerId);
            break;
          }

          case 'signal': {
            handleSignal(payload);
            break;
          }

          case 'chat-message': {
            setMessages((prev) => {
              if (prev.some((m) => m.id === payload.id)) return prev;
              return [...prev, payload];
            });
            playSound('message');
            break;
          }

          case 'peer-state-update': {
            setPartner((prev) => {
              if (!prev || prev.id !== payload.peerId) return prev;
              return {
                ...prev,
                isMuted: typeof payload.isMuted === 'boolean' ? payload.isMuted : prev.isMuted,
                isSpeaking: typeof payload.isSpeaking === 'boolean' ? payload.isSpeaking : prev.isSpeaking,
              };
            });
            break;
          }

          case 'peer-left': {
            setPartner(null);
            setConnectionStatus('waiting_partner');
            playSound('leave');
            if (pcRef.current) {
              try {
                pcRef.current.close();
              } catch {}
              pcRef.current = null;
            }
            if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = null;
            }
            setRemoteVolume(0);
            break;
          }

          default:
            break;
        }
      } catch (e) {
        console.error('Error processing WS message:', e);
      }
    };

    ws.onerror = (e) => {
      console.warn('WebSocket connection error:', e);
    };

    ws.onclose = () => {
      setConnectionStatus((prev) => (prev === 'idle' ? 'idle' : 'waiting_partner'));
    };
  }, [peerId]);

  // Leave room
  const leaveRoom = useCallback(() => {
    playSound('leave');
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'leave-room' }));
      wsRef.current.close();
    }
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {}
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    setRoomId(null);
    roomIdRef.current = null;
    setPartner(null);
    setConnectionStatus('idle');
    setMessages([]);
    setCallDuration(0);
    setLocalVolume(0);
    setRemoteVolume(0);

    // Remove room param from URL without reload
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.toString());
  }, []);

  // Toggle Mic Mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      const nextMuted = !isMuted;
      audioTracks.forEach((track) => {
        track.enabled = !nextMuted;
      });
      setIsMuted(nextMuted);
      playSound(nextMuted ? 'mute' : 'unmute');
      sendWsMessage('peer-state-update', { isMuted: nextMuted, isSpeaking: false });
    }
  }, [isMuted]);

  // Toggle Deafen (Speaker Mute)
  const toggleDeafen = useCallback(() => {
    setIsDeafened((prev) => {
      const next = !prev;
      playSound(next ? 'mute' : 'unmute');
      return next;
    });
  }, []);

  // Send Text or Voice Note Message (Guaranteed delivery: Optimistic + WS + HTTP REST + Firebase RTDB)
  const sendMessage = useCallback((text: string, audioClip?: string) => {
    if (!text.trim() && !audioClip) return;
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
      audioClip,
    };

    // 1. Optimistic update: show immediately on local screen
    setMessages((prev) => {
      if (prev.some((m) => m.id === msgId)) return prev;
      return [...prev, newMsg];
    });

    // 2. Send via WebSocket to all peers
    sendWsMessage('chat-message', {
      ...newMsg,
      roomId: currentRoom,
    });

    // 3. Send via HTTP REST endpoint as reliable fallback
    fetch(`/api/rooms/${encodeURIComponent(currentRoom)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMsg),
    }).catch((err) => console.warn('REST message sync notice:', err));

    // 4. Push to Firebase RTDB
    pushChatMessageToFirebase(currentRoom, newMsg).catch(() => {});
  }, [peerId]);

  return {
    roomId,
    peerId,
    userName,
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
  };
}
