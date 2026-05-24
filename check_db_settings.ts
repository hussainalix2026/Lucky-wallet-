import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

// Define firebase config using environmental or default parameters
const firebaseConfig = {
  projectId: "c8356ed6-6cbd-4375-b711-2ebb86256bb4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkSettings() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'global'));
    if (snap.exists()) {
      console.log('Current Global Settings:', JSON.stringify(snap.data(), null, 2));
    } else {
      console.log('No global settings doc found!');
    }
  } catch (err) {
    console.error('Error fetching settings:', err);
  }
}

checkSettings();
