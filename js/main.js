// js/main.js

import { initializeAuth, setupActivityListeners, clearActivityListeners } from './auth.js';
import { getFirebaseConfig } from './api.js';
import { initializeCalendar } from './calendar.js';
import { initializeDashboard, renderDashboard } from './dashboard.js';
import { initializeUI, openModal, handleAIActionPlan, handleShare, initializeCharCounters } from './ui.js';
import { initializePlanView, showPlanView } from './plan-view.js';

/**
 * Runs the main application logic after Firebase has been initialized.
 * @param {object} app The initialized Firebase app instance.
 */
function runApp(app) {
    const auth = firebase.auth();
    const db = firebase.firestore();

    const appState = {
        planData: {},
        currentUser: null,
        currentPlanId: null,
        currentView: 'vision',
        planUnsubscribe: null,
        calendarUnsubscribe: null,
        calendar: {
            currentDate: new Date(),
            data: {},
            editingEventIndex: null
        },
        // Add a controller property to the app state for the AI plan generation
        aiPlanGenerationController: null 
    };

    initializeAuth(auth);
    initializeUI(db, appState);
    initializeCalendar(db, appState, openModal);
    initializeDashboard(db, appState, openModal, handleSelectPlan);
    // Pass all the required handler functions from ui.js into plan-view.js
    initializePlanView(db, appState, openModal, initializeCharCounters, handleAIActionPlan, handleShare);

    function handleSelectPlan(planId) {
        document.getElementById('dashboard-view').classList.add('hidden');
        document.getElementById('radial-menu-container').classList.remove('hidden');
        showPlanView(planId);
    }

    function handleBackToDashboard() {
        if (appState.planUnsubscribe) appState.planUnsubscribe();
        if (appState.calendarUnsubscribe) appState.calendarUnsubscribe();
        localStorage.removeItem('lastPlanId');
        localStorage.removeItem('lastViewId');
        document.getElementById('app-view').classList.add('hidden');
        document.getElementById('radial-menu-container').classList.add('hidden');
        document.getElementById('dashboard-view').classList.remove('hidden');
        renderDashboard();
    }

    document.addEventListener('logout-request', (e) => {
        if (e.detail && e.detail.isTimeout) {
            openModal('timeout');
        }
        localStorage.removeItem('lastPlanId');
        localStorage.removeItem('lastViewId');
        auth.signOut();
    });

    document.addEventListener('back-to-dashboard', handleBackToDashboard);
    document.addEventListener('rerender-dashboard', renderDashboard);
    document.addEventListener('plan-selected', (e) => handleSelectPlan(e.detail.planId));

    auth.onAuthStateChanged(async (user) => {
        const initialLoadingView = document.getElementById('initial-loading-view');
        const loginView = document.getElementById('login-view');
        const dashboardView = document.getElementById('dashboard-view');
        const appView = document.getElementById('app-view');
        
        if (appState.planUnsubscribe) appState.planUnsubscribe();
        if (appState.calendarUnsubscribe) appState.calendarUnsubscribe();
        
        if (user) {
            initialLoadingView.classList.remove('hidden');
            loginView.classList.add('hidden');

            appState.currentUser = user;
            const userDocRef = db.collection('users').doc(user.uid);
            const userDoc = await userDocRef.get();

            if (!userDoc.exists) {
                initialLoadingView.classList.add('hidden');
                window.location.href = '/profile.html?setup=true';
                return;
            }

            setupActivityListeners(appState);
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
            appState.currentPlanId = null;
            appState.planData = {};
            clearActivityListeners();
            dashboardView.classList.add('hidden');
            appView.classList.add('hidden');
            document.getElementById('modal-overlay').classList.add('hidden');
            document.getElementById('calendar-modal').classList.add('hidden');
            document.getElementById('radial-menu-container').classList.add('hidden');
            loginView.classList.remove('hidden');
        }
        initialLoadingView.classList.add('hidden');
    });
}

document.addEventListener('DOMContentLoaded', initializeFirebase);
