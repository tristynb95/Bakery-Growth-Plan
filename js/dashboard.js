// js/dashboard.js

import { calculatePlanCompletion } from './utils.js';

// These will be passed in from main.js so this module can talk to the database and the rest of the app.
let db, appState, openModal, handleSelectPlan;

/**
 * Formats a Firestore timestamp into a user-friendly string like "Today at 14:30".
 * @param {object} lastEditedDate A Firestore timestamp object.
 * @returns {string} The formatted date string.
 */
function formatLastEditedDate(lastEditedDate) {
    if (!lastEditedDate || !lastEditedDate.toDate) {
        return 'N/A';
    }
    const now = new Date();
    const editedDate = lastEditedDate.toDate();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

    if (editedDate >= startOfToday) {
        return `Today at ${editedDate.getHours().toString().padStart(2, '0')}:${editedDate.getMinutes().toString().padStart(2, '0')}`;
    } else if (editedDate >= startOfYesterday) {
        return `Yesterday at ${editedDate.getHours().toString().padStart(2, '0')}:${editedDate.getMinutes().toString().padStart(2, '0')}`;
    } else {
        const day = editedDate.getDate();
        const month = editedDate.toLocaleString('en-GB', { month: 'short' });
        const year = editedDate.getFullYear();
        return `${day} ${month} ${year}`;
    }
}

// --- Main Exported Functions ---

/**
 * Fetches plans from the database and renders them as cards on the dashboard.
 */
export async function renderDashboard() {
    if (!appState.currentUser) return;

    const dashboardContent = document.getElementById('dashboard-content');
    const dashboardView = document.getElementById('dashboard-view');

    // ================== THE FIX ==================
    // If we're not on the main dashboard page, these elements won't exist.
    // Exit the function gracefully before trying to modify them.
    if (!dashboardView || !dashboardContent) {
        return;
    }
    // =============================================

    dashboardView.classList.remove('hidden'); // Show the dashboard
    
    let plans = [];
    try {
        const plansRef = db.collection('users').doc(appState.currentUser.uid).collection('plans');
        const snapshot = await plansRef.orderBy('lastEdited', 'desc').get();
        plans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching user plans:", error);
    }

    const firstName = (appState.currentUser.displayName || appState.currentUser.email || '').split(' ')[0] || 'there';
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    let dashboardHTML = `
        <div class="dashboard-hero">
            <div class="dashboard-hero-text">
                <h1 class="text-4xl font-black text-gray-900 font-poppins">${greeting}, ${firstName}</h1>
                <p class="text-lg text-gray-500 mt-1">You have <strong>${plans.length}</strong> growth plan${plans.length !== 1 ? 's' : ''}. Keep up the momentum.</p>
            </div>
        </div>
        <div class="dashboard-grid">`;

    plans.forEach(plan => {
        const completion = calculatePlanCompletion(plan);
        const editedDate = formatLastEditedDate(plan.lastEdited);
        const planName = plan.planName || 'Untitled Plan';
        const progressColor = completion === 100 ? 'var(--gails-green)' : 'var(--gails-red)';
        const statusLabel = completion === 100 ? 'Complete' : completion > 0 ? 'In Progress' : 'Not Started';
        const statusClass = completion === 100 ? 'status-complete' : completion > 0 ? 'status-in-progress' : 'status-not-started';

        dashboardHTML += `
            <div class="plan-card">
                <div class="plan-card-accent" style="--accent-progress: ${completion}; --accent-color: ${progressColor}"></div>
                <div class="plan-card-actions">
                    <button class="plan-action-btn edit-plan-btn" data-plan-id="${plan.id}" data-plan-name="${planName}" data-plan-quarter="${plan.quarter || ''}" title="Edit Details"><i class="bi bi-pencil-square"></i></button>
                    <button class="plan-action-btn delete-plan-btn" data-plan-id="${plan.id}" data-plan-name="${planName}" data-plan-quarter="${plan.quarter || ''}" title="Delete Plan"><i class="bi bi-trash3-fill"></i></button>
                </div>
                <div class="plan-card-main" data-plan-id="${plan.id}">
                    <div class="plan-card-header">
                        <div class="plan-card-icon"><i class="bi bi-journal-richtext"></i></div>
                        <span class="plan-card-status ${statusClass}">${statusLabel}</span>
                    </div>
                    <div class="plan-card-body">
                        <h3 class="plan-card-title">${planName}</h3>
                        <p class="plan-card-quarter"><i class="bi bi-calendar3"></i> ${plan.quarter || 'No quarter set'}</p>
                    </div>
                    <div class="plan-card-footer">
                        <div class="plan-card-progress-bar">
                            <div class="plan-card-progress-fill" style="width: ${completion}%; background-color: ${progressColor}"></div>
                        </div>
                        <div class="plan-card-meta">
                            <span class="plan-card-completion">${completion}%</span>
                            <span class="plan-card-edited"><i class="bi bi-clock"></i> ${editedDate}</span>
                        </div>
                    </div>
                </div>
            </div>`;
    });

    dashboardHTML += `
        <div class="plan-card new-plan-card" id="create-new-plan-btn">
            <div class="new-plan-card-inner">
                <div class="new-plan-icon-ring"><i class="bi bi-plus-lg"></i></div>
                <p class="new-plan-label">Create New Plan</p>
                <p class="new-plan-sublabel">Start a fresh 90-day sprint</p>
            </div>
        </div>
    </div>`;
    dashboardContent.innerHTML = dashboardHTML;
}


/**
 * Sets up all event listeners for the dashboard page.
 */
export function initializeDashboard(database, state, modalOpener, planSelector) {
    db = database;
    appState = state;
    openModal = modalOpener;
    handleSelectPlan = planSelector;

    const dashboardContent = document.getElementById('dashboard-content');
    
    // If the main dashboard content area doesn't exist on the current page,
    // exit the function to prevent errors.
    if (!dashboardContent) {
        return;
    }

    const dashboardLogoutBtn = document.getElementById('dashboard-logout-btn');
    const dashboardProfileBtn = document.getElementById('dashboard-profile-btn');
    const dashboardAdminBtn = document.getElementById('dashboard-admin-btn');

    dashboardLogoutBtn.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('logout-request'));
    });

    dashboardProfileBtn.addEventListener('click', () => {
        window.location.href = '/profile.html';
    });

    if (dashboardAdminBtn) {
        dashboardAdminBtn.addEventListener('click', () => {
            window.location.href = '/admin.html';
        });

        firebase.auth().onAuthStateChanged((user) => {
            if (user && user.email === 'tristen_bayley@gailsbread.co.uk') {
                dashboardAdminBtn.classList.remove('hidden');
            } else {
                dashboardAdminBtn.classList.add('hidden');
            }
        });
    }
    
    dashboardContent.addEventListener('click', (e) => {
        const createBtn = e.target.closest('#create-new-plan-btn');
        const mainCard = e.target.closest('.plan-card-main');
        const editBtn = e.target.closest('.edit-plan-btn');
        const deleteBtn = e.target.closest('.delete-plan-btn');
        
        if (editBtn) {
            e.stopPropagation();
            openModal('edit', { 
                planId: editBtn.dataset.planId, 
                currentName: editBtn.dataset.planName,
                currentQuarter: editBtn.dataset.planQuarter 
            });
        } else if (deleteBtn) {
            e.stopPropagation();
            openModal('delete', { planId: deleteBtn.dataset.planId, planName: deleteBtn.dataset.planName, planQuarter: deleteBtn.dataset.planQuarter });
        } else if (createBtn) {
            openModal('create');
        } else if (mainCard) {
            handleSelectPlan(mainCard.dataset.planId);
        }
    });
}