import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, push, remove, Database } from 'firebase/database';

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

// Sync room metadata to Firebase RTDB
export async function syncRoomToFirebase(roomId: string, data: Record<string, any>) {
  if (!database) return false;
  try {
    const roomRef = ref(database, `rooms/${roomId}`);
    await set(roomRef, {
      ...data,
      updatedAt: Date.now(),
    });
    return true;
  } catch (err) {
    console.warn('Firebase RTDB sync notice (may require open database rules):', err);
    return false;
  }
}

// Push chat message to Firebase RTDB
export async function pushChatMessageToFirebase(roomId: string, message: Record<string, any>) {
  if (!database) return false;
  try {
    const messagesRef = ref(database, `rooms/${roomId}/messages`);
    const newMsgRef = push(messagesRef);
    await set(newMsgRef, message);
    return true;
  } catch (err) {
    console.warn('Firebase RTDB message sync notice:', err);
    return false;
  }
}

// Listen to room updates from Firebase
export function subscribeFirebaseRoom(roomId: string, callback: (data: any) => void) {
  if (!database) return () => {};
  try {
    const roomRef = ref(database, `rooms/${roomId}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        callback(val);
      }
    }, (error) => {
      console.warn('Firebase listen notice:', error);
    });
    return () => unsubscribe();
  } catch (err) {
    console.warn('Firebase subscription error:', err);
    return () => {};
  }
}
