import firebase from 'firebase/app/dist/index.cjs.js';
import 'firebase/auth/dist/index.cjs.js';
import 'firebase/firestore/dist/index.cjs.js';

let firebaseApp;
let auth;
let db;

export async function initializeFirebase() {
    try {
        const response = await fetch('/.netlify/functions/config');
        if (!response.ok) {
            throw new Error('Could not fetch Firebase configuration.');
        }
        const firebaseConfig = await response.json();
        firebaseApp = firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();

        return { firebaseApp, auth, db };

    } catch (error) {
        console.error("Failed to initialize Firebase:", error);
        document.body.innerHTML = '<div style="text-align: center; padding: 40px; font-family: sans-serif;"><h1>Error</h1><p>Could not load application configuration. Please contact support.</p></div>';
        throw error;
    }
}

export { firebaseApp, auth, db };
