// js/main.js

import { initializeAuth, setupActivityListeners, clearActivityListeners, handleSignOut } from './auth.js';
import { getFirebaseConfig } from './api.js';
import { initializeCalendar } from './calendar.js';
import { initializeDashboard, renderDashboard } from './dashboard.js';
import { initializeUI, openModal, handleAIActionPlan, handleShare, initializeCharCounters } from './ui.js';
import { initializePlanView, showPlanView } from './plan-view.js';
import { initializeChat } from './chat.js';
import { initializeFiles } from './files.js';

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

function runApp(app) {
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();

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
        aiPlanGenerationController: null
    };

    initializeAuth(auth);
    initializeUI(db, appState);
    initializeCalendar(db, appState, openModal);
    initializeDashboard(db, appState, openModal, handleSelectPlan);
    initializePlanView(db, appState, openModal, initializeCharCounters, handleAIActionPlan, handleShare);
    initializeChat(appState, db);
    initializeFiles(db, storage, appState, auth);

    function handleSelectPlan(planId) {
        document.getElementById('dashboard-view').classList.add('hidden');
        document.getElementById('radial-menu-container').classList.remove('hidden');
        showPlanView(planId);
    }

    function handleBackToDashboard() {
        if (appState.planUnsubscribe) appState.planUnsubscribe();
        if (appState.calendarUnsubscribe) appState.calendarUnsubscribe();
        sessionStorage.removeItem('lastPlanId');
        sessionStorage.removeItem('lastViewId');
        document.getElementById('app-view').classList.add('hidden');
        document.getElementById('radial-menu-container').classList.add('hidden');
        document.getElementById('dashboard-view').classList.remove('hidden');
        renderDashboard();
    }

    document.addEventListener('logout-request', (e) => {
        if (e.detail && e.detail.isTimeout) {
            openModal('timeout');
        }
        if (e.detail && e.detail.isRevival) {
            const authError = document.getElementById('auth-error');
            if (authError) {
                authError.textContent = 'For your security, please sign in again.';
                authError.style.display = 'block';
            }
        }
        handleSignOut();
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
            const lastActivity = localStorage.getItem('lastActivity');
            const MAX_INACTIVITY_PERIOD = 8 * 60 * 60 * 1000; // 8 hours
            if (lastActivity && (new Date().getTime() - lastActivity > MAX_INACTIVITY_PERIOD)) {
                console.log("Maximum inactivity period exceeded. Forcing logout.");
                document.dispatchEvent(new CustomEvent('logout-request', { detail: { isRevival: true } }));
                return;
            }
            localStorage.setItem('lastActivity', new Date().getTime());

            if (initialLoadingView) initialLoadingView.classList.remove('hidden');
            if (loginView) loginView.classList.add('hidden');

            appState.currentUser = user;
            const userDocRef = db.collection('users').doc(user.uid);
            const userDoc = await userDocRef.get();

            if (!userDoc.exists) {
                if (initialLoadingView) initialLoadingView.classList.add('hidden');
                window.location.href = '/profile.html?setup=true';
                return;
            }

            setupActivityListeners(appState);
            const lastPlanId = sessionStorage.getItem('lastPlanId');
            if (lastPlanId) {
                handleSelectPlan(lastPlanId);
            } else {
                if (dashboardView) dashboardView.classList.remove('hidden');
                if (appView) appView.classList.add('hidden');
                await renderDashboard();
            }
        } else {
            appState.currentUser = null;
            appState.currentPlanId = null;
            appState.planData = {};
            clearActivityListeners();

            if (window.location.pathname !== '/index.html' && window.location.pathname !== '/' && window.location.pathname !== '/action.html') {
                window.location.href = '/index.html';
                return;
            }
            
            if (dashboardView) dashboardView.classList.add('hidden');
            if (appView) appView.classList.add('hidden');
            
            const modalOverlay = document.getElementById('modal-overlay');
            if (modalOverlay) modalOverlay.classList.add('hidden');

            const calendarModal = document.getElementById('calendar-modal');
            if (calendarModal) calendarModal.classList.add('hidden');
            
            const radialMenu = document.getElementById('radial-menu-container');
            if (radialMenu) radialMenu.classList.add('hidden');
            
            if (loginView) loginView.classList.remove('hidden');
        }
        if (initialLoadingView) initialLoadingView.classList.add('hidden');
    });
}

document.addEventListener('DOMContentLoaded', initializeFirebase);
