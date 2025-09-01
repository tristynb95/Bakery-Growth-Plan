// js/ui.js

// Dependencies that will be passed in from main.js
let db, currentUser, appState, generateAiActionPlan, saveData, handleSelectPlan;

// --- DOM Element References ---
const DOMElements = {
    // Modals
    modalOverlay: document.getElementById('modal-overlay'),
    modalBox: document.getElementById('modal-box'),
    modalTitle: document.getElementById('modal-title'),
    modalContent: document.getElementById('modal-content'),
    modalActionBtn: document.getElementById('modal-action-btn'),
    modalCancelBtn: document.getElementById('modal-cancel-btn'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    // Mobile Sidebar & Menu
    appView: document.getElementById('app-view'),
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    sidebar: document.getElementById('sidebar'),
    mainContent: document.querySelector('#app-view main'),
    // Radial Menu
    radialMenuContainer: document.getElementById('radial-menu-container'),
    radialMenuFab: document.getElementById('radial-menu-fab'),
    radialMenuOverlay: document.getElementById('radial-menu-overlay'),
    // Other UI
    saveIndicator: document.getElementById('save-indicator'),
    creationLoadingView: document.getElementById('creation-loading-view'),
    cookieBanner: document.getElementById('cookie-consent-banner'),
    acceptBtn: document.getElementById('cookie-accept-btn'),
    declineBtn: document.getElementById('cookie-decline-btn'),
};

// --- Private Helper Functions ---

function managePlaceholder(editor) {
    if (!editor || !editor.isContentEditable) return;
    if (editor.innerText.trim() === '') {
        editor.classList.add('is-placeholder-showing');
    } else {
        editor.classList.remove('is-placeholder-showing');
    }
}

async function handleModalAction() {
    const type = DOMElements.modalBox.dataset.type;
    const planId = DOMElements.modalBox.dataset.planId;

    switch(type) {
        case 'create':
            const newPlanNameInput = document.getElementById('newPlanName');
            const newPlanName = newPlanNameInput.value.trim();
            if (!newPlanName) {
                alert('Please enter a plan name.');
                return;
            }
            DOMElements.creationLoadingView.classList.remove('hidden');
            closeModal();
            try {
                const plansRef = db.collection('users').doc(appState.currentUser.uid).collection('plans');
                const newPlan = await plansRef.add({
                    planName: newPlanName,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastEdited: firebase.firestore.FieldValue.serverTimestamp(),
                });
                if (handleSelectPlan) {
                    handleSelectPlan(newPlan.id);
                }
            } catch (error) {
                console.error("Error creating new plan:", error);
            } finally {
                DOMElements.creationLoadingView.classList.add('hidden');
            }
            break;

        case 'edit':
            const newName = document.getElementById('editPlanName').value;
            if (newName && newName.trim() !== '') {
                try {
                    await db.collection('users').doc(appState.currentUser.uid).collection('plans').doc(planId).update({ planName: newName });
                    document.dispatchEvent(new CustomEvent('-rerender-dashboard'));
                } catch (error) { console.error("Error updating plan name:", error); }
            }
            closeModal();
            break;

        case 'delete':
            try {
                await db.collection('users').doc(appState.currentUser.uid).collection('plans').doc(planId).delete();
                document.dispatchEvent(new CustomEvent('rerender-dashboard'));
            } catch (error) { console.error("Error deleting plan:", error); }
            closeModal();
            break;

        case 'timeout':
            closeModal();
            break;
    }
}

// --- Public (Exported) Functions ---

export function initializeCharCounters() {
    document.querySelectorAll('div[data-maxlength]').forEach(editor => {
        if (editor.parentNode.classList.contains('textarea-wrapper')) {
            return; // Already initialized
        }
        const newWrapper = document.createElement('div');
        newWrapper.className = 'textarea-wrapper';
        editor.parentNode.insertBefore(newWrapper, editor);
        newWrapper.appendChild(editor);

        const newCounter = document.createElement('div');
        newCounter.className = 'char-counter';
        newWrapper.appendChild(newCounter);

        const updateCounter = () => {
            const maxLength = parseInt(editor.dataset.maxlength, 10);
            const currentLength = editor.innerText.length;
            const remaining = maxLength - currentLength;
            newCounter.textContent = `${remaining}`;
            newCounter.style.color = remaining < 0 ? 'var(--gails-red)' : (remaining < 20 ? '#D97706' : 'var(--gails-text-secondary)');
        };
        updateCounter();
        editor.addEventListener('input', updateCounter);
        editor.addEventListener('focus', () => newCounter.classList.add('visible'));
        editor.addEventListener('blur', () => newCounter.classList.remove('visible'));
        editor.addEventListener('input', () => managePlaceholder(editor));
    });
}

export function openModal(type, context = {}) {
    const { planId, currentName, planName } = context;
    DOMElements.modalBox.dataset.type = type;
    DOMElements.modalBox.dataset.planId = planId;

    // Reset buttons
    DOMElements.modalActionBtn.style.display = 'inline-flex';
    DOMElements.modalCancelBtn.textContent = 'Cancel';
    DOMElements.modalActionBtn.className = 'btn btn-primary';

    switch (type) {
        case 'create':
            DOMElements.modalTitle.textContent = "Create New Plan";
            DOMElements.modalContent.innerHTML = `<label for="newPlanName" class="font-semibold block mb-2">Plan Name:</label><input type="text" id="newPlanName" class="form-input" placeholder="e.g., Q4 2025 Focus" value="New Plan ${new Date().toLocaleDateString('en-GB')}">`;
            DOMElements.modalActionBtn.textContent = "Create Plan";
            break;
        case 'edit':
            DOMElements.modalTitle.textContent = "Edit Plan Name";
            DOMElements.modalContent.innerHTML = `<label for="editPlanName" class="font-semibold block mb-2">Plan Name:</label><input type="text" id="editPlanName" class="form-input" value="${currentName}">`;
            DOMElements.modalActionBtn.textContent = "Save Changes";
            break;
        case 'delete':
            DOMElements.modalTitle.textContent = "Confirm Deletion";
            DOMElements.modalContent.innerHTML = `<p>Are you sure you want to permanently delete the plan: <strong class="font-bold">${planName}</strong>?</p><p class="mt-2 text-sm text-red-700 bg-red-100 p-3 rounded-lg">This action is final and cannot be undone.</p>`;
            DOMElements.modalActionBtn.textContent = "Confirm Delete";
            DOMElements.modalActionBtn.className = 'btn btn-primary bg-red-600 hover:bg-red-700';
            break;
        case 'timeout':
            DOMElements.modalTitle.textContent = "Session Ended";
            DOMElements.modalContent.innerHTML = `<p>Your work has been saved automatically. For your security, please sign in to continue.</p>`;
            DOMElements.modalActionBtn.textContent = "Continue";
            DOMElements.modalCancelBtn.style.display = 'none';
            break;
        // ... other modal cases like 'sharing', 'aiActionPlan', etc. can be added here
    }
    DOMElements.modalOverlay.classList.remove('hidden');
}

export function closeModal() {
    DOMElements.modalOverlay.classList.add('hidden');
}

// --- Main Initializer ---

export function initializeUI(database, state, apiFunction, saveDataFunction, planSelectFunction) {
    // Connect to other parts of the app
    db = database;
    appState = state;
    generateAiActionPlan = apiFunction;
    saveData = saveDataFunction;
    handleSelectPlan = planSelectFunction;

    // --- Modal Event Listeners ---
    DOMElements.modalCloseBtn.addEventListener('click', closeModal);
    DOMElements.modalOverlay.addEventListener('mousedown', (e) => {
        if (e.target === DOMElements.modalOverlay) {
            closeModal();
        }
    });
    DOMElements.modalActionBtn.addEventListener('click', handleModalAction);
    DOMElements.modalCancelBtn.addEventListener('click', closeModal);

    // --- Mobile Sidebar & Swipe ---
    DOMElements.mobileMenuBtn.addEventListener('click', () => DOMElements.appView.classList.toggle('sidebar-open'));
    DOMElements.sidebarOverlay.addEventListener('click', () => DOMElements.appView.classList.remove('sidebar-open'));

    // --- Radial Menu ---
    if (DOMElements.radialMenuFab) {
        DOMElements.radialMenuFab.addEventListener('click', () => DOMElements.radialMenuContainer.classList.toggle('open'));
        DOMElements.radialMenuOverlay.addEventListener('click', () => DOMElements.radialMenuContainer.classList.remove('open'));
    }

    // --- Cookie Banner ---
    if (localStorage.getItem('gails_cookie_consent') === null) {
        DOMElements.cookieBanner.classList.remove('hidden');
    }
    DOMElements.acceptBtn.addEventListener('click', () => {
        localStorage.setItem('gails_cookie_consent', 'true');
        DOMElements.cookieBanner.classList.add('hidden');
    });
    DOMElements.declineBtn.addEventListener('click', () => {
        localStorage.setItem('gails_cookie_consent', 'false');
        DOMElements.cookieBanner.classList.add('hidden');
    });
}
