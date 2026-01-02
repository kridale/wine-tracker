import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBRecw_sxpxcXjAp5VTUDBWT2527jX1Bf8",
  authDomain: "wine-tracker-f934a.firebaseapp.com",
  projectId: "wine-tracker-f934a",
  storageBucket: "wine-tracker-f934a.firebasestorage.app",
  messagingSenderId: "173819906434",
  appId: "1:173819906434:web:426aa6f48de824f419e79b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Helper functions that mimic window.storage API
export const storage = {
  async get(key) {
    try {
      const docRef = doc(db, 'storage', key);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          key: key,
          value: docSnap.data().value
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting document:', error);
      throw error;
    }
  },

  async set(key, value) {
    try {
      const docRef = doc(db, 'storage', key);
      await setDoc(docRef, {
        value: value,
        updatedAt: new Date().toISOString()
      });
      return {
        key: key,
        value: value
      };
    } catch (error) {
      console.error('Error setting document:', error);
      throw error;
    }
  },

  async delete(key) {
    try {
      const docRef = doc(db, 'storage', key);
      await deleteDoc(docRef);
      return {
        key: key,
        deleted: true
      };
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }
};

export { db };
