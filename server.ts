import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3000;

app.use(express.json());

// Telegram Bot Details provided by user
const DEFAULT_TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '6784439390:AAG7Kxh2F04J-3HAmFEwErDxPo84qXe0L9s';
const DEFAULT_TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '5440151107';

interface PeerConnection {
  ws: WebSocket;
  peerId: string;
  userName: string;
  roomId: string;
  isMuted: boolean;
  joinedAt: number;
}

interface RoomState {
  id: string;
  createdAt: number;
  peers: Map<string, PeerConnection>;
  messages: Array<{
    id: string;
    senderId: string;
    senderName: string;
    text: string;
    timestamp: number;
    audioClip?: string;
  }>;
}

// In-memory room store (synced with real-time sockets)
const rooms = new Map<string, RoomState>();

function getOrCreateRoom(roomId: string): RoomState {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      id: roomId,
      createdAt: Date.now(),
      peers: new Map(),
      messages: [],
    };
    rooms.set(roomId, room);
  }
  return room;
}

// API Routes
app.get('/api/config', (_req: Request, res: Response) => {
  res.json({
    firebase: {
      databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://ffroomsestem-default-rtdb.firebaseio.com/',
      projectId: process.env.FIREBASE_PROJECT_ID || 'ffroomsestem',
      appId: process.env.FIREBASE_APP_ID || '1:1080130236833:web:8fbf66b8d9e402d0285be0',
    },
    telegram: {
      defaultChatId: DEFAULT_TELEGRAM_CHAT_ID,
      hasBotToken: Boolean(DEFAULT_TELEGRAM_BOT_TOKEN),
      maskedToken: DEFAULT_TELEGRAM_BOT_TOKEN ? `${DEFAULT_TELEGRAM_BOT_TOKEN.slice(0, 10)}...${DEFAULT_TELEGRAM_BOT_TOKEN.slice(-5)}` : '',
    },
  });
});

// Check Telegram Bot Info
app.get('/api/telegram/bot-info', async (_req: Request, res: Response) => {
  try {
    const token = DEFAULT_TELEGRAM_BOT_TOKEN;
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await response.json();
    if (data.ok) {
      res.json({ success: true, bot: data.result });
    } else {
      res.status(400).json({ success: false, error: data.description });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Telegram connection failed' });
  }
});

// Send Room ID & Direct Link to Telegram Bot
app.post('/api/telegram/send', async (req: Request, res: Response) => {
  try {
    const { roomId, hostName = 'Host', chatId = DEFAULT_TELEGRAM_CHAT_ID, customNote = '', appOrigin } = req.body;

    if (!roomId) {
      return res.status(400).json({ success: false, error: 'Room ID is required' });
    }

    const token = DEFAULT_TELEGRAM_BOT_TOKEN;
    const targetChatId = chatId || DEFAULT_TELEGRAM_CHAT_ID;

    // Build the direct join URL using the active live app domain
    const fallbackAppUrl = 'https://ais-dev-vmzg6x6qn5z52lj3rgx4zf-12329983830.asia-east1.run.app';
    let baseDomain = appOrigin;
    if (!baseDomain || baseDomain.includes('localhost') || baseDomain.includes('127.0.0.1')) {
      baseDomain = (process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL') ? process.env.APP_URL : fallbackAppUrl;
    }
    const joinUrl = `${baseDomain}/?room=${encodeURIComponent(roomId)}`;

    const banglaTime = new Date().toLocaleTimeString('bn-BD', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const captionText = 
`🎮 <b>নতুন ডুও ভয়েস রুম তৈরি হয়েছে!</b>
━━━━━━━━━━━━━━━━━━━━
🆔 <b>রুম আইডি:</b> <code>${roomId}</code>
👤 <b>হোস্ট:</b> ${hostName}
⏰ <b>সময়:</b> ${banglaTime}
${customNote ? `📝 <b>নোট:</b> ${customNote}\n` : ''}
⚡ <b>সরাসরি কথা বলতে নিচের লিংকে ক্লিক করে রুমে যোগ দিন:</b>
👉 <a href="${joinUrl}">${joinUrl}</a>
━━━━━━━━━━━━━━━━━━━━
<i>(লিংকে ক্লিক করলে সরাসরি ২ জনের লাইভ ভয়েস রুমে যুক্ত হয়ে কথা বলা যাবে)</i>`;

    const isPublicUrl = joinUrl.startsWith('https://') || (joinUrl.startsWith('http://') && !joinUrl.includes('localhost'));

    const telegramPayload: Record<string, any> = {
      chat_id: targetChatId,
      text: captionText,
      parse_mode: 'HTML',
    };

    if (isPublicUrl) {
      telegramPayload.reply_markup = {
        inline_keyboard: [
          [
            {
              text: '🎙️ সরাসরি রুমে জয়েন করুন (Join Room)',
              url: joinUrl,
            },
          ],
          [
            {
              text: '🌐 সাইট ওপেন করুন',
              url: baseDomain,
            },
          ],
        ],
      };
    }

    const tgResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(telegramPayload),
    });

    const tgData = await tgResponse.json();

    if (tgData.ok) {
      return res.json({
        success: true,
        messageId: tgData.result.message_id,
        chat: tgData.result.chat,
        joinUrl,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: tgData.description || 'Telegram API error',
        details: tgData,
      });
    }
  } catch (error: any) {
    console.error('Telegram send error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send message to Telegram bot',
    });
  }
});

// Get room details
app.get('/api/rooms/:roomId', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const cleanRoomId = (roomId || '').trim().toUpperCase();
  const room = rooms.get(cleanRoomId);
  if (!room) {
    return res.json({ exists: false, count: 0, peers: [] });
  }

  const peersList = Array.from(room.peers.values()).map(p => ({
    peerId: p.peerId,
    userName: p.userName,
    isMuted: p.isMuted,
    joinedAt: p.joinedAt,
  }));

  res.json({
    exists: true,
    roomId: room.id,
    createdAt: room.createdAt,
    count: peersList.length,
    peers: peersList,
  });
});

// Get room messages via REST
app.get('/api/rooms/:roomId/messages', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const cleanRoomId = (roomId || '').trim().toUpperCase();
  const room = rooms.get(cleanRoomId);
  res.json({
    success: true,
    roomId: cleanRoomId,
    messages: room ? room.messages : [],
  });
});

// Post message to room via REST (reliable fallback and instant sync)
app.post('/api/rooms/:roomId/messages', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const cleanRoomId = (roomId || '').trim().toUpperCase();
  if (!cleanRoomId) {
    return res.status(400).json({ success: false, error: 'Room ID required' });
  }

  const room = getOrCreateRoom(cleanRoomId);
  const { senderId, senderName, text, audioClip, id } = req.body;

  if (!text && !audioClip) {
    return res.status(400).json({ success: false, error: 'Empty message' });
  }

  const chatMsg = {
    id: id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    senderId: senderId || 'anonymous',
    senderName: senderName || 'Player',
    text: text || '',
    timestamp: Date.now(),
    audioClip,
  };

  // Add message if not exists
  if (!room.messages.some(m => m.id === chatMsg.id)) {
    room.messages.push(chatMsg);
    if (room.messages.length > 100) room.messages.shift();
  }

  // Broadcast to all active websockets in this room
  const broadcastData = JSON.stringify({
    type: 'chat-message',
    payload: chatMsg,
  });

  room.peers.forEach(peer => {
    if (peer.ws.readyState === WebSocket.OPEN) {
      peer.ws.send(broadcastData);
    }
  });

  res.json({ success: true, message: chatMsg });
});

// Set up WebSocket Server
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket) => {
  let currentRoomId: string | null = null;
  let currentPeerId: string | null = null;

  ws.on('message', (data: string) => {
    try {
      const message = JSON.parse(data.toString());
      const { type, payload } = message;

      switch (type) {
        case 'join-room': {
          const { roomId, peerId, userName = 'Guest' } = payload;
          const cleanRoomId = (roomId || '').trim().toUpperCase();
          currentRoomId = cleanRoomId;
          currentPeerId = peerId;

          const room = getOrCreateRoom(cleanRoomId);

          // Register or update peer
          const peerConn: PeerConnection = {
            ws,
            peerId,
            userName,
            roomId: cleanRoomId,
            isMuted: false,
            joinedAt: Date.now(),
          };
          room.peers.set(peerId, peerConn);

          // Inform this peer of the current room status, messages, and existing peers
          const otherPeers = Array.from(room.peers.values())
            .filter(p => p.peerId !== peerId)
            .map(p => ({
              peerId: p.peerId,
              userName: p.userName,
              isMuted: p.isMuted,
            }));

          ws.send(
            JSON.stringify({
              type: 'room-joined',
              payload: {
                roomId: cleanRoomId,
                peerId,
                totalPeers: room.peers.size,
                peers: otherPeers,
                messages: room.messages.slice(-50),
              },
            })
          );

          // Broadcast to existing peers in the room that a new peer joined
          room.peers.forEach(peer => {
            if (peer.peerId !== peerId && peer.ws.readyState === WebSocket.OPEN) {
              peer.ws.send(
                JSON.stringify({
                  type: 'peer-joined',
                  payload: {
                    peerId,
                    userName,
                    totalPeers: room.peers.size,
                  },
                })
              );
            }
          });
          break;
        }

        case 'signal': {
          // WebRTC signaling: offer, answer, ice-candidate
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const { targetPeerId, signalType, data: signalData } = payload;

          if (targetPeerId) {
            const targetPeer = room.peers.get(targetPeerId);
            if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
              targetPeer.ws.send(
                JSON.stringify({
                  type: 'signal',
                  payload: {
                    senderPeerId: currentPeerId,
                    signalType,
                    data: signalData,
                  },
                })
              );
            }
          } else {
            // Broadcast to other peers in room
            room.peers.forEach(peer => {
              if (peer.peerId !== currentPeerId && peer.ws.readyState === WebSocket.OPEN) {
                peer.ws.send(
                  JSON.stringify({
                    type: 'signal',
                    payload: {
                      senderPeerId: currentPeerId,
                      signalType,
                      data: signalData,
                    },
                  })
                );
              }
            });
          }
          break;
        }

        case 'chat-message': {
          const targetRoomId = (payload.roomId || currentRoomId || '').trim().toUpperCase();
          const targetPeerId = payload.senderId || currentPeerId;
          if (!targetRoomId) return;
          const room = getOrCreateRoom(targetRoomId);

          const chatMsg = {
            id: payload.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            senderId: targetPeerId || 'anonymous',
            senderName: payload.senderName || 'Player',
            text: payload.text || '',
            timestamp: payload.timestamp || Date.now(),
            audioClip: payload.audioClip,
          };

          if (!room.messages.some(m => m.id === chatMsg.id)) {
            room.messages.push(chatMsg);
            if (room.messages.length > 100) room.messages.shift();
          }

          // Broadcast chat to all peers in the room
          const broadcastData = JSON.stringify({
            type: 'chat-message',
            payload: chatMsg,
          });

          room.peers.forEach(peer => {
            if (peer.ws.readyState === WebSocket.OPEN) {
              peer.ws.send(broadcastData);
            }
          });
          break;
        }

        case 'peer-state-update': {
          if (!currentRoomId || !currentPeerId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const peer = room.peers.get(currentPeerId);
          if (peer) {
            if (typeof payload.isMuted === 'boolean') {
              peer.isMuted = payload.isMuted;
            }
          }

          // Broadcast state update
          room.peers.forEach(p => {
            if (p.peerId !== currentPeerId && p.ws.readyState === WebSocket.OPEN) {
              p.ws.send(
                JSON.stringify({
                  type: 'peer-state-update',
                  payload: {
                    peerId: currentPeerId,
                    isMuted: payload.isMuted,
                    isSpeaking: payload.isSpeaking,
                  },
                })
              );
            }
          });
          break;
        }

        case 'leave-room': {
          cleanupCurrentPeer();
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });

  const cleanupCurrentPeer = () => {
    if (!currentRoomId || !currentPeerId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    // Check if another socket has already taken this peer ID (reconnect)
    const existing = room.peers.get(currentPeerId);
    if (existing && existing.ws !== ws) {
      return;
    }

    room.peers.delete(currentPeerId);

    // Notify remaining peers
    room.peers.forEach(peer => {
      if (peer.ws.readyState === WebSocket.OPEN) {
        peer.ws.send(
          JSON.stringify({
            type: 'peer-left',
            payload: {
              peerId: currentPeerId,
              totalPeers: room.peers.size,
            },
          })
        );
      }
    });

    if (room.peers.size === 0) {
      // Optional keep room for a while or remove
      setTimeout(() => {
        const r = rooms.get(currentRoomId!);
        if (r && r.peers.size === 0) {
          rooms.delete(currentRoomId!);
        }
      }, 1000 * 60 * 30);
    }

    currentRoomId = null;
    currentPeerId = null;
  };

  ws.on('close', cleanupCurrentPeer);
  ws.on('error', cleanupCurrentPeer);
});

// Vite Middleware for Development / Static for Production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(Number(port), '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
  });
}

startServer();
