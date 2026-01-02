import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBRecw_sxpxcXjAp5VTUDBWT2527jX1Bf8",
  authDomain: "wine-tracker-f934a.firebaseapp.com",
  projectId: "wine-tracker-f934a",
  storageBucket: "wine-tracker-f934a.firebasestorage.app",
  messagingSenderId: "173819906434",
  appId: "1:173819906434:web:426aa6f48de824f419e79b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const MAX_CHUNK_SIZE = 800000;

export const storage = {
  async get(key) {
    try {
      const metaRef = doc(db, 'storage', `${key}_meta`);
      const metaSnap = await getDoc(metaRef);
      
      if (metaSnap.exists()) {
        const { chunkCount } = metaSnap.data();
        let fullValue = '';
        
        for (let i = 0; i < chunkCount; i++) {
          const chunkRef = doc(db, 'storage', `${key}_chunk_${i}`);
          const chunkSnap = await getDoc(chunkRef);
          
          if (chunkSnap.exists()) {
            fullValue += chunkSnap.data().value;
          } else {
            throw new Error(`Missing chunk ${i} for key ${key}`);
          }
        }
        
        return {
          key: key,
          value: fullValue
        };
      }
      
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

  async set(key, value, onProgress = null) {
    try {
      const valueLength = value.length;
      
      if (valueLength <= MAX_CHUNK_SIZE) {
        const docRef = doc(db, 'storage', key);
        await setDoc(docRef, {
          value: value,
          updatedAt: new Date().toISOString()
        });
        
        if (onProgress) {
          onProgress({ 
            type: 'storage', 
            message: `Stored ${key} (${(valueLength / 1024).toFixed(2)} KB)` 
          });
        }
        
        return {
          key: key,
          value: value
        };
      }
      
      const chunks = [];
      for (let i = 0; i < valueLength; i += MAX_CHUNK_SIZE) {
        chunks.push(value.substring(i, i + MAX_CHUNK_SIZE));
      }
      
      if (onProgress) {
        onProgress({ 
          type: 'storage', 
          message: `Splitting ${key} into ${chunks.length} chunks (${(valueLength / 1024 / 1024).toFixed(2)} MB total)` 
        });
      }
      
      const metaRef = doc(db, 'storage', `${key}_meta`);
      await setDoc(metaRef, {
        chunkCount: chunks.length,
        totalSize: valueLength,
        updatedAt: new Date().toISOString()
      });
      
      for (let i = 0; i < chunks.length; i++) {
        const chunkRef = doc(db, 'storage', `${key}_chunk_${i}`);
        await setDoc(chunkRef, {
          value: chunks[i],
          chunkIndex: i,
          updatedAt: new Date().toISOString()
        });
        
        if (onProgress) {
          onProgress({ 
            type: 'storage', 
            message: `Saved chunk ${i + 1}/${chunks.length}` 
          });
        }
      }
      
      try {
        const oldDocRef = doc(db, 'storage', key);
        await deleteDoc(oldDocRef);
      } catch (err) {
        // Ignore if doesn't exist
      }
      
      if (onProgress) {
        onProgress({ 
          type: 'storage', 
          message: `Successfully stored ${key} in ${chunks.length} chunks` 
        });
      }
      
      return {
        key: key,
        value: value
      };
    } catch (error) {
      console.error('Error setting document:', error);
      if (onProgress) {
        onProgress({ 
          type: 'error', 
          message: `Storage error: ${error.message}` 
        });
      }
      throw error;
    }
  },

  async delete(key) {
    try {
      const metaRef = doc(db, 'storage', `${key}_meta`);
      const metaSnap = await getDoc(metaRef);
      
      if (metaSnap.exists()) {
        const { chunkCount } = metaSnap.data();
        
        for (let i = 0; i < chunkCount; i++) {
          const chunkRef = doc(db, 'storage', `${key}_chunk_${i}`);
          await deleteDoc(chunkRef);
        }
        
        await deleteDoc(metaRef);
      }
      
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
export default App;
