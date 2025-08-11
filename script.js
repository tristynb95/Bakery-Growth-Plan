// ====================================================================
// SECURELY INITIALIZE FIREBASE
// ====================================================================

// This new function securely fetches your secret keys from the Netlify Function.
async function initializeFirebase() {
    try {
        const response = await fetch('/.netlify/functions/config');
        if (!response.ok) {
            throw new Error('Could not fetch Firebase configuration.');
        }
        const firebaseConfig = await response.json();

        // Initialize Firebase with the secure keys
        const app = firebase.initializeApp(firebaseConfig);

        // Run the main app logic only after Firebase is ready
        runApp(app);

    } catch (error) {
        console.error("Failed to initialize Firebase:", error);
        // Display an error message to the user on the page
        document.body.innerHTML = '<div style="text-align: center; padding: 40px; font-family: sans-serif;"><h1>Error</h1><p>Could not load application configuration. Please contact support.</p></div>';
    }
}

// All of the original app code is now wrapped in this function.
function runApp(app) {
    const auth = firebase.auth();
    const db = firebase.firestore();

   // --- GLOBAL STATE & DOM REFERENCES ---
const DOMElements = {
    initialLoadingView: document.getElementById('initial-loading-view'),
    loadingView: document.getElementById('loading-view'),
    creationLoadingView: document.getElementById('creation-loading-view'),
    loginView: document.getElementById('login-view'),
    dashboardView: document.getElementById('dashboard-view'),
    dashboardContent: document.getElementById('dashboard-content'),
    appView: document.getElementById('app-view'),
    mainContent: document.querySelector('#app-view main'),
    sidebar: document.getElementById('sidebar'),
    emailInput: document.getElementById('email'),
    passwordInput: document.getElementById('password'),
    loginBtn: document.getElementById('login-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    dashboardLogoutBtn: document.getElementById('dashboard-logout-btn'),
    backToDashboardBtn: document.getElementById('back-to-dashboard-btn'),
    authError: document.getElementById('auth-error'),
    sidebarName: document.getElementById('sidebar-name'),
    sidebarBakery: document.getElementById('sidebar-bakery'),
    sidebarInitials: document.getElementById('sidebar-initials'),
    contentArea: document.getElementById('content-area'),
    mainNav: document.getElementById('main-nav'),
    printBtn: document.getElementById('print-btn'),
    shareBtn: document.getElementById('share-btn'),
    saveIndicator: document.getElementById('save-indicator'),
    headerTitle: document.getElementById('header-title'),
    headerSubtitle: document.getElementById('header-subtitle'),
    progressBarFill: document.getElementById('progress-bar-fill'),
    progressPercentage: document.getElementById('progress-percentage'),
    desktopHeaderButtons: document.getElementById('desktop-header-buttons'),
    // Mobile Menu
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    // Modal elements
    modalOverlay: document.getElementById('modal-overlay'),
    modalBox: document.getElementById('modal-box'),
    modalTitle: document.getElementById('modal-title'),
    modalContent: document.getElementById('modal-content'),
    modalActionBtn: document.getElementById('modal-action-btn'),
    modalCancelBtn: document.getElementById('modal-cancel-btn'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    // Password Reset elements
    resetView: document.getElementById('reset-view'),
    forgotPasswordBtn: document.getElementById('forgot-password-btn'),
    resetEmail: document.getElementById('reset-email'),
    sendResetBtn: document.getElementById('send-reset-btn'),
    resetMessageContainer: document.getElementById('reset-message-container'),
    backToLoginBtn: document.getElementById('back-to-login-btn'),
    // Registration elements
    registerView: document.getElementById('register-view'),
    showRegisterViewBtn: document.getElementById('show-register-view-btn'),
    backToLoginFromRegisterBtn: document.getElementById('back-to-login-from-register-btn'),
    registerEmail: document.getElementById('register-email'),
    registerPassword: document.getElementById('register-password'),
    termsAgreeCheckbox: document.getElementById('terms-agree'),
    createAccountBtn: document.getElementById('create-account-btn'),
    registerError: document.getElementById('register-error'),
};

    const appState = {
        planData: {},
        currentUser: null,
        currentPlanId: null,
        currentView: 'vision',
        monthContext: {
            'month-1': { currentStep: 1, totalSteps: 6 },
            'month-2': { currentStep: 1, totalSteps: 6 },
            'month-3': { currentStep: 1, totalSteps: 7 },
        },
        saveTimeout: null,
        sessionTimeout: null,
    };

    // --- SESSION TIMEOUT ---
    const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes

    function resetSessionTimeout() {
        clearTimeout(appState.sessionTimeout);
        appState.sessionTimeout = setTimeout(async () => {
            if (appState.currentUser) {
                await saveData(true); // Force immediate save
                handleLogout(true);
            }
        }, SESSION_DURATION);
    }

    function setupActivityListeners() {
        ['mousemove', 'mousedown', 'keypress', 'touchmove', 'scroll'].forEach(event => 
            window.addEventListener(event, resetSessionTimeout, { passive: true, capture: true })
        );
    }

    function clearActivityListeners() {
         ['mousemove', 'mousedown', 'keypress', 'touchmove', 'scroll'].forEach(event => 
            window.removeEventListener(event, resetSessionTimeout, { capture: true })
        );
        clearTimeout(appState.sessionTimeout);
    }

    // --- CHARACTER COUNTER ---
    function initializeCharCounters() {
        // Implementation remains the same...
        document.querySelectorAll('textarea[maxlength]').forEach(textarea => {
            if (textarea.parentNode.classList.contains('textarea-wrapper')) {
                const wrapper = textarea.parentNode;
                const counter = wrapper.querySelector('.char-counter');
                const updateFn = () => {
                    const remaining = textarea.maxLength - textarea.value.length;
                    counter.textContent = `${remaining}`;
                    if (remaining < 0) counter.style.color = 'var(--gails-red)';
                    else if (remaining < 20) counter.style.color = '#D97706';
                    else counter.style.color = 'var(--gails-text-secondary)';
                };
                textarea.addEventListener('input', updateFn);
                updateFn();
                return;
            }
            const wrapper = document.createElement('div');
            wrapper.className = 'textarea-wrapper';
            textarea.parentNode.insertBefore(wrapper, textarea);
            wrapper.appendChild(textarea);
            const counter = document.createElement('div');
            counter.className = 'char-counter';
            wrapper.appendChild(counter);
            const updateCounter = () => {
                const remaining = textarea.maxLength - textarea.value.length;
                counter.textContent = `${remaining}`;
                if (remaining < 0) counter.style.color = 'var(--gails-red)';
                else if (remaining < 20) counter.style.color = '#D97706';
                else counter.style.color = 'var(--gails-text-secondary)';
            };
            updateCounter();
            textarea.addEventListener('input', updateCounter);
        });
    }
    
    // --- HTML TEMPLATES ---
    const templates = {
        // Templates remain the same...
        vision: {
            html: `<div class="space-y-8">...</div>`,
            requiredFields: ['managerName', 'bakeryLocation', 'quarter', 'quarterlyTheme', 'month1Goal', 'month2Goal', 'month3Goal']
        },
        month: (monthNum) => `<div class="grid grid-cols-1 lg:grid-cols-4 gap-8">...</div>`,
        step: { /* All step templates remain unchanged */ }
    };


    // --- AUTHENTICATION & APP FLOW ---
    auth.onAuthStateChanged(async (user) => {
        // Logic remains the same...
    });

    const handleLogout = (isTimeout = false) => {
        localStorage.removeItem('lastPlanId');
        localStorage.removeItem('lastViewId');
        if (isTimeout) openModal('timeout');
        DOMElements.emailInput.value = '';
        DOMElements.passwordInput.value = '';
        auth.signOut();
    };

    // --- DASHBOARD LOGIC ---
    async function restoreLastView(planId, viewId) {
        // Logic remains the same...
    }
    
    async function renderDashboard() {
        // Logic remains the same...
    }
    
    // --- DATA HANDLING ---
    async function loadPlanFromFirestore() {
        // Logic remains the same...
    }

    function saveData(forceImmediate = false) {
        if (!appState.currentUser || !appState.currentPlanId) return Promise.resolve();
    
        document.querySelectorAll('#app-view input, #app-view textarea').forEach(el => {
            if(el.id) appState.planData[el.id] = el.value;
        });
    
        if (appState.currentView.startsWith('month-')) {
            const monthNum = appState.currentView.split('-')[1];
            document.querySelectorAll('.status-buttons').forEach(group => {
                const week = group.dataset.week;
                const selected = group.querySelector('.selected');
                const key = `m${monthNum}s5_w${week}_status`;
                if (selected) { appState.planData[key] = selected.dataset.status; }
                else { delete appState.planData[key]; }
            });
        }
    
        updateUI();
    
        clearTimeout(appState.saveTimeout);
    
        const saveToFirestore = async () => {
            const docRef = db.collection("users").doc(appState.currentUser.uid).collection("plans").doc(appState.currentPlanId);
            try {
                await docRef.set({ ...appState.planData, lastEdited: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
                // **ENHANCED SAVE INDICATOR**
                DOMElements.saveIndicator.classList.add('visible');
                setTimeout(() => DOMElements.saveIndicator.classList.remove('visible'), 2500);
            } catch (error) {
                console.error("Error saving to Firestore:", error);
            }
        };
    
        if (forceImmediate) {
            return saveToFirestore();
        } else {
            return new Promise(resolve => {
                appState.saveTimeout = setTimeout(async () => {
                    await saveToFirestore();
                    resolve();
                }, 1200); // Slightly longer delay
            });
        }
    }


    // --- UI & RENDER LOGIC ---
    function updateUI() {
        // Logic remains the same...
    }

    // **SEAMLESS SAVING IMPLEMENTATION**
    async function switchView(viewId) {
        // Force an immediate save of any pending changes before switching views
        if (appState.currentPlanId) {
            await saveData(true);
        }

        appState.currentView = viewId;
        
        if (appState.currentPlanId) {
            localStorage.setItem('lastPlanId', appState.currentPlanId);
            localStorage.setItem('lastViewId', viewId);
        }

        // Rest of the function remains the same...
        const titles = { /* ... */ };
        DOMElements.headerTitle.textContent = titles[viewId]?.title || 'Growth Plan';
        DOMElements.headerSubtitle.textContent = titles[viewId]?.subtitle || '';

        if (viewId === 'summary') {
            DOMElements.desktopHeaderButtons.classList.remove('hidden');
            DOMElements.printBtn.classList.remove('hidden');
            DOMElements.shareBtn.classList.remove('hidden');
            renderSummary();
        } else {
            DOMElements.desktopHeaderButtons.classList.add('hidden');
            DOMElements.printBtn.classList.add('hidden');
            DOMElements.shareBtn.classList.add('hidden');
            const monthNum = viewId.startsWith('month-') ? viewId.split('-')[1] : null;
            DOMElements.contentArea.innerHTML = monthNum ? templates.month(monthNum) : templates.vision.html;

            if (monthNum) {
                renderStep(appState.monthContext[viewId].currentStep);
            } else {
                populateViewWithData();
            }
        }
        document.querySelectorAll('#main-nav a').forEach(a => a.classList.remove('active'));
        document.querySelector(`#nav-${viewId}`)?.classList.add('active');
        
        DOMElements.appView.classList.remove('sidebar-open');
        initializeCharCounters();
    }
    
    function renderStep(stepNum) {
        // Logic remains the same...
    }

    function changeStep(direction) {
       // Logic remains the same...
    }

    function renderStepper(activeStep) {
        // Logic remains the same...
    }

    function renderSummary() {
        // Logic remains the same...
    }
    
    // --- Modal Management ---
    // **ENHANCED CREATION LOADER**
    function openModal(type, context = {}) {
        // ... (rest of the function)
        switch (type) {
            case 'create':
                // ...
                break;
            case 'edit':
                // ...
                break;
            // ... (other cases)
            case 'creating': // New modal type for the loader
                DOMElements.modalTitle.textContent = "Creating Your New Plan";
                DOMElements.modalContent.innerHTML = `
                    <div class="space-y-4 py-4">
                        <div id="loader-step-1" class="creation-loader-step" style="animation-delay: 0.1s;">
                            <div class="icon"><div class="spinner"></div></div>
                            <span>Structuring plan...</span>
                        </div>
                        <div id="loader-step-2" class="creation-loader-step" style="animation-delay: 0.8s;">
                            <div class="icon"></div>
                            <span>Saving to cloud...</span>
                        </div>
                        <div id="loader-step-3" class="creation-loader-step" style="animation-delay: 1.5s;">
                            <div class="icon"></div>
                            <span>All set! Opening now...</span>
                        </div>
                    </div>
                `;
                DOMElements.modalActionBtn.style.display = 'none';
                DOMElements.modalCancelBtn.style.display = 'none';
                break;
        }
        DOMElements.modalOverlay.classList.remove('hidden');
        // ... (rest of the function)
    }

    async function handleModalAction() {
        const type = DOMElements.modalBox.dataset.type;
        // ... (rest of the function)

        switch(type) {
            case 'create':
                const newPlanNameInput = document.getElementById('newPlanName');
                const newPlanName = newPlanNameInput.value.trim();
                // ... (validation logic remains the same)
                
                closeModal();
                openModal('creating'); // Open the new loading modal

                try {
                    const plansRef = db.collection('users').doc(appState.currentUser.uid).collection('plans');

                    // Simulate loader steps
                    const step1 = document.getElementById('loader-step-1');
                    const step2 = document.getElementById('loader-step-2');
                    const step3 = document.getElementById('loader-step-3');

                    // Step 1 is already spinning
                    await new Promise(res => setTimeout(res, 700));
                    step1.querySelector('.icon').innerHTML = '<div class="checkmark">✓</div>';
                    step2.querySelector('.icon').innerHTML = '<div class="spinner"></div>';
                    
                    // Actual creation
                    const newPlan = await plansRef.add({ 
                        planName: newPlanName, 
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(), 
                        lastEdited: firebase.firestore.FieldValue.serverTimestamp(), 
                        managerName: '' 
                    });

                    // Step 2 completes
                    await new Promise(res => setTimeout(res, 700));
                    step2.querySelector('.icon').innerHTML = '<div class="checkmark">✓</div>';
                    step3.querySelector('.icon').innerHTML = '<div class="spinner"></div>';
                    
                    // Step 3 completes
                    await new Promise(res => setTimeout(res, 600));
                    step3.querySelector('.icon').innerHTML = '<div class="checkmark">✓</div>';

                    // Final delay before closing and opening the plan
                    await new Promise(res => setTimeout(res, 500));
                    closeModal();
                    await handleSelectPlan(newPlan.id);

                } catch (error) {
                    console.error("Error creating new plan:", error);
                    closeModal(); // Close the loader on error
                }
                break;

            case 'edit':
                // Logic remains the same...
                break;

            case 'delete':
                // Logic remains the same...
                break;
        }
    }


    // --- EVENT LISTENERS ---
    // All other event listeners remain the same.

    // --- INITIALIZE APP ---
    generateTemplates(); // This can remain as is.
} 

// This ensures we don't run any code until the whole page is ready.
document.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();
});
