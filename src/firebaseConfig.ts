// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBylwf3rineVMCG3yG-Q1PPgNuqxXZCkN8",
  authDomain: "neurotrade33-80989862-7459e.firebaseapp.com",
  projectId: "neurotrade33-80989862-7459e",
  storageBucket: "neurotrade33-80989862-7459e.firebasestorage.app",
  messagingSenderId: "451475660240",
  appId: "1:451475660240:web:46385446a8e2f102566dd5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
