import admin from 'firebase-admin';

const firebaseAdmin = admin.default || admin;

let dbInstance = null;
let rtdbInstance = null;

try {
  const apps = firebaseAdmin.apps || (firebaseAdmin.default && firebaseAdmin.default.apps) || [];
  if (!apps.length) {
    firebaseAdmin.initializeApp({
      projectId: 'siteon-47a8f',
      databaseURL: 'https://siteon-47a8f-default-rtdb.asia-southeast1.firebasedatabase.app'
    });
    console.log('[NIRAI Firebase Admin] Initialized successfully for siteon-47a8f');
  }
  dbInstance = firebaseAdmin.firestore();
  rtdbInstance = firebaseAdmin.database ? firebaseAdmin.database() : null;
} catch (err) {
  console.warn('[NIRAI Firebase Admin] Init warning:', err.message);
}

export const db = dbInstance;
export const rtdb = rtdbInstance;
export default firebaseAdmin;
