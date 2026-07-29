import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let dbInstance = null;

if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CONFIG || process.env.NODE_ENV === 'production') {
  try {
    const apps = getApps();
    if (!apps.length) {
      initializeApp({
        projectId: 'siteon-47a8f'
      });
      console.log('[NIRAI Firebase Admin] Initialized successfully for siteon-47a8f');
    }
    dbInstance = getFirestore();
  } catch (err) {
    console.warn('[NIRAI Firebase Admin] Init skipped:', err.message);
  }
} else {
  console.log('[NIRAI Firebase Admin] Running in local dev mode (WebSocket & REST active)');
}

export const db = dbInstance;
export default dbInstance;
