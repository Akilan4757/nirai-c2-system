import admin from 'firebase-admin';

// Initialize Firebase Admin with project siteon-47a8f
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      projectId: 'siteon-47a8f',
      databaseURL: 'https://siteon-47a8f-default-rtdb.asia-southeast1.firebasedatabase.app'
    });
    console.log('[NIRAI Firebase Admin] Initialized successfully for siteon-47a8f');
  } catch (err) {
    console.warn('[NIRAI Firebase Admin] Init warning:', err.message);
  }
}

export const db = admin.firestore();
export const rtdb = admin.database();
export default admin;
