const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDLjuWtgKG2nBPmkrDCcyhnYQL3QhOiHcI",
  authDomain:        "itcaibase.firebaseapp.com",
  projectId:         "itcaibase",
  storageBucket:     "itcaibase.firebasestorage.app",
  messagingSenderId: "459224528027",
  appId:             "1:459224528027:web:1c573be0b85fdfcfdc023e"
};

if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

const auth = firebase.auth();
const db   = firebase.firestore();
