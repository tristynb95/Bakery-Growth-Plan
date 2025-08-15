// ====================================================================
// SECURELY INITIALIZE FIREBASE
// ====================================================================

async function initializeFirebase() {
    try {
        const response = await fetch('/.netlify/functions/config');
        if (!response.ok) {
            throw new Error('Could not fetch Firebase configuration.');
        }
        const firebaseConfig = await response.json();
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
        aiActionBtn: document.getElementById('ai-action-btn'),
        mobileMenuBtn: document.getElementById('mobile-menu-btn'),
        sidebarOverlay: document.getElementById('sidebar-overlay'),
        modalOverlay: document.getElementById('modal-overlay'),
        modalBox: document.getElementById('modal-box'),
        modalTitle: document.getElementById('modal-title'),
        modalContent: document.getElementById('modal-content'),
        modalActionBtn: document.getElementById('modal-action-btn'),
        modalCancelBtn: document.getElementById('modal-cancel-btn'),
        modalCloseBtn: document.getElementById('modal-close-btn'),
        resetView: document.getElementById('reset-view'),
        forgotPasswordBtn: document.getElementById('forgot-password-btn'),
        resetEmail: document.getElementById('reset-email'),
        sendResetBtn: document.getElementById('send-reset-btn'),
        resetMessageContainer: document.getElementById('reset-message-container'),
        backToLoginBtn: document.getElementById('back-to-login-btn'),
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
    const SESSION_DURATION = 30 * 60 * 1000;

    function resetSessionTimeout() {
        clearTimeout(appState.sessionTimeout);
        appState.sessionTimeout = setTimeout(async () => {
            if (appState.currentUser) {
                await saveData(true);
                handleLogout(true);
            }
        }, SESSION_DURATION);
    }

    function setupActivityListeners() {
        window.addEventListener('mousemove', resetSessionTimeout);
        window.addEventListener('mousedown', resetSessionTimeout);
        window.addEventListener('keypress', resetSessionTimeout);
        window.addEventListener('touchmove', resetSessionTimeout);
        window.addEventListener('scroll', resetSessionTimeout, true);
    }

    function clearActivityListeners() {
        window.removeEventListener('mousemove', resetSessionTimeout);
        window.removeEventListener('mousedown', resetSessionTimeout);
        window.removeEventListener('keypress', resetSessionTimeout);
        window.removeEventListener('touchmove', resetSessionTimeout);
        window.removeEventListener('scroll', resetSessionTimeout, true);
        clearTimeout(appState.sessionTimeout);
    }

    function managePlaceholder(editor) {
        if (!editor || !editor.isContentEditable) return;
        if (editor.innerText.trim() === '') {
            editor.classList.add('is-placeholder-showing');
        } else {
            editor.classList.remove('is-placeholder-showing');
        }
    }

    // --- CHARACTER COUNTER ---
    function initializeCharCounters() {
        document.querySelectorAll('div[data-maxlength]').forEach(editor => {
            const wrapper = editor.parentNode.classList.contains('textarea-wrapper') ? editor.parentNode : null;
            if (wrapper) {
                const counter = wrapper.querySelector('.char-counter');
                const updateFn = () => {
                    const maxLength = parseInt(editor.dataset.maxlength, 10);
                    const currentLength = editor.innerText.length;
                    const remaining = maxLength - currentLength;
                    counter.textContent = `${remaining}`;
                    counter.style.color = remaining < 0 ? 'var(--gails-red)' : (remaining < 20 ? '#D97706' : 'var(--gails-text-secondary)');
                };
                editor.addEventListener('input', updateFn);
                editor.addEventListener('focus', () => counter.classList.add('visible'));
                editor.addEventListener('blur', () => counter.classList.remove('visible'));
                updateFn();
                return;
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
        });
    }
   
    // --- HTML TEMPLATES ---

    const templates = {
        vision: {
            html: `<div class="space-y-8">
                        <div class="content-card p-6 md:p-8"><div class="grid grid-cols-1 md:grid-cols-3 gap-6"><div><label for="managerName" class="font-semibold block mb-2">Manager:</label><input type="text" id="managerName" class="form-input" placeholder="e.g., Tristen Bayley"></div><div><label for="bakeryLocation" class="font-semibold block mb-2">Bakery:</label><input type="text" id="bakeryLocation" class="form-input" placeholder="e.g., Marlow"></div><div><label for="quarter" class="font-semibold block mb-2">Quarter:</label><input type="text" id="quarter" class="form-input" placeholder="e.g., Q3 FY26"></div></div></div>
                        <div class="bg-amber-50 border border-amber-200 rounded-xl p-6 shadow-sm"><h3 class="font-bold text-lg text-amber-900 mb-2">Our Mission</h3><p class="text-xl font-semibold text-gray-800">"To make world-class, craft baking a part of every neighbourhood."</p></div>
                        <div class="content-card p-8"><label for="quarterlyTheme" class="block text-lg font-semibold mb-2">This Quarter's Narrative: <i class="bi bi-info-circle info-icon" title="The big, overarching mission for the next 90 days."></i></label><div id="quarterlyTheme" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="e.g., Become the undisputed neighbourhood favourite by mastering our availability." data-maxlength="400"></div></div>
                        <div class="content-card p-8"><h3 class="text-2xl font-bold mb-6">Proposed Monthly Sprints</h3><div class="grid grid-cols-1 md:grid-cols-3 gap-6"><div><label for="month1Goal" class="font-bold block mb-1">Month 1 Goal: <i class="bi bi-info-circle info-icon" title="High-level goal for the first 30-day sprint."></i></label><div id="month1Goal" class="form-input text-sm is-placeholder-showing" contenteditable="true" data-placeholder="e.g., PRODUCT: Master afternoon availability and reduce waste." data-maxlength="300"></div></div><div><label for="month2Goal" class="font-bold block mb-1">Month 2 Goal: <i class="bi bi-info-circle info-icon" title="High-level goal for the second 30-day sprint."></i></label><div id="month2Goal" class="form-input text-sm is-placeholder-showing" contenteditable="true" data-placeholder="e.g., PLACE: Embed new production processes and daily checks." data-maxlength="300"></div></div><div><label for="month3Goal" class="font-bold block mb-1">Month 3 Goal: <i class="bi bi-info-circle info-icon" title="High-level goal for the third 30-day sprint."></i></label><div id="month3Goal" class="form-input text-sm is-placeholder-showing" contenteditable="true" data-placeholder="e.g., PEOPLE: Develop team skills for consistent execution." data-maxlength="300"></div></div></div></div>
                   </div>`,
            requiredFields: ['managerName', 'bakeryLocation', 'quarter', 'quarterlyTheme', 'month1Goal', 'month2Goal', 'month3Goal']
        },
        month: (monthNum) => `<div class="grid grid-cols-1 lg:grid-cols-4 gap-8"><div class="lg:col-span-1 no-print"><nav id="month-${monthNum}-stepper" class="space-y-2"></nav></div><div class="lg:col-span-3"><div id="step-content-container"></div><div class="mt-8 flex justify-between no-print"><button id="prev-step-btn" class="btn btn-secondary">Previous</button><button id="next-step-btn" class="btn btn-primary">Next Step</button></div></div></div>`,
        step: {
            'm1s1': {
                title: "Must-Win Battle",
                requiredFields: ['m1s1_battle'],
                html: `<div class="content-card p-8"><h3 class="text-xl font-bold mb-1 gails-red-text">Step 1: The Must-Win Battle</h3><p class="text-gray-600 mb-4">What is the single most important, measurable outcome for this month?</p><div id="m1s1_battle" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="Example: 'Achieve >80% availability by implementing the production matrix correctly and placing smart orders.'" data-maxlength="500"></div><div class="mt-6"><label class="font-semibold block mb-3 text-gray-700">Monthly Focus Pillar:</label><div class="grid grid-cols-2 md:grid-cols-4 gap-3 pillar-buttons" data-step-key="m1s1"><button class="btn pillar-button" data-pillar="people"><i class="bi bi-people-fill"></i> People</button><button class="btn pillar-button" data-pillar="product"><i class="bi bi-cup-hot-fill"></i> Product</button><button class="btn pillar-button" data-pillar="customer"><i class="bi bi-heart-fill"></i> Customer</button><button class="btn pillar-button" data-pillar="place"><i class="bi bi-shop"></i> Place</button></div></div></div>`
            },
            'm1s2': {
                title: "Levers & Power-Up",
                requiredFields: ['m1s2_levers', 'm1s2_powerup_q', 'm1s2_powerup_a'],
                html: `<div class="content-card p-8"><h3 class="text-xl font-bold mb-1 gails-red-text">Step 2: Key Levers & Team Power-Up</h3><p class="text-gray-600 mb-6">What actions will you take, and how will you involve your team?</p><div class="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label for="m1s2_levers" class="font-semibold block mb-2">My Key Levers (The actions I will own):</label><div id="m1s2_levers" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="1. Review ordering report with daily.&#10;2. Coach the team on the 'why' behind the production matrix." data-maxlength="600"></div></div><div class="space-y-4"><div><label for="m1s2_powerup_q" class="font-semibold block mb-2">Team Power-Up Question:</label><div id="m1s2_powerup_q" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="e.g., 'What is one thing that slows us down before 8am?'" data-maxlength="300"></div></div><div><label for="m1s2_powerup_a" class="font-semibold block mb-2">Our Team's Winning Idea:</label><div id="m1s2_powerup_a" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="e.g., Pre-portioning key ingredients the night before." data-maxlength="300"></div></div></div></div></div>`
            },
            'm1s3': {
                title: "People Growth",
                requiredFields: ['m1s3_people'],
                html: `<div class="content-card p-8"><h3 class="text-xl font-bold mb-1 gails-red-text">Step 3: People Growth</h3><p class="text-gray-600 mb-4">Who will I invest in this month to help us win our battle, and how?</p><div id="m1s3_people" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="Example: 'Sarah: Coach on the production matrix to build her confidence.'" data-maxlength="600"></div></div>`
            },
            'm1s4': {
                title: "Protect the Core",
                requiredFields: ['m1s4_people', 'm1s4_product', 'm1s4_customer', 'm1s4_place'],
                html: `<div class="content-card p-8"><h3 class="text-xl font-bold mb-1 gails-red-text">Step 4: Protect the Core</h3><p class="text-gray-600 mb-6">One key behaviour you will protect for each pillar to ensure standards don't slip.</p><div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <div><label for="m1s4_people" class="font-semibold block mb-2 flex items-center gap-2"><i class="bi bi-people-fill"></i> PEOPLE</label><div id="m1s4_people" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="e.g., Meaningful 1-2-1s with my two keyholders." data-maxlength="300"></div></div>
                    <div><label for="m1s4_product" class="font-semibold block mb-2 flex items-center gap-2"><i class="bi bi-cup-hot-fill"></i> PRODUCT</label><div id="m1s4_product" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="e.g., Daily quality checks of the first bake." data-maxlength="300"></div></div>
                    <div><label for="m1s4_customer" class="font-semibold block mb-2 flex items-center gap-2"><i class="bi bi-heart-fill"></i> CUSTOMER</label><div id="m1s4_customer" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="e.g., Action all customer feedback within 24 hours." data-maxlength="300"></div></div>
                    <div><label for="m1s4_place" class="font-semibold block mb-2 flex items-center gap-2"><i class="bi bi-shop"></i> PLACE</label><div id="m1s4_place" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="e.g., Complete a bakery travel path twice a day." data-maxlength="300"></div></div>
                </div></div>`
            },
            'm1s5': {
                title: "Weekly Check-in",
                requiredFields: [],
                html: `<div class="content-card p-8 weekly-check-in-container"><h3 class="text-xl font-bold mb-1 gails-red-text">Step 5: Weekly Momentum Check</h3><p class="text-gray-600 mb-6">A 5-minute pulse check each Friday to maintain focus and celebrate wins.</p><div class="space-y-6">
                    ${[1,2,3,4].map(w => `<div class="border-t border-gray-200 pt-4"><h4 class="font-bold text-lg mb-4">Week ${w}</h4><div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        <div><label class="font-semibold block mb-2 text-sm">Progress:</label><div class="flex items-center space-x-2 status-buttons" data-week="${w}"><button class="status-button" data-status="on-track">ON TRACK</button><button class="status-button" data-status="issues">ISSUES</button><button class="status-button" data-status="off-track">OFF TRACK</button></div></div>
                        <div><label for="m1s5_w${w}_win" class="font-semibold block mb-2 text-sm">A Win or Learning:</label><div id="m1s5_w${w}_win" class="form-input text-sm is-placeholder-showing" contenteditable="true" data-placeholder="e.g., The team hit 80% availability on Thursday!" data-maxlength="400"></div></div>
                        <div class="md:col-span-2"><label for="m1s5_w${w}_spotlight" class="font-semibold block mb-2 text-sm">Team Member Spotlight:</label><div id="m1s5_w${w}_spotlight" class="form-input text-sm is-placeholder-showing" contenteditable="true" data-placeholder="e.g., Sarah for her excellent attention to detail during the bake." data-maxlength="400"></div></div>
                    </div></div>`).join("")}
                </div></div>`
            },
            'm1s6': {
                title: "End of Month Review",
                requiredFields: ['m1s6_win', 'm1s6_challenge', 'm1s6_next'],
                html: `<div class="content-card p-8 bg-red-50 border border-red-100"><h3 class="text-xl font-bold mb-1 gails-red-text">Step 6: End of Month Review</h3><p class="text-gray-600 mb-6">Reflect on the month to prepare for your conversation with your line manager.</p><div class="space-y-6">
                <div><label for="m1s6_win" class="font-semibold block mb-1 text-lg gails-red-text flex items-center gap-2"><i class="bi bi-trophy-fill"></i> Biggest Win:</label><div id="m1s6_win" class="form-input is-placeholder-showing" contenteditable="true" data-maxlength="500"></div></div>
                <div><label for="m1s6_challenge" class="font-semibold block mb-1 text-lg gails-red-text flex items-center gap-2"><i class="bi bi-lightbulb-fill"></i> Toughest Challenge & What I Learned:</label><div id="m1s6_challenge" class="form-input is-placeholder-showing" contenteditable="true" data-maxlength="500"></div></div>
                <div><label for="m1s6_next" class="font-semibold block mb-1 text-lg gails-red-text flex items-center gap-2"><i class="bi bi-rocket-takeoff-fill"></i> What's Next (Focus for Next Month):</label><div id="m1s6_next" class="form-input is-placeholder-showing" contenteditable="true" data-maxlength="500"></div></div>
                </div></div>`
            },
            'm2s1': {},'m2s2': {},'m2s3': {},'m2s4': {},'m2s5': {},'m2s6': {},
            'm3s1': {},'m3s2': {},'m3s3': {},'m3s4': {},'m3s5': {},'m3s6': {},
            'm3s7': {
                title: "Quarterly Reflection",
                requiredFields: ['m3s7_achievements', 'm3s7_challenges', 'm3s7_narrative', 'm3s7_next_quarter'],
                html: `<div class="content-card p-8" style="background-color: var(--review-blue-bg); border-color: var(--review-blue-border);"><h3 class="text-xl font-bold mb-1" style="color: var(--review-blue-text);">Step 7: Final Quarterly Reflection</h3><p class="text-gray-600 mb-6">A deep dive into the whole quarter's performance to prepare for your review with your line manager.</p><div class="space-y-6">
                <div><label for="m3s7_achievements" class="font-semibold block mb-1 text-lg" style="color: var(--review-blue-text);"><i class="bi bi-award-fill"></i> What were the quarter's biggest achievements?</label><div id="m3s7_achievements" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="Consider financial results, team growth, customer feedback, and process improvements." data-maxlength="800"></div></div>
                <div><label for="m3s7_challenges" class="font-semibold block mb-1 text-lg" style="color: var(--review-blue-text);"><i class="bi bi-bar-chart-line-fill"></i> What were the biggest challenges and what did you learn?</label><div id="m3s7_challenges" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="What didn't go to plan? What were the key takeaways?" data-maxlength="800"></div></div>
                <div><label for="m3s7_narrative" class="font-semibold block mb-1 text-lg" style="color: var(--review-blue-text);"><i class="bi bi-bullseye"></i> How did you perform against the quarterly narrative?</label><div id="m3s7_narrative" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="Review the 'Central Theme' you set in the Vision section. How well did you deliver on it?" data-maxlength="800"></div></div>
                <div><label for="m3s7_next_quarter" class="font-semibold block mb-1 text-lg" style="color: var(--review-blue-text);"><i class="bi bi-forward-fill"></i> What is the primary focus for next quarter?</label><div id="m3s7_next_quarter" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="Based on your learnings, what is the 'must-win battle' for the next 90 days?" data-maxlength="800"></div></div>
                </div></div>`
            }
        }
    };
    
    // --- AUTHENTICATION & APP FLOW ---
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // A user is authenticated. Hide all auth pages and show the loader.
            DOMElements.loginView.classList.add('hidden');
            DOMElements.registerView.classList.add('hidden');
            DOMElements.resetView.classList.add('hidden');
            DOMElements.initialLoadingView.classList.remove('hidden');

            appState.currentUser = user;
            setupActivityListeners();
            resetSessionTimeout();

            const lastPlanId = localStorage.getItem('lastPlanId');
            const lastViewId = localStorage.getItem('lastViewId');

            if (lastPlanId && lastViewId) {
                await restoreLastView(lastPlanId, lastViewId);
            } else {
                DOMElements.dashboardView.classList.remove('hidden');
                await renderDashboard();
            }

            DOMElements.initialLoadingView.classList.add('hidden');

        } else {
            // No user is logged in. 
            appState.currentUser = null;
            appState.planData = {};
            appState.currentPlanId = null;
            clearActivityListeners();

            // Hide all authed views
            DOMElements.initialLoadingView.classList.add('hidden');
            DOMElements.appView.classList.add('hidden');
            DOMElements.dashboardView.classList.add('hidden');
            DOMElements.registerView.classList.add('hidden');
            DOMElements.resetView.classList.add('hidden');
            
            // Show the login view by default
            DOMElements.loginView.classList.remove('hidden');
        }
    });

    const handleLogout = (isTimeout = false) => {
        localStorage.removeItem('lastPlanId');
        localStorage.removeItem('lastViewId');
        
        if (isTimeout) {
            openModal('timeout');
        }
        
        DOMElements.emailInput.value = '';
        DOMElements.passwordInput.value = '';
        auth.signOut();
    };

    // --- DASHBOARD LOGIC ---
    async function restoreLastView(planId, viewId) {
        appState.currentPlanId = planId;
        await loadPlanFromFirestore();
        DOMElements.dashboardView.classList.add('hidden');
        DOMElements.appView.classList.remove('hidden');
        switchView(viewId);
        updateUI();
    }
    
    async function renderDashboard() {
        if (!appState.currentUser) return;

        let plans = [];
        try {
            const plansRef = db.collection('users').doc(appState.currentUser.uid).collection('plans');
            const snapshot = await plansRef.orderBy('lastEdited', 'desc').get();
            plans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) { console.error("Error fetching user plans:", error); }

        let dashboardHTML = `<div class="flex justify-between items-center"><h1 class="text-4xl font-black text-gray-900 font-poppins">Your Growth Plans</h1></div><div class="dashboard-grid">`;

        plans.forEach(plan => {
            const completion = calculatePlanCompletion(plan);
            const editedDate = plan.lastEdited?.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) || 'N/A';
            const planName = plan.planName || 'Untitled Plan';
            dashboardHTML += `
                <div class="plan-card">
                    <div class="plan-card-actions">
                        <button class="plan-action-btn edit-plan-btn" data-plan-id="${plan.id}" data-plan-name="${planName}" title="Edit Name"><i class="bi bi-pencil-square"></i></button>
                        <button class="plan-action-btn delete-plan-btn" data-plan-id="${plan.id}" data-plan-name="${planName}" title="Delete Plan"><i class="bi bi-trash3-fill"></i></button>
                    </div>
                    <div class="plan-card-main" data-plan-id="${plan.id}">
                        <div class="flex-grow">
                            <h3 class="text-xl font-bold font-poppins">${planName}</h3>
                            <p class="text-sm text-gray-500 mt-1">${plan.quarter || 'No quarter set'}</p>
                        </div>
                        <div class="mt-6 pt-4 border-t text-sm space-y-2">
                            <div class="flex justify-between"><span class="font-semibold text-gray-600">Last Edited:</span><span>${editedDate}</span></div>
                            <div class="flex justify-between items-center">
                                <span class="font-semibold text-gray-600">Completion:</span>
                                <div class="progress-circle" data-progress="${completion}">
                                    <div class="progress-circle-inner">${completion}%</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
        });

        dashboardHTML += `<div class="plan-card new-plan-card" id="create-new-plan-btn"><i class="bi bi-plus-circle-dotted text-4xl"></i><p class="mt-2 font-semibold">Create New Plan</p></div></div>`;
        DOMElements.dashboardContent.innerHTML = dashboardHTML;
        
        // Set progress for the new circles
        document.querySelectorAll('.progress-circle').forEach(circle => {
            const progress = circle.dataset.progress;
            circle.style.setProperty('--progress', progress);
        });
    }

    function handleCreateNewPlan() {
        openModal('create');
    }

    function handleEditPlanName(planId, currentName) {
        openModal('edit', { planId, currentName });
    }

    function handleDeletePlan(planId, planName) {
        openModal('delete', { planId, planName });
    }

    async function handleSelectPlan(planId) {
        appState.currentPlanId = planId;
        await loadPlanFromFirestore();
        DOMElements.dashboardView.classList.add('hidden');
        DOMElements.appView.classList.remove('hidden');
        switchView('vision');
        updateUI();
    }

    function handleBackToDashboard() {
        localStorage.removeItem('lastPlanId');
        localStorage.removeItem('lastViewId');
        
        appState.planData = {};
        appState.currentPlanId = null;
        DOMElements.appView.classList.add('hidden');
        DOMElements.dashboardView.classList.remove('hidden');
        renderDashboard();
    }

    // --- DATA HANDLING ---
    async function loadPlanFromFirestore() {
        if (!appState.currentUser || !appState.currentPlanId) {
            appState.planData = {};
            return;
        };
        const docRef = db.collection("users").doc(appState.currentUser.uid).collection("plans").doc(appState.currentPlanId);
        const docSnap = await docRef.get();
        appState.planData = docSnap.exists ? docSnap.data() : {};
    }

    function saveData(forceImmediate = false) {
        if (!appState.currentUser || !appState.currentPlanId) return Promise.resolve();
    
        const fieldsToDelete = {}; // Object to track fields that need to be deleted from Firestore
    
        document.querySelectorAll('#app-view input, #app-view [contenteditable="true"]').forEach(el => {
            if (el.id) {
                if (el.isContentEditable) {
                    appState.planData[el.id] = el.innerHTML;
                } else {
                    appState.planData[el.id] = el.value;
                }
            }
        });
    
        document.querySelectorAll('.pillar-buttons').forEach(group => {
            const stepKey = group.dataset.stepKey;
            const selected = group.querySelector('.selected');
            const dataKey = `${stepKey}_pillar`;
            if (selected) {
                appState.planData[dataKey] = selected.dataset.pillar;
            } else {
                delete appState.planData[dataKey];
                fieldsToDelete[dataKey] = firebase.firestore.FieldValue.delete();
            }
        });
    
        if (appState.currentView.startsWith('month-')) {
            const monthNum = appState.currentView.split('-')[1];
            document.querySelectorAll('.status-buttons').forEach(group => {
                const week = group.dataset.week;
                const selected = group.querySelector('.selected');
                const key = `m${monthNum}s5_w${week}_status`;
                if (selected) {
                    appState.planData[key] = selected.dataset.status;
                } else {
                    delete appState.planData[key]; // Keep local state clean for UI updates
                    fieldsToDelete[key] = firebase.firestore.FieldValue.delete(); // Mark for deletion in Firestore
                }
            });
        }
    
        updateUI();
    
        clearTimeout(appState.saveTimeout);
    
        const saveToFirestore = async () => {
            const docRef = db.collection("users").doc(appState.currentUser.uid).collection("plans").doc(appState.currentPlanId);
    
            // Combine the current state with the fields marked for deletion for the final update
            const dataToSave = {
                ...appState.planData,
                ...fieldsToDelete,
                lastEdited: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await docRef.set(dataToSave, { merge: true });
    
            DOMElements.saveIndicator.classList.remove('opacity-0');
            setTimeout(() => DOMElements.saveIndicator.classList.add('opacity-0'), 2000);
        };
    
        if (forceImmediate) {
            return saveToFirestore();
        } else {
            return new Promise(resolve => {
                appState.saveTimeout = setTimeout(async () => {
                    await saveToFirestore();
                    resolve();
                }, 1000);
            });
        }
    }


    // --- UI & RENDER LOGIC ---
    function updateUI() {
        updateSidebarInfo();
        updateOverallProgress();
        updateSidebarNavStatus();
        if (appState.currentView.startsWith('month-')) {
            renderStepper(appState.monthContext[appState.currentView].currentStep);
        }
    }

    function updateSidebarInfo() {
        const managerName = appState.planData.managerName || '';
        DOMElements.sidebarName.textContent = managerName || 'Your Name';
        DOMElements.sidebarBakery.textContent = appState.planData.bakeryLocation || "Your Bakery";

        if (managerName) {
            const names = managerName.trim().split(' ');
            const firstInitial = names[0] ? names[0][0] : '';
            const lastInitial = names.length > 1 ? names[names.length - 1][0] : '';
            DOMElements.sidebarInitials.textContent = (firstInitial + lastInitial).toUpperCase();
        } else {
            DOMElements.sidebarInitials.textContent = '--';
        }
    }

    function getStepProgress(stepKey, data) {
        const planData = data || appState.planData;
        const isVisionStep = stepKey === 'vision';
        const stepDefinition = isVisionStep ? templates.vision : templates.step[stepKey];
    
        if (!stepDefinition) return { completed: 0, total: 0 };
    
        const isContentEmpty = (htmlContent) => {
            if (!htmlContent) return true;
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;
            return tempDiv.innerText.trim() === '';
        };
    
        let completed = 0;
        let total = 0;
    
        if (!isVisionStep && stepKey.endsWith('s1')) {
            total = 2;
            if (!isContentEmpty(planData[`${stepKey}_battle`])) completed++;
            if (!!planData[`${stepKey}_pillar`]) completed++;
            return { completed, total };
        }
    
        if (!isVisionStep && stepKey.endsWith('s5')) {
            total = 12;
            const monthNum = stepKey.charAt(1);
            for (let w = 1; w <= 4; w++) {
                if (!isContentEmpty(planData[`m${monthNum}s5_w${w}_win`])) completed++;
                if (!isContentEmpty(planData[`m${monthNum}s5_w${w}_spotlight`])) completed++;
                if (!!planData[`m${monthNum}s5_w${w}_status`]) completed++;
            }
            return { completed, total };
        }
        
        const fields = stepDefinition.requiredFields;
        if (!fields || fields.length === 0) {
            return { completed: 0, total: 0 };
        }
    
        total = fields.length;
        completed = fields.filter(fieldId => {
            const value = planData[fieldId];
            if (typeof value === 'string' && (value.includes('<') && value.includes('>'))) {
                 return !isContentEmpty(value);
            }
            return value && value.trim() !== '';
        }).length;
    
        return { completed, total };
    }

    function isStepComplete(stepKey, data) {
        const progress = getStepProgress(stepKey, data);
        return progress.total > 0 && progress.completed === progress.total;
    }

    function isMonthComplete(monthNum) {
        const totalSteps = appState.monthContext[`month-${monthNum}`].totalSteps;
        for (let i = 1; i <= totalSteps; i++) {
            if (!isStepComplete(`m${monthNum}s${i}`)) {
                return false;
            }
        }
        return true;
    }

    function updateSidebarNavStatus() {
        document.querySelector('#nav-vision').classList.toggle('completed', isStepComplete('vision'));
        for (let m = 1; m <= 3; m++) {
            document.querySelector(`#nav-month-${m}`).classList.toggle('completed', isMonthComplete(m));
        }
    }

    function calculatePlanCompletion(planData) {
        const allSteps = ['vision', ...Object.keys(templates.step).filter(k => templates.step[k].title)];
        const completedSteps = allSteps.filter(stepKey => isStepComplete(stepKey, planData)).length;
        const totalSteps = allSteps.length;
        return totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
    }

    function updateOverallProgress() {
        const percentage = calculatePlanCompletion(appState.planData);
        DOMElements.progressPercentage.textContent = `${percentage}%`;
        DOMElements.progressBarFill.style.width = `${percentage}%`;
    }


    function generateTemplates() {
        for (let m = 2; m <= 3; m++) {
            for (let s = 1; s <= 6; s++) {
                const sourceStepKey = `m1s${s}`;
                const targetStepKey = `m${m}s${s}`;
                const sourceStep = templates.step[sourceStepKey];
                if (!sourceStep.html) continue;
                
                let newHtml = sourceStep.html.replace(new RegExp(`id="${sourceStepKey}`, 'g'), `id="${targetStepKey}`);
                newHtml = newHtml.replace(new RegExp(`for="${sourceStepKey}`, 'g'), `for="${targetStepKey}`);
                newHtml = newHtml.replace(new RegExp(`data-step-key="${sourceStepKey}"`, 'g'), `data-step-key="${targetStepKey}"`);

                templates.step[targetStepKey] = {
                    ...sourceStep,
                    html: newHtml,
                    requiredFields: sourceStep.requiredFields.map(field => field.replace(sourceStepKey, targetStepKey))
                };
            }
        }
    }
    
    function populateViewWithData() {
        document.querySelectorAll('#app-view input, #app-view [contenteditable="true"]').forEach(el => {
            if (el.isContentEditable) {
                 el.innerHTML = appState.planData[el.id] || '';
            } else {
                 el.value = appState.planData[el.id] || '';
            }
        });
    
        document.querySelectorAll('.pillar-buttons').forEach(group => {
            const stepKey = group.dataset.stepKey;
            const dataKey = `${stepKey}_pillar`;
            const pillar = appState.planData[dataKey];
            group.querySelectorAll('.selected').forEach(s => s.classList.remove('selected'));
            if (pillar) {
                const buttonToSelect = group.querySelector(`[data-pillar="${pillar}"]`);
                if (buttonToSelect) buttonToSelect.classList.add('selected');
            }
        });
    
        if (appState.currentView.startsWith('month-')) {
            const monthNum = appState.currentView.split('-')[1];
            document.querySelectorAll('.status-buttons').forEach(group => {
                const week = group.dataset.week;
                const key = `m${monthNum}s5_w${week}_status`;
                const status = appState.planData[key];
                group.querySelectorAll('.selected').forEach(s => s.classList.remove('selected'));
                if (status) {
                    const buttonToSelect = group.querySelector(`[data-status="${status}"]`);
                    if (buttonToSelect) buttonToSelect.classList.add('selected');
                }
            });
        }
        document.querySelectorAll('#app-view [contenteditable="true"]').forEach(managePlaceholder);
    }

    function switchView(viewId) {
        DOMElements.mainContent.scrollTop = 0;
        appState.currentView = viewId;
        
        if (appState.currentPlanId) {
            localStorage.setItem('lastPlanId', appState.currentPlanId);
            localStorage.setItem('lastViewId', viewId);
        }

        const titles = {
            vision: { title: 'Bakery Growth Plan', subtitle: appState.planData.planName || 'Your 90-Day Sprint to a Better Bakery.'},
            'month-1': { title: 'Month 1 Sprint', subtitle: 'Lay the foundations for success.'},
            'month-2': { title: 'Month 2 Sprint', subtitle: 'Build momentum and embed processes.'},
            'month-3': { title: 'Month 3 Sprint', subtitle: 'Refine execution and review the quarter.'},
            summary: { title: '90-Day Plan Summary', subtitle: 'A complete overview of your quarterly plan.'}
        };
        DOMElements.headerTitle.textContent = titles[viewId]?.title || 'Growth Plan';
        DOMElements.headerSubtitle.textContent = titles[viewId]?.subtitle || '';

        if (viewId === 'summary') {
            DOMElements.desktopHeaderButtons.classList.remove('hidden');
            DOMElements.printBtn.classList.remove('hidden');
            DOMElements.shareBtn.classList.remove('hidden');
            DOMElements.aiActionBtn.classList.remove('hidden');
            renderSummary();
        } else {
            DOMElements.desktopHeaderButtons.classList.add('hidden');
            DOMElements.printBtn.classList.add('hidden');
            DOMElements.shareBtn.classList.add('hidden');
            DOMElements.aiActionBtn.classList.add('hidden');
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
        const monthKey = appState.currentView;
        appState.monthContext[monthKey].currentStep = stepNum;
        const monthNum = monthKey.split('-')[1];
        const stepKey = `m${monthNum}s${stepNum}`;

        document.getElementById('step-content-container').innerHTML = templates.step[stepKey].html;

        populateViewWithData();
        renderStepper(stepNum);
        initializeCharCounters();
        
        const prevBtn = document.getElementById('prev-step-btn');
        const nextBtn = document.getElementById('next-step-btn');
        
        prevBtn.onclick = () => changeStep(-1);
        nextBtn.onclick = () => changeStep(1);
        
        prevBtn.classList.toggle('hidden', stepNum === 1);
        nextBtn.classList.toggle('hidden', stepNum === appState.monthContext[monthKey].totalSteps);
    }

    function changeStep(direction) {
        const monthKey = appState.currentView;
        let { currentStep, totalSteps } = appState.monthContext[monthKey];
        const newStep = currentStep + direction;
        if (newStep >= 1 && newStep <= totalSteps) {
            renderStep(newStep);
        }
    }

    function renderStepper(activeStep) {
        const monthKey = appState.currentView;
        const { totalSteps } = appState.monthContext[monthKey];
        const monthNum = monthKey.split('-')[1];
        const stepperNav = document.getElementById(`${monthKey}-stepper`);
        if (!stepperNav) return;
        stepperNav.innerHTML = '';
        for (let i = 1; i <= totalSteps; i++) {
            const stepKey = `m${monthNum}s${i}`;
            const isComplete = isStepComplete(stepKey);
            const item = document.createElement('div');
            item.className = 'stepper-item flex items-start cursor-pointer';
            item.dataset.step = i;
            if (isComplete) item.classList.add('completed');
            if (i === activeStep) item.classList.add('active');

            const stepCircleContent = isComplete
                ? `<i class="bi bi-check-lg"></i>`
                : `<span class="step-number">${i}</span>`;
            
            const progress = getStepProgress(stepKey);
            let progressHTML = '';
            if (progress.total > 0) {
                progressHTML = ` <span class="step-progress">(${progress.completed}/${progress.total})</span>`;
            }

            item.innerHTML = `<div class="flex flex-col items-center mr-4"><div class="step-circle w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">${stepCircleContent}</div>${i < totalSteps ? '<div class="step-line w-0.5 h-9"></div>' : ''}</div><div><p class="step-label font-medium text-gray-500">${templates.step[stepKey].title}${progressHTML}</p></div>`;
            item.addEventListener('click', () => renderStep(i));
            stepperNav.appendChild(item);
        }
    }

    function renderSummary() {
        const formData = appState.planData;
        const e = (html) => (html || '...');
    
        const isContentEmpty = (htmlContent) => {
            if (!htmlContent) return true;
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;
            return tempDiv.innerText.trim() === '';
        };
    
        const renderMonthSummary = (monthNum) => {
            let weeklyCheckinHTML = '<ul>';
            let hasLoggedWeeks = false;
    
            for (let w = 1; w <= 4; w++) {
                const status = formData[`m${monthNum}s5_w${w}_status`];
                const win = formData[`m${monthNum}s5_w${w}_win`];
    
                if (status) {
                    hasLoggedWeeks = true;
                    const statusText = status.replace('-', ' ').toUpperCase();
                    const statusBadgeHTML = `<span class="summary-status-badge status-${status}">${statusText}</span>`;
                    const winText = !isContentEmpty(win) ? e(win) : '<em>No win/learning logged.</em>';
    
                    weeklyCheckinHTML += `<li>
                                            <div class="flex justify-between items-center mb-1">
                                                <strong class="font-semibold text-gray-700">Week ${w}</strong>
                                                ${statusBadgeHTML}
                                            </div>
                                            <p class="text-sm text-gray-600">${winText}</p>
                                          </li>`;
                }
            }
    
            if (!hasLoggedWeeks) {
                weeklyCheckinHTML = '<p class="text-sm text-gray-500">No weekly check-ins have been logged for this month.</p>';
            } else {
                weeklyCheckinHTML += '</ul>';
            }
    
            const pillar = formData[`m${monthNum}s1_pillar`];
            const pillarIcons = { 
                'people': '<i class="bi bi-people-fill"></i>', 
                'product': '<i class="bi bi-cup-hot-fill"></i>', 
                'customer': '<i class="bi bi-heart-fill"></i>', 
                'place': '<i class="bi bi-shop"></i>'
            };
            let pillarHTML = '';
            if (pillar) {
                const pillarIcon = pillarIcons[pillar] || '';
                const pillarText = pillar.charAt(0).toUpperCase() + pillar.slice(1);
                pillarHTML = `<div class="flex items-center gap-2 mb-4"><span class="font-semibold text-sm text-gray-500">Focus Pillar:</span><span class="pillar-badge">${pillarIcon} ${pillarText}</span></div>`;
            }
    
            return `
                <div class="content-card p-0 overflow-hidden mt-8">
                    <h2 class="text-2xl font-bold font-poppins p-6 bg-gray-50 border-b">Month ${monthNum} Sprint</h2>
                    <div class="summary-grid">
                        <div class="p-6">
                            ${pillarHTML}
                            <div class="summary-section">
                                <h3 class="summary-heading">Must-Win Battle</h3>
                                <div class="summary-content prose prose-sm">${e(formData[`m${monthNum}s1_battle`])}</div>
                            </div>
                            <div class="summary-section">
                                <h3 class="summary-heading">Key Levers</h3>
                                <div class="summary-content prose prose-sm">${e(formData[`m${monthNum}s2_levers`])}</div>
                            </div>
                            <div class="summary-section">
                                <h3 class="summary-heading">People Growth</h3>
                                <div class="summary-content prose prose-sm">${e(formData[`m${monthNum}s3_people`])}</div>
                            </div>
                        </div>
                        <div class="p-6 bg-gray-50/70 border-l">
                            <div class="summary-section">
                                <h3 class="summary-heading">Protect the Core</h3>
                                <ul class="space-y-3 mt-2">
                                    <li class="flex items-start text-sm"><i class="bi bi-people-fill w-5 text-center mr-3 text-gray-400"></i><span class="flex-1">${e(formData[`m${monthNum}s4_people`])}</span></li>
                                    <li class="flex items-start text-sm"><i class="bi bi-cup-hot-fill w-5 text-center mr-3 text-gray-400"></i><span class="flex-1">${e(formData[`m${monthNum}s4_product`])}</span></li>
                                    <li class="flex items-start text-sm"><i class="bi bi-heart-fill w-5 text-center mr-3 text-gray-400"></i><span class="flex-1">${e(formData[`m${monthNum}s4_customer`])}</span></li>
                                    <li class="flex items-start text-sm"><i class="bi bi-shop w-5 text-center mr-3 text-gray-400"></i><span class="flex-1">${e(formData[`m${monthNum}s4_place`])}</span></li>
                                </ul>
                            </div>
                            <div class="summary-section">
                                <h3 class="summary-heading">Weekly Momentum Wins & Learnings</h3>
                                ${weeklyCheckinHTML}
                            </div>
                            <div class="summary-section">
                                <h3 class="summary-heading">End of Month Review</h3>
                                 <ul class="space-y-3 mt-2">
                                    <li class="flex items-start text-sm"><i class="bi bi-trophy-fill w-5 text-center mr-3 text-gray-400"></i><span class="flex-1"><strong class="font-semibold text-gray-700">Win:</strong> ${e(formData[`m${monthNum}s6_win`])}</span></li>
                                    <li class="flex items-start text-sm"><i class="bi bi-lightbulb-fill w-5 text-center mr-3 text-gray-400"></i><span class="flex-1"><strong class="font-semibold text-gray-700">Challenge:</strong> ${e(formData[`m${monthNum}s6_challenge`])}</span></li>
                                    <li class="flex items-start text-sm"><i class="bi bi-rocket-takeoff-fill w-5 text-center mr-3 text-gray-400"></i><span class="flex-1"><strong class="font-semibold text-gray-700">Next:</strong> ${e(formData[`m${monthNum}s6_next`])}</span></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>`;
        };
    
        DOMElements.contentArea.innerHTML = `
            <div class="space-y-8 summary-content">
                <div class="content-card p-6">
                    <h2 class="text-2xl font-bold font-poppins mb-4">Quarterly Vision & Sprints</h2>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-4 mb-4">
                        <div><h4 class="font-semibold text-sm text-gray-500">Manager</h4><p class="text-gray-800 font-medium">${formData.managerName || '...'}</p></div>
                        <div><h4 class="font-semibold text-sm text-gray-500">Bakery</h4><p class="text-gray-800 font-medium">${formData.bakeryLocation || '...'}</p></div>
                        <div><h4 class="font-semibold text-sm text-gray-500">Quarter</h4><p class="text-gray-800 font-medium">${formData.quarter || '...'}</p></div>
                    </div>
                    <div class="mb-6"><h4 class="font-semibold text-sm text-gray-500">Quarterly Theme</h4><div class="text-gray-800 prose prose-sm">${e(formData.quarterlyTheme)}</div></div>
                    <div><h3 class="text-lg font-bold border-b pb-2 mb-3">Proposed Monthly Sprints</h3><div class="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                        <div><strong class="font-semibold text-gray-600 block">Month 1 Goal:</strong><div class="text-gray-800 mt-1 prose prose-sm">${e(formData.month1Goal)}</div></div>
                        <div><strong class="font-semibold text-gray-600 block">Month 2 Goal:</strong><div class="text-gray-800 mt-1 prose prose-sm">${e(formData.month2Goal)}</div></div>
                        <div><strong class="font-semibold text-gray-600 block">Month 3 Goal:</strong><div class="text-gray-800 mt-1 prose prose-sm">${e(formData.month3Goal)}</div></div>
                    </div></div>
                </div>
                ${renderMonthSummary(1)}
                ${renderMonthSummary(2)}
                ${renderMonthSummary(3)}
                <div class="content-card p-6 mt-8" style="background-color: var(--review-blue-bg); border-color: var(--review-blue-border);">
                    <h2 class="text-2xl font-bold mb-4" style="color: var(--review-blue-text);">Final Quarterly Reflection</h2>
                    <div class="space-y-4">
                        <div><h3 class="font-bold text-lg flex items-center gap-2" style="color: var(--review-blue-text);"><i class="bi bi-award-fill"></i> Biggest Achievements</h3><div class="text-gray-700 mt-1 prose prose-sm">${e(formData.m3s7_achievements)}</div></div>
                        <div><h3 class="font-bold text-lg flex items-center gap-2" style="color: var(--review-blue-text);"><i class="bi bi-bar-chart-line-fill"></i> Biggest Challenges & Learnings</h3><div class="text-gray-700 mt-1 prose prose-sm">${e(formData.m3s7_challenges)}</div></div>
                        <div><h3 class="font-bold text-lg flex items-center gap-2" style="color: var(--review-blue-text);"><i class="bi bi-bullseye"></i> Performance vs Narrative</h3><div class="text-gray-700 mt-1 prose prose-sm">${e(formData.m3s7_narrative)}</div></div>
                        <div><h3 class="font-bold text-lg flex items-center gap-2" style="color: var(--review-blue-text);"><i class="bi bi-forward-fill"></i> Focus For Next Quarter</h3><div class="text-gray-700 mt-1 prose prose-sm">${e(formData.m3s7_next_quarter)}</div></div>
                    </div>
                </div>
            </div>`;
    }

    function summarizePlanForAI(planData) {
        const e = (text) => {
            if (!text) return '';
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = text;
            return tempDiv.innerText.trim();
        };
    
        let summary = `QUARTERLY NARRATIVE: ${e(planData.quarterlyTheme)}\n\n`;
    
        for (let m = 1; m <= 3; m++) {
            summary += `--- MONTH ${m} ---\n`;
            summary += `GOAL: ${e(planData[`month${m}Goal`])}\n`;
            summary += `MUST-WIN BATTLE: ${e(planData[`m${m}s1_battle`])}\n`;
            summary += `KEY LEVERS: ${e(planData[`m${m}s2_levers`])}\n`;
            summary += `PEOPLE GROWTH: ${e(planData[`m${m}s3_people`])}\n`;
            summary += `PROTECT THE CORE (PEOPLE): ${e(planData[`m${m}s4_people`])}\n`;
            summary += `PROTECT THE CORE (PRODUCT): ${e(planData[`m${m}s4_product`])}\n`;
            summary += `PROTECT THE CORE (CUSTOMER): ${e(planData[`m${m}s4_customer`])}\n`;
            summary += `PROTECT THE CORE (PLACE): ${e(planData[`m${m}s4_place`])}\n\n`;
        }
        return summary;
    }

    // --- All other functions (handleShare, openModal, etc.) remain below this point ---

}
