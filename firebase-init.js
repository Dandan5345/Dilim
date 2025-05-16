// firebase-init.js

// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";

// Your web app's Firebase configuration (UPDATED)
const firebaseConfig = {
  apiKey: "AIzaSyB6div2l38QLvk8p57LIM0evShWxA_YywM", // UPDATED
  authDomain: "nofesh-li-la.firebaseapp.com",       // UPDATED
  projectId: "nofesh-li-la",                        // UPDATED
  storageBucket: "nofesh-li-la.firebasestorage.app",// UPDATED - Assuming this is correct, if it's appspot.com, please adjust.
  messagingSenderId: "184050357283",                // UPDATED
  appId: "1:184050357283:web:80fafbe55b2a9f74c4cd96",// UPDATED
  measurementId: "G-6F8PKVGT08"                     // UPDATED
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app); // Analytics is initialized but not actively used in the provided scripts. You can remove if not needed.
const auth = getAuth(app);
const db = getFirestore(app);

// Export Firebase services to be used in other modules
export { app, analytics, auth, db };
