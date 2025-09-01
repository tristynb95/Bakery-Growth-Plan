// js/main.js

import { initializeAuth, setupActivityListeners, clearActivityListeners } from './auth.js';
import { getFirebaseConfig, generateAiActionPlan } from './api.js';
import { initializeCalendar } from './calendar.js';
import { initializeDashboard, renderDashboard } from './dashboard.js';
import { initializeUI, openModal, closeModal, initializeCharCounters, handleAIActionPlan, handleShare } from './ui.js';
import { initializePlanView, showPlanView } from './plan-view.js';

/**
 * Fetches the Firebase config and initializes the Firebase app.
 */
async function initializeFirebase() {
    try {
        const firebaseConfig = await getFirebaseConfig();
        const app = firebase.initializeApp(firebaseConfig);
        runApp(app);
    } catch (error) {
        console.error("Failed to initialize Firebase:", error);
        document.body.innerHTML = '<div style="text-align: center; padding: 40px; font-family: sans-serif;"><h1>Error</h1><p>Could not load application configuration. Please contact support.</p></div>';
    }
}

/**
 * Runs the main application logic after Firebase has been initialized.
 * @param {object} app The initialized Firebase app instance.
 */
function runApp(app) {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // The single source of truth for the application's state
    const appState = {
        planData: {},
        currentUser: null,
        currentPlanId: null,
        currentView: 'vision',
        planUnsubscribe: null,
        calendarUnsubscribe: null,
        calendar: { // Add the calendar state here
            currentDate: new Date(),
            data: {},
            editingEventIndex: null
        }
    };

    // --- Module Initializers ---
    initializeAuth(auth);
    initializeUI(db, appState);
    initializeCalendar(db, appState);
    initializeDashboard(db, appState, openModal, handleSelectPlan);
    initializePlanView(db, appState, openModal, initializeCharCounters, handleAIActionPlan, handleShare);


    // --- Central Control Functions ---
    /**
     * Hides the dashboard and shows the detailed plan view for a selected plan.
     * @param {string} planId The ID of the plan to view.
     */
    function handleSelectPlan(planId) {
        document.getElementById('dashboard-view').classList.add('hidden');
        document.getElementById('radial-menu-container').classList.remove('hidden');
        showPlanView(planId);
    }

    /**
     * Unsubscribes from plan data and returns to the dashboard view.
     */
    function handleBackToDashboard() {
        if (appState.planUnsubscribe) appState.planUnsubscribe();
        if (appState.calendarUnsubscribe) appState.calendarUnsubscribe(); // Also unsubscribe from calendar
        localStorage.removeItem('lastPlanId');
        localStorage.removeItem('lastViewId');
        document.getElementById('app-view').classList.add('hidden');
        document.getElementById('radial-menu-container').classList.add('hidden');
        document.getElementById('dashboard-view').classList.remove('hidden'); // Ensure dashboard is visible
        renderDashboard(); // Re-render the dashboard to show the latest data
    }

    // --- Event Listeners for Cross-Module Communication ---
    document.addEventListener('logout-request', (e) => {
        if (e.detail && e.detail.isTimeout) {
            openModal('timeout');
        }
        // This is the fix: clear the last viewed plan from local storage on logout
        localStorage.removeItem('lastPlanId');
        localStorage.removeItem('lastViewId');
        auth.signOut();
    });

    document.addEventListener('back-to-dashboard', handleBackToDashboard);
    document.addEventListener('rerender-dashboard', renderDashboard);
    document.addEventListener('plan-selected', (e) => handleSelectPlan(e.detail.planId));


    // --- Authentication Observer ---
    auth.onAuthStateChanged(async (user) => {
        const loginView = document.getElementById('login-view');
        const dashboardView = document.getElementById('dashboard-view');
        const appView = document.getElementById('app-view');
        const initialLoadingView = document.getElementById('initial-loading-view');

        if (appState.planUnsubscribe) appState.planUnsubscribe();
        if (appState.calendarUnsubscribe) appState.calendarUnsubscribe();

        initialLoadingView.classList.add('hidden');

        if (user) {
            appState.currentUser = user;
            setupActivityListeners(appState); // Start session timer
            loginView.classList.add('hidden');
            const lastPlanId = localStorage.getItem('lastPlanId');
            if (lastPlanId) {
                handleSelectPlan(lastPlanId);
            } else {
                dashboardView.classList.remove('hidden');
                appView.classList.add('hidden');
                await renderDashboard();
            }
        } else {
            appState.currentUser = null;
            appState.currentPlanId = null; // Clear plan ID on logout
            appState.planData = {}; // Clear plan data
            clearActivityListeners(); // Stop session timer
            dashboardView.classList.add('hidden');
            appView.classList.add('hidden');
            loginView.classList.remove('hidden');
        }
    });
}

// Start the entire application once the page content has loaded.
document.addEventListener('DOMContentLoaded', initializeFirebase);
