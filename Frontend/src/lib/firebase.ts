import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const cfg = firebaseConfig as any;
const app = initializeApp(cfg);
export const db = getFirestore(app, cfg.firestoreDatabaseId || undefined);
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(err => console.error("Auth persistence error:", err));
export default app;
