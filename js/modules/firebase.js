let app;
let auth;
let db;

/**
 * Initializes the Firebase application.
 * Fetches configuration from a serverless function, initializes the app,
 * and sets up auth and firestore services.
 * @throws {Error} If the configuration cannot be fetched or initialization fails.
 */
export async function initializeFirebase() {
  try {
    const response = await fetch('/.netlify/functions/config');
    if (!response.ok) {
      throw new Error('Could not fetch Firebase configuration.');
    }
    const firebaseConfig = await response.json();
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
  } catch (error) {
    console.error("Fatal Error: Failed to initialize Firebase.", error);
    // Display a user-friendly error message on the screen
    document.body.innerHTML = '<div style="text-align: center; padding: 40px; font-family: sans-serif;"><h1>Application Error</h1><p>Could not load application configuration. Please try again later or contact support.</p></div>';
    // Re-throw the error to prevent the rest of the app from running
    throw error;
  }
}

// Export the initialized services for use in other modules
export { app, auth, db };
