import * as admin from 'firebase-admin';

// IMPORTANT: Replace with the path to your Firebase service account key file.
// You can download this file from your Firebase project settings.
const serviceAccount = require('../../serviceAccountKey.json'); 

export function initializeFirebase() {
  if (admin.apps.length === 0) {
    console.log('Initializing Firebase...');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase initialized');
  }

  const db = admin.firestore();
  return db;
}
