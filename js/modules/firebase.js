// js/app.js

// Step 1: Import ONLY the initializer function first.
import { initializeFirebase } from './modules/firebase.js';

/**
 * Main function to start the application.
 */
async function startApp() {
  try {
    // Step 2: Initialize Firebase and WAIT for it to complete.
    await initializeFirebase();

    // Step 3: NOW that Firebase is ready, dynamically import the rest of the app logic.
    // This ensures that when auth.js and other modules are loaded, they have a working Firebase connection.
    const { initializeAuthListener, setupAuthEventListeners } = await import('./modules/auth.js');
    const { setupCalendarEventListeners } = await import('./modules/calendar.js');

    // Step 4: Run the setup functions.
    initializeAuthListener();
    setupAuthEventListeners();
    setupCalendarEventListeners(); // We can set up the main calendar listeners now.
    
    // The rest of your app's logic will now be handled by the auth listener, as it was before.
    console.log("Application startup sequence complete.");

  } catch (error) {
    console.error("Application failed to start:", error);
  }
}

// Start the application immediately.
startApp();
