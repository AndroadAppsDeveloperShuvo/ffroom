import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  set,
  onValue,
  push,
  remove,
  update,
  onDisconnect,
  Database,
} from 'firebase/database';
import { PeerUser, ChatMessage } from '../types';

export const firebaseConfig = {
  databaseURL: 'https://ffroomsestem-default-rtdb.firebaseio.com/',
  projectId: 'ffroomsestem',
  appId: '1:1080130236833:web:8fbf66b8d9e402d0285be0',
  messagingSenderId: '1080130236833',
};

let app: FirebaseApp;
let database: Database | null = null;

try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  database = getDatabase(app);
} catch (error) {
  console.warn('Firebase initialization notice:', error);
}

export { app, database };

// Join a room in Firebase RTDB with automatic onDisconnect cleanup
export async function joinFirebaseRoomPresence(
  roomId: string,
  peer: { id: string; name: string; isHost: boolean; isMuted?: boolean }
) {
  if (!database) return null;
  const cleanId = roomId.trim().toUpperCase();
  try {
    const peerRef = ref(database, `rooms/${cleanId}/peers/${peer.id}`);
    const metadataRef = ref(database, `rooms/${cleanId}/metadata`);

    // Ensure metadata exists or set creator
    onValue(
      metadataRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          set(metadataRef, {
            roomId: cleanId,
            hostId: peer.id,
            hostName: peer.name,
            createdAt: Date.now(),
          }).catch(() => {});
        }
      },
      { onlyOnce: true }
    );

    // Save peer data
    const peerData = {
      id: peer.id,
      name: peer.name,
      isHost: peer.isHost,
      isMuted: peer.isMuted ?? false,
      isSpeaking: false,
      joinedAt: Date.now(),
    };

    await set(peerRef, peerData);

    // When peer disconnects or tab closes, automatically remove them
    onDisconnect(peerRef).remove().catch(() => {});

    return peerData;
  } catch (err) {
    console.warn('Firebase join presence notice:', err);
    return null;
  }
}

// Update local peer state (mic, speaking) in Firebase RTDB
export function updateFirebasePeerState(
  roomId: string,
  peerId: string,
  state: { isMuted?: boolean; isSpeaking?: boolean }
) {
  if (!database) return;
  const cleanId = roomId.trim().toUpperCase();
  try {
    const peerRef = ref(database, `rooms/${cleanId}/peers/${peerId}`);
    update(peerRef, state).catch(() => {});
  } catch (e) {
    console.warn('Firebase state update notice:', e);
  }
}

// Remove peer on leave
export function leaveFirebaseRoomPresence(roomId: string, peerId: string) {
  if (!database) return;
  const cleanId = roomId.trim().toUpperCase();
  try {
    const peerRef = ref(database, `rooms/${cleanId}/peers/${peerId}`);
    remove(peerRef).catch(() => {});
  } catch (e) {
    console.warn('Firebase leave notice:', e);
  }
}

// Listen to all active peers in the room
export function subscribeFirebasePeers(
  roomId: string,
  currentPeerId: string,
  callback: (peers: PeerUser[], metadata: any) => void
) {
  if (!database) return () => {};
  const cleanId = roomId.trim().toUpperCase();
  try {
    const roomRef = ref(database, `rooms/${cleanId}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        callback([], null);
        return;
      }

      const peersMap = data.peers || {};
      const metadata = data.metadata || null;

      const activePeers: PeerUser[] = Object.values(peersMap)
        .filter((p: any) => p && p.id && p.id !== currentPeerId)
        .map((p: any) => ({
          id: p.id,
          name: p.name || 'Duo Player',
          isMuted: Boolean(p.isMuted),
          isSpeaking: Boolean(p.isSpeaking),
          joinedAt: p.joinedAt || Date.now(),
        }));

      callback(activePeers, metadata);
    });

    return () => unsubscribe();
  } catch (err) {
    console.warn('Firebase subscribe peers notice:', err);
    return () => {};
  }
}

// WebRTC Signaling via Firebase RTDB
export async function sendFirebaseSignal(
  roomId: string,
  targetPeerId: string,
  signal: { senderPeerId: string; signalType: string; data: any }
) {
  if (!database) return false;
  const cleanId = roomId.trim().toUpperCase();
  try {
    const signalRef = push(ref(database, `rooms/${cleanId}/signals/${targetPeerId}`));
    await set(signalRef, {
      ...signal,
      timestamp: Date.now(),
    });
    return true;
  } catch (e) {
    console.warn('Firebase signal send notice:', e);
    return false;
  }
}

// Listen to incoming signals for this peer
export function subscribeFirebaseSignals(
  roomId: string,
  myPeerId: string,
  callback: (signal: { senderPeerId: string; signalType: string; data: any }) => void
) {
  const db = database;
  if (!db) return () => {};
  const cleanId = roomId.trim().toUpperCase();
  try {
    const mySignalsRef = ref(db, `rooms/${cleanId}/signals/${myPeerId}`);
    const unsubscribe = onValue(mySignalsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Iterate over incoming signals
        Object.entries(data).forEach(([key, val]: [string, any]) => {
          if (val && val.signalType) {
            callback(val);
            // Delete processed signal to prevent duplicates
            remove(ref(db, `rooms/${cleanId}/signals/${myPeerId}/${key}`)).catch(() => {});
          }
        });
      }
    });

    return () => unsubscribe();
  } catch (e) {
    console.warn('Firebase subscribe signals notice:', e);
    return () => {};
  }
}

// Push chat message to Firebase RTDB
export async function pushFirebaseChatMessage(roomId: string, message: ChatMessage) {
  if (!database) return false;
  const cleanId = roomId.trim().toUpperCase();
  try {
    const msgRef = ref(database, `rooms/${cleanId}/messages/${message.id}`);
    await set(msgRef, message);
    return true;
  } catch (err) {
    console.warn('Firebase chat push notice:', err);
    return false;
  }
}

// Subscribe to room messages
export function subscribeFirebaseChatMessages(
  roomId: string,
  callback: (messages: ChatMessage[]) => void
) {
  if (!database) return () => {};
  const cleanId = roomId.trim().toUpperCase();
  try {
    const messagesRef = ref(database, `rooms/${cleanId}/messages`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === 'object') {
        const msgs = Object.values(data) as ChatMessage[];
        // Sort by timestamp
        msgs.sort((a, b) => a.timestamp - b.timestamp);
        callback(msgs);
      }
    });

    return () => unsubscribe();
  } catch (e) {
    console.warn('Firebase chat subscribe notice:', e);
    return () => {};
  }
}
