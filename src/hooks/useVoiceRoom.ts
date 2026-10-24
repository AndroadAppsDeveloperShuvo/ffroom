import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage, PeerUser } from '../types';
import { playSound } from '../lib/soundEffects';
import {
  joinFirebaseRoomPresence,
  leaveFirebaseRoomPresence,
  updateFirebasePeerState,
  subscribeFirebasePeers,
  sendFirebaseSignal,
  subscribeFirebaseSignals,
  pushFirebaseChatMessage,
  subscribeFirebaseChatMessages,
} from '../lib/firebase';

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
    'idle' | 'connecting' | 'waiting_partner' | 'connected' | 'call_connected' | 'error'
  >('idle');
  const [partner, setPartner] = useState<PeerUser | null>(null);
  const partnerRef = useRef<PeerUser | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);

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
    isMutedRef.current = isMuted;
  }, [isMuted]);

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

  // Audio element setup for remote audio stream
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
    if (partner && (connectionStatus === 'call_connected' || connectionStatus === 'connected')) {
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
          if (roomIdRef.current) {
            updateFirebasePeerState(roomIdRef.current, peerId, { isMuted, isSpeaking: true });
          }
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
  }, [isMuted, isDeafened, peerId]);

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

  // Send WebRTC signal (over Firebase RTDB)
  const dispatchSignal = (targetId: string, signalType: string, data: any) => {
    if (roomIdRef.current) {
      sendFirebaseSignal(roomIdRef.current, targetId, {
        senderPeerId: peerId,
        signalType,
        data,
      });
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

    // Add local tracks if available
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        dispatchSignal(targetId, 'ice-candidate', event.candidate);
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

  // Initiate WebRTC Call (Host calls the joining partner)
  const initiateCall = async (targetId: string) => {
    try {
      await initLocalAudio();
      const pc = createPeerConnection(targetId);

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
      });
      await pc.setLocalDescription(offer);

      dispatchSignal(targetId, 'offer', offer);
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

        await pc.setRemoteDescription(new RTCSessionDescription(data));

        while (pendingCandidates.current.length) {
          const candidate = pendingCandidates.current.shift();
          if (candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
          }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        dispatchSignal(senderPeerId, 'answer', answer);
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

  // Connect to Room via Firebase RTDB (Global real-time presence & signaling)
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

      // Request mic access
      initLocalAudio().catch(() => {});

      // 1. Join Firebase RTDB Presence
      await joinFirebaseRoomPresence(cleanRoomId, {
        id: peerId,
        name: finalName,
        isHost: asHost,
      });

      // 2. Subscribe to Firebase Peers in this Room
      const unsubPeers = subscribeFirebasePeers(cleanRoomId, peerId, (activePeers, metadata) => {
        // If there is an active peer in the room
        if (activePeers.length > 0) {
          const other = activePeers[0];
          const isOtherHost = Boolean(metadata && metadata.hostId === other.id);

          setPartner({
            ...other,
            isHost: isOtherHost,
          });
          setConnectionStatus('connected');

          // If partner just joined and we don't have active call connection, initiate WebRTC
          if (!partnerRef.current || partnerRef.current.id !== other.id) {
            playSound('join');
            // Host initiates call to partner, or if both connected, first peer initiates
            if (isHostRef.current || (!isOtherHost && peerId < other.id)) {
              initiateCall(other.id);
            }
          }
        } else {
          // No other partner yet
          if (partnerRef.current) {
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
          }
          setPartner(null);
          setConnectionStatus('waiting_partner');
        }
      });

      // 3. Subscribe to WebRTC Signals via Firebase RTDB
      const unsubSignals = subscribeFirebaseSignals(cleanRoomId, peerId, (signal) => {
        handleSignal(signal);
      });

      // 4. Subscribe to Chat Messages via Firebase RTDB
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

      // 5. Secondary HTTP polling fallback (every 2s) to guarantee zero message loss
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

      // Store unsubs in window/ref for cleanup on leave
      (window as any).__firebaseRoomUnsubs = [
        unsubPeers,
        unsubSignals,
        unsubMessages,
        () => clearInterval(intervalId),
      ];
    },
    [peerId]
  );

  // Leave room
  const leaveRoom = useCallback(() => {
    playSound('leave');

    if (roomIdRef.current) {
      leaveFirebaseRoomPresence(roomIdRef.current, peerId);
    }

    if (Array.isArray((window as any).__firebaseRoomUnsubs)) {
      (window as any).__firebaseRoomUnsubs.forEach((unsub: any) => {
        try {
          unsub();
        } catch {}
      });
      (window as any).__firebaseRoomUnsubs = [];
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
    setIsHost(false);
    setConnectionStatus('idle');
    setMessages([]);
    setCallDuration(0);
    setLocalVolume(0);
    setRemoteVolume(0);

    // Remove room param from URL without reload
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.toString());
  }, [peerId]);

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

      if (roomIdRef.current) {
        updateFirebasePeerState(roomIdRef.current, peerId, { isMuted: nextMuted, isSpeaking: false });
      }
    }
  }, [isMuted, peerId]);

  // Toggle Deafen (Speaker Mute)
  const toggleDeafen = useCallback(() => {
    setIsDeafened((prev) => {
      const next = !prev;
      playSound(next ? 'mute' : 'unmute');
      return next;
    });
  }, []);

  // Send Text, Voice Note, or Gallery Image Message (Instant push to Firebase RTDB)
  const sendMessage = useCallback((text: string, audioClip?: string, imageUrl?: string) => {
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
  }, [peerId]);

  return {
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
  };
}
