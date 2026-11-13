import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBGUXP5hLoov6n9Wd1BZemXaTSxTrIWdZw", // Sin comillas extras adentro
  authDomain: "mr-celulares.firebaseapp.com",
  projectId: "mr-celulares",
  storageBucket: "mr-celulares.firebasestorage.app",
  messagingSenderId: "472115304470",
  appId: "1:472115304470:web:b0c0d852d23e2f64a97d37"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);