// This module handles the connection to the Firebase service.

// The Firebase scripts are now loaded in the HTML file, creating a global 'firebase' object.
// This module simply grabs that global object and exports it for use in other modules.

const { firebase } = window;
let app;
try {
  app = firebase.app();
} catch (e) {
  // This will be handled by the initializeFirebase function
}

const auth = firebase.auth();
const db = firebase.firestore();

/**
 * Initializes the Firebase application.
 * Fetches configuration from a serverless function and initializes the app.
 * @throws {Error} If the configuration cannot be fetched or initialization fails.
 */
export async function initializeFirebase() {
  if (firebase.apps.length) {
    return; // Already initialized
  }

  try {
    const response = await fetch('/.netlify/functions/config');
    if (!response.ok) {
      throw new Error('Could not fetch Firebase configuration.');
    }
    const firebaseConfig = await response.json();
    firebase.initializeApp(firebaseConfig);
    app = firebase.app();
  } catch (error) {
    console.error("Fatal Error: Failed to initialize Firebase.", error);
    document.body.innerHTML = '<div style="text-align: center; padding: 40px; font-family: sans-serif;"><h1>Application Error</h1><p>Could not load application configuration. Please try again later or contact support.</p></div>';
    throw error;
  }
}

// Export the initialized services for use in other modules
export { app, auth, db, firebase };
