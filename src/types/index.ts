export interface RoomInfo {
  id: string;
  creatorName: string;
  createdAt: number;
  participantsCount: number;
  maxParticipants: number;
  status: 'waiting' | 'connected' | 'full';
  customNote?: string;
}

export interface PeerUser {
  id: string;
  name: string;
  isHost?: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  joinedAt: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  audioClip?: string; // base64 recorded audio note
}

export interface TelegramSendResult {
  success: boolean;
  messageId?: number;
  joinUrl?: string;
  error?: string;
}
