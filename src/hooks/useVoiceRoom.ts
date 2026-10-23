import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage, PeerUser } from '../types';
import { playSound } from '../lib/soundEffects';
import { syncRoomToFirebase, pushChatMessageToFirebase } from '../lib/firebase';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export function useVoiceRoom() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('ff_user_name') || `Player_${Math.floor(1000 + Math.random() * 9000)}`;
  });
  const [peerId] = useState<string>(() => {
    let id = sessionStorage.getItem('ff_peer_id');
    if (!id) {
      id = `peer_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      sessionStorage.setItem('ff_peer_id', id);
    }
    return id;
  });

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

  // Save username to local storage
  const updateUserName = useCallback((newName: string) => {
    const trimmed = newName.trim();
    if (trimmed) {
      setUserName(trimmed);
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
      console.warn('AudioContext setup error:', e);
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
      console.warn('Microphone permission or access error:', err);
      setErrorMessage(
        'মাইক্রোফোনের অনুমতি পাওয়া যায়নি। অনুগ্রহ করে ব্রাউজারে Mic Permission দিন।'
      );
      return null;
    }
  };

  // Create RTCPeerConnection
  const createPeerConnection = (targetId: string) => {
    if (pcRef.current) {
      pcRef.current.close();
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
      console.error('Failed to initiate WebRTC call:', err);
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

        // Add any pending candidates
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
      console.error('Error handling WebRTC signal:', err);
    }
  };

  // Connect to Room
  const joinRoom = useCallback((targetRoomId: string, customName?: string) => {
    if (!targetRoomId) return;
    const finalName = customName || userName;
    setRoomId(targetRoomId);
    setConnectionStatus('connecting');
    setErrorMessage(null);

    // Request mic access in advance
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
            roomId: targetRoomId,
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
            setMessages(payload.messages || []);
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
              // We joined an existing room where partner is waiting, partner will initiate or we initiate
              initiateCall(existingPartner.peerId);
            } else {
              setPartner(null);
              setConnectionStatus('waiting_partner');
            }

            // Sync room to Firebase RTDB in background
            syncRoomToFirebase(targetRoomId, {
              roomId: targetRoomId,
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
            // When new peer joins us, we initiate the call to them
            initiateCall(payload.peerId);
            break;
          }

          case 'signal': {
            handleSignal(payload);
            break;
          }

          case 'chat-message': {
            setMessages((prev) => [...prev, payload]);
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
              pcRef.current.close();
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
      console.error('WebSocket connection error:', e);
      setErrorMessage('সার্ভারের সাথে সংযোগ বিচ্ছিন্ন হয়েছে। আবার চেষ্টা করুন।');
    };

    ws.onclose = () => {
      setConnectionStatus('idle');
    };
  }, [peerId, userName]);

  // Leave room
  const leaveRoom = useCallback(() => {
    playSound('leave');
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'leave-room' }));
      wsRef.current.close();
    }
    if (pcRef.current) {
      pcRef.current.close();
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

  // Send Text or Voice Note Message
  const sendMessage = useCallback((text: string, audioClip?: string) => {
    if (!text.trim() && !audioClip) return;
    const msgPayload = {
      senderName: userName,
      text: text.trim(),
      audioClip,
    };
    sendWsMessage('chat-message', msgPayload);
    // Also push to Firebase RTDB for persistence
    if (roomId) {
      pushChatMessageToFirebase(roomId, {
        ...msgPayload,
        senderId: peerId,
        timestamp: Date.now(),
      });
    }
  }, [userName, roomId, peerId]);

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
