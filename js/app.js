import { initializeFirebase } from './modules/firebase.js';
import { initializeAuthListener, setupAuthEventListeners } from './modules/auth.js';
import { DOMElements } from './modules/dom.js';
import { appState } from './modules/state.js';
import { saveData } from './modules/api.js';
import { switchView, handleBackToDashboard, handleSelectPlan, handleCreateNewPlan, handleEditPlanName, handleDeletePlan } from './modules/ui.js';
import { setupCalendarEventListeners, renderCalendar, renderDayDetails } from './modules/calendar.js';
import { handleAIActionPlan } from './modules/ai.js';
import { openModal, closeModal } from './modules/modal.js';

/**
 * Main function to initialize the application.
 */
async function main() {
    try {
        await initializeFirebase();
        initializeAuthListener();
        setupEventListeners();
    } catch (error) {
        console.error("Application failed to start:", error);
    }
}

/**
 * Sets up all the main event listeners for the application.
 */
function setupEventListeners() {
    setupAuthEventListeners();
    setupCalendarEventListeners();

    DOMElements.dashboardProfileBtn.addEventListener('click', () => {
        window.location.href = '/profile.html';
    });

    DOMElements.backToDashboardBtn.addEventListener('click', handleBackToDashboard);

    DOMElements.dashboardContent.addEventListener('click', (e) => {
        const createBtn = e.target.closest('#create-new-plan-btn');
        const mainCard = e.target.closest('.plan-card-main');
        const editBtn = e.target.closest('.edit-plan-btn');
        const deleteBtn = e.target.closest('.delete-plan-btn');
        if (editBtn) { e.stopPropagation(); handleEditPlanName(editBtn.dataset.planId, editBtn.dataset.planName); }
        else if (deleteBtn) { e.stopPropagation(); handleDeletePlan(deleteBtn.dataset.planId, deleteBtn.dataset.planName); }
        else if (createBtn) { handleCreateNewPlan(); }
        else if (mainCard) { handleSelectPlan(mainCard.dataset.planId); }
    });

    DOMElements.mainNav.addEventListener('click', (e) => {
        e.preventDefault();
        const navLink = e.target.closest('a');
        if (navLink) {
            switchView(navLink.id.replace('nav-', ''));
        }
    });

    DOMElements.contentArea.addEventListener('keydown', (e) => {
        const editor = e.target.closest('[contenteditable="true"]');
        if (!editor) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
            e.preventDefault();
            document.execCommand('bold', false, null);
        }
        const maxLength = parseInt(editor.dataset.maxlength, 10);
        if (maxLength) {
            const isControlKey = e.key.length > 1 || e.ctrlKey || e.metaKey;
            if (editor.innerText.length >= maxLength && !isControlKey) {
                e.preventDefault();
            }
        }
    });

    DOMElements.contentArea.addEventListener('input', (e) => {
        if (e.target.matches('input, [contenteditable="true"]')) {
            saveData();
        }
        if (e.target.isContentEditable) {
            const managePlaceholder = (editor) => {
                if (!editor || !editor.isContentEditable) return;
                if (editor.innerText.trim() === '') {
                    editor.classList.add('is-placeholder-showing');
                } else {
                    editor.classList.remove('is-placeholder-showing');
                }
            };
            managePlaceholder(e.target);
        }
    });

    DOMElements.contentArea.addEventListener('click', (e) => {
        const target = e.target;
        const pillarButton = target.closest('.pillar-button');
        if (pillarButton) {
            pillarButton.classList.toggle('selected');
            saveData(true);
            return;
        }
        const statusButton = target.closest('.status-button');
        if (statusButton) {
            const button = statusButton;
            const alreadySelected = button.classList.contains('selected');
            button.parentElement.querySelectorAll('.status-button').forEach(btn => btn.classList.remove('selected'));
            if (!alreadySelected) button.classList.add('selected');
            saveData(true);
        }
        const tab = e.target.closest('.weekly-tab');
        if (tab) {
            e.preventDefault();
            const week = tab.dataset.week;
            document.querySelectorAll('.weekly-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.weekly-tab-panel').forEach(p => {
                p.classList.toggle('hidden', p.dataset.weekPanel !== week);
            });
        }
    });

    DOMElements.printBtn.addEventListener('click', () => window.print());
    DOMElements.shareBtn.addEventListener('click', handleShare);
    DOMElements.aiActionBtn.addEventListener('click', handleAIActionPlan);

    DOMElements.modalCloseBtn.addEventListener('click', () => {
        // This needs to be requestCloseModal from modal.js
        closeModal();
    });
    DOMElements.modalOverlay.addEventListener('mousedown', (e) => {
        if (e.target === DOMElements.modalOverlay) {
            // This needs to be requestCloseModal from modal.js
            closeModal();
        }
    });

    if (DOMElements.radialMenuFab) {
        DOMElements.radialMenuFab.addEventListener('click', () => {
            DOMElements.radialMenuContainer.classList.toggle('open');
        });

        DOMElements.radialMenuOverlay.addEventListener('click', () => {
            DOMElements.radialMenuContainer.classList.remove('open');
        });

        const calendarButton = document.getElementById('radial-action-calendar');
        if (calendarButton) {
            calendarButton.addEventListener('click', () => {
                appState.calendar.currentDate = new Date();
                const today = new Date();
                const selectedDateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                renderCalendar();
                renderDayDetails(selectedDateKey);
                document.getElementById('calendar-modal').classList.remove('hidden');
                DOMElements.radialMenuContainer.classList.remove('open');
            });
        }

        const actionPlanButton = document.getElementById('radial-action-plan');
        if (actionPlanButton) {
            actionPlanButton.addEventListener('click', () => {
                handleAIActionPlan();
                DOMElements.radialMenuContainer.classList.remove('open');
            });
        }

        const geminiButton = document.getElementById('radial-action-gemini');
        if (geminiButton) {
            geminiButton.addEventListener('click', () => {
                alert("Gemini AI feature coming soon!");
                DOMElements.radialMenuContainer.classList.remove('open');
            });
        }
    }

    DOMElements.mobileMenuBtn.addEventListener('click', () => {
        DOMElements.appView.classList.toggle('sidebar-open');
    });

    DOMElements.sidebarOverlay.addEventListener('click', () => {
        DOMElements.appView.classList.remove('sidebar-open');
    });

    let touchStartX = 0;
    let touchEndX = 0;
    const swipeThreshold = 50;
    DOMElements.mainContent.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    DOMElements.mainContent.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        if (touchEndX > touchStartX + swipeThreshold) {
            DOMElements.appView.classList.add('sidebar-open');
        }
    });
    DOMElements.sidebar.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    DOMElements.sidebar.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        if (touchEndX < touchStartX - swipeThreshold) {
            DOMElements.appView.classList.remove('sidebar-open');
        }
    });

    const cookieBanner = document.getElementById('cookie-consent-banner');
    const acceptBtn = document.getElementById('cookie-accept-btn');
    const declineBtn = document.getElementById('cookie-decline-btn');
    if (localStorage.getItem('gails_cookie_consent') === null) {
        cookieBanner.classList.remove('hidden');
    }
    acceptBtn.addEventListener('click', () => {
        localStorage.setItem('gails_cookie_consent', 'true');
        cookieBanner.classList.add('hidden');
    });
    declineBtn.addEventListener('click', () => {
        localStorage.setItem('gails_cookie_consent', 'false');
        cookieBanner.classList.add('hidden');
    });
}

// Start the application
document.addEventListener('DOMContentLoaded', main);
