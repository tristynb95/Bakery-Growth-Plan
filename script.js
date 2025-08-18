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
            'month-1': { totalSteps: 7 },
            'month-2': { totalSteps: 7 },
            'month-3': { totalSteps: 8 },
        },
        saveTimeout: null,
        sessionTimeout: null,
        planUnsubscribe: null,
    };
    
    let undoStack = [];
    let redoStack = [];

    // --- SESSION TIMEOUT ---
    const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes

    function resetSessionTimeout() {
        clearTimeout(appState.sessionTimeout);
        localStorage.setItem('lastActivity', new Date().getTime());
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
            if (editor.parentNode.classList.contains('textarea-wrapper')) {
                const wrapper = editor.parentNode;
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
        month: (monthNum) => `
            <div class="space-y-8">
                <div class="content-card p-6 md:p-8">
                    <h2 class="text-2xl font-bold font-poppins mb-1">Your Foundation Plan</h2>
                    <p class="text-gray-600 mb-6">Complete these sections at the start of your month to set a clear direction.</p>
                    <div class="space-y-6">
                        <div>
                            <label class="font-semibold text-lg block mb-2 text-gray-800">Must-Win Battle:</label>
                            <div id="m${monthNum}s1_battle" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="Example: 'Achieve >80% availability by implementing the production matrix correctly...'" data-maxlength="500"></div>
                            <div class="mt-4">
                                <label class="font-semibold block mb-3 text-sm text-gray-600">Monthly Focus Pillar:</label>
                                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 pillar-buttons" data-step-key="m${monthNum}s1">
                                    <button class="btn pillar-button" data-pillar="people"><i class="bi bi-people-fill"></i> People</button>
                                    <button class="btn pillar-button" data-pillar="product"><i class="bi bi-cup-hot-fill"></i> Product</button>
                                    <button class="btn pillar-button" data-pillar="customer"><i class="bi bi-heart-fill"></i> Customer</button>
                                    <button class="btn pillar-button" data-pillar="place"><i class="bi bi-shop"></i> Place</button>
                                </div>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                            <div class="flex flex-col">
                                <label for="m${monthNum}s2_levers" class="font-semibold text-lg block mb-2 text-gray-800">My Key Levers:</label>
                                <div id="m${monthNum}s2_levers" class="form-input is-placeholder-showing flex-grow key-levers-input" contenteditable="true" data-placeholder="1. Review ordering report daily.&#10;2. Coach the team on the 'why'..." data-maxlength="600"></div>
                            </div>
                            <div class="space-y-4">
                                <div>
                                    <label for="m${monthNum}s2_powerup_q" class="font-semibold text-lg block mb-2 text-gray-800">Team Power-Up Question:</label>
                                    <div id="m${monthNum}s2_powerup_q" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="e.g., 'What is one thing that slows us down before 8am?'" data-maxlength="300"></div>
                                </div>
                                <div>
                                    <label for="m${monthNum}s2_powerup_a" class="font-semibold text-lg block mb-2 text-gray-800">Our Team's Winning Idea:</label>
                                    <div id="m${monthNum}s2_powerup_a" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="e.g., Pre-portioning key ingredients the night before." data-maxlength="300"></div>
                                </div>
                            </div>
                        </div>
                        <div class="pt-6 border-t">
                            <label class="font-semibold text-lg block mb-2 text-gray-800">People Growth:</label>
                            <div id="m${monthNum}s3_people" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="Example: 'Sarah: Coach on the production matrix to build her confidence.'" data-maxlength="600"></div>
                        </div>
                        <div class="pt-6 border-t">
                            <label class="font-semibold text-lg block mb-2 text-gray-800">Protect the Core:</label>
                            <p class="text-gray-600 mb-4 -mt-2 text-sm">One key behaviour for each pillar to ensure standards don't slip.</p>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                <div><label for="m${monthNum}s4_people" class="font-semibold block mb-2 flex items-center gap-2"><i class="bi bi-people-fill"></i> PEOPLE</label><div id="m${monthNum}s4_people" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="e.g., Meaningful 1-2-1s with my two keyholders." data-maxlength="300"></div></div>
                                <div><label for="m${monthNum}s4_product" class="font-semibold block mb-2 flex items-center gap-2"><i class="bi bi-cup-hot-fill"></i> PRODUCT</label><div id="m${monthNum}s4_product" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="e.g., Daily quality checks of the first bake." data-maxlength="300"></div></div>
                                <div><label for="m${monthNum}s4_customer" class="font-semibold block mb-2 flex items-center gap-2"><i class="bi bi-heart-fill"></i> CUSTOMER</label><div id="m${monthNum}s4_customer" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="e.g., Action all customer feedback within 24 hours." data-maxlength="300"></div></div>
                                <div><label for="m${monthNum}s4_place" class="font-semibold block mb-2 flex items-center gap-2"><i class="bi bi-shop"></i> PLACE</label><div id="m${monthNum}s4_place" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="e.g., Complete a bakery travel path twice a day." data-maxlength="300"></div></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="content-card p-6 md:p-8">
                    <h2 class="text-2xl font-bold font-poppins mb-1">Weekly Momentum</h2>
                    <p class="text-gray-600 mb-6">Return here each week to log your progress, celebrate wins, and spotlight your team.</p>
                    
                    <div class="mb-6 border-b border-gray-200">
<nav id="weekly-tabs" class="flex -mb-px space-x-6" aria-label="Tabs">
    ${[1, 2, 3, 4].map(w => `
        <a href="#" class="weekly-tab ${w === 1 ? 'active' : ''} flex items-center" data-week="${w}">
            <span>Week ${w}</span>
            <i class="bi bi-check-circle-fill week-complete-icon ml-2 hidden"></i>
        </a>
    `).join('')}
</nav>
</div>

                    <div id="weekly-tab-content">
                        ${[1, 2, 3, 4].map(w => `
                            <div class="weekly-tab-panel ${w !== 1 ? 'hidden' : ''}" data-week-panel="${w}">
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                                    <div class="md:col-span-2">
                                        <label class="font-semibold block mb-3 text-gray-700">Progress:</label>
                                        <div class="flex items-center space-x-2 status-buttons" data-week="${w}">
                                            <button class="status-button" data-status="on-track">ON TRACK</button>
                                            <button class="status-button" data-status="issues">ISSUES</button>
                                            <button class="status-button" data-status="off-track">OFF TRACK</button>
                                        </div>
                                    </div>
                                    <div>
                                        <label for="m${monthNum}s5_w${w}_win" class="font-semibold block mb-2 text-gray-700">A Win or Learning:</label>
                                        <div id="m${monthNum}s5_w${w}_win" class="form-input text-sm is-placeholder-showing weekly-check-in-input" contenteditable="true" data-placeholder="e.g., The team hit 80% availability on Thursday!" data-maxlength="400"></div>
                                    </div>
                                    <div>
                                        <label for="m${monthNum}s5_w${w}_spotlight" class="font-semibold block mb-2 text-gray-700">Team Member Spotlight:</label>
                                        <div id="m${monthNum}s5_w${w}_spotlight" class="form-input text-sm is-placeholder-showing weekly-check-in-input" contenteditable="true" data-placeholder="e.g., Sarah for her excellent attention to detail during the bake." data-maxlength="400"></div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="content-card p-6 md:p-8 bg-red-50 border border-red-100">
                    <h2 class="text-2xl font-bold font-poppins mb-1">End of Month Review</h2>
                    <p class="text-gray-600 mb-6">At the end of the month, reflect on your performance to prepare for your line manager conversation.</p>
                    <div class="space-y-6">
                        <div><label for="m${monthNum}s6_win" class="font-semibold block mb-1 text-lg gails-red-text flex items-center gap-2"><i class="bi bi-trophy-fill"></i> Biggest Win:</label><div id="m${monthNum}s6_win" class="form-input is-placeholder-showing" contenteditable="true" data-maxlength="500"></div></div>
                        <div><label for="m${monthNum}s6_challenge" class="font-semibold block mb-1 text-lg gails-red-text flex items-center gap-2"><i class="bi bi-lightbulb-fill"></i> Toughest Challenge & What I Learned:</label><div id="m${monthNum}s6_challenge" class="form-input is-placeholder-showing" contenteditable="true" data-maxlength="500"></div></div>
                        <div><label for="m${monthNum}s6_next" class="font-semibold block mb-1 text-lg gails-red-text flex items-center gap-2"><i class="bi bi-rocket-takeoff-fill"></i> Focus for Next Month:</label><div id="m${monthNum}s6_next" class="form-input is-placeholder-showing" contenteditable="true" data-maxlength="500"></div></div>
                    </div>
                </div>
                
                ${monthNum == 3 ? `
                <div class="content-card p-8" style="background-color: var(--review-blue-bg); border-color: var(--review-blue-border);">
                    <h2 class="text-2xl font-bold font-poppins mb-1" style="color: var(--review-blue-text);">Final Quarterly Reflection</h2>
                    <p class="text-gray-600 mb-6">A deep dive into the quarter's performance for your review.</p>
                    <div class="space-y-6">
                        <div><label for="m3s7_achievements" class="font-semibold block mb-1 text-lg" style="color: var(--review-blue-text);"><i class="bi bi-award-fill"></i> Quarter's Biggest Achievements:</label><div id="m3s7_achievements" class="form-input is-placeholder-showing" contenteditable="true" data-maxlength="800"></div></div>
                        <div><label for="m3s7_challenges" class="font-semibold block mb-1 text-lg" style="color: var(--review-blue-text);"><i class="bi bi-bar-chart-line-fill"></i> Biggest Challenges & Learnings:</label><div id="m3s7_challenges" class="form-input is-placeholder-showing" contenteditable="true" data-maxlength="800"></div></div>
                        <div><label for="m3s7_narrative" class="font-semibold block mb-1 text-lg" style="color: var(--review-blue-text);"><i class="bi bi-bullseye"></i> Performance vs Quarterly Narrative:</label><div id="m3s7_narrative" class="form-input is-placeholder-showing" contenteditable="true" data-maxlength="800"></div></div>
                        <div><label for="m3s7_next_quarter" class="font-semibold block mb-1 text-lg" style="color: var(--review-blue-text);"><i class="bi bi-forward-fill"></i> Primary Focus for Next Quarter:</label><div id="m3s7_next_quarter" class="form-input is-placeholder-showing" contenteditable="true" data-maxlength="800"></div></div>
                    </div>
                </div>` : ''}
            </div>
        `,
    };

    function parseUkDate(str) {
        if (!str || str.trim() === '') return null;

        // Tries to match various UK date formats like dd/mm/yyyy, d-m-yy, dd Mon yyyy
        const dateRegex = /^\s*(\d{1,2})[\s\/-](\d{1,2}|[a-zA-Z]{3})[\s\/-](\d{2}|\d{4})\s*$/;
        const match = str.trim().match(dateRegex);

        if (!match) return null;

        let [, day, month, year] = match;
        
        day = parseInt(day, 10);
        year = parseInt(year, 10);

        // Convert 2-digit years (e.g., 25 becomes 2025)
        if (year < 100) {
            year += 2000;
        }

        // Convert text months (e.g., 'Aug' to 7)
        if (isNaN(month)) {
            const monthMap = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
            month = monthMap[month.toLowerCase()];
            if (month === undefined) return null;
        } else {
            // JS months are 0-indexed (e.g., January is 0)
            month = parseInt(month, 10) - 1;
        }
        
        const date = new Date(Date.UTC(year, month, day));

        // Final check to ensure the constructed date is valid and its parts match the input
        if (date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day) {
            return date;
        }

        return null;
    }

    // --- AUTHENTICATION & APP FLOW ---
    auth.onAuthStateChanged(async (user) => {
        if (appState.planUnsubscribe) {
            appState.planUnsubscribe();
            appState.planUnsubscribe = null;
        }

        if (user) {
            const lastActivity = localStorage.getItem('lastActivity');
            const MAX_INACTIVITY_PERIOD = 8 * 60 * 60 * 1000; // 8 hours

            if (lastActivity && (new Date().getTime() - lastActivity > MAX_INACTIVITY_PERIOD)) {
                handleLogout(false, true);
                return;
            }

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
            appState.currentUser = null;
            appState.planData = {};
            appState.currentPlanId = null;
            clearActivityListeners();

            DOMElements.initialLoadingView.classList.add('hidden');
            DOMElements.appView.classList.add('hidden');
            DOMElements.dashboardView.classList.add('hidden');
            DOMElements.registerView.classList.add('hidden');
            DOMElements.resetView.classList.add('hidden');
            DOMElements.loginView.classList.remove('hidden');
        }
    });

    const handleLogout = (isTimeout = false, isRevival = false) => {
        if (appState.planUnsubscribe) {
            appState.planUnsubscribe();
            appState.planUnsubscribe = null;
        }
        localStorage.removeItem('lastPlanId');
        localStorage.removeItem('lastViewId');
        localStorage.removeItem('lastActivity');
        if (isTimeout) {
            openModal('timeout');
        }
        if (isRevival) {
            DOMElements.authError.textContent = 'For your security, please sign in again.';
            DOMElements.authError.style.display = 'block';
        }
        DOMElements.emailInput.value = '';
        DOMElements.passwordInput.value = '';
        auth.signOut();
    };

    // --- DASHBOARD LOGIC ---
    async function restoreLastView(planId, viewId) {
        appState.currentPlanId = planId;
        await setupPlanListener();
        DOMElements.dashboardView.classList.add('hidden');
        DOMElements.appView.classList.remove('hidden');
        switchView(viewId);
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
        await setupPlanListener();
        DOMElements.dashboardView.classList.add('hidden');
        DOMElements.appView.classList.remove('hidden');
        switchView('vision');
    }

    function handleBackToDashboard() {
        if (appState.planUnsubscribe) {
            appState.planUnsubscribe();
            appState.planUnsubscribe = null;
        }
        localStorage.removeItem('lastPlanId');
        localStorage.removeItem('lastViewId');
        appState.planData = {};
        appState.currentPlanId = null;
        DOMElements.appView.classList.add('hidden');
        DOMElements.dashboardView.classList.remove('hidden');
        renderDashboard();
    }

    // --- DATA HANDLING ---
    function setupPlanListener() {
        if (appState.planUnsubscribe) {
            appState.planUnsubscribe();
        }

        if (!appState.currentUser || !appState.currentPlanId) {
            appState.planData = {};
            return;
        }

        const docRef = db.collection("users").doc(appState.currentUser.uid).collection("plans").doc(appState.currentPlanId);
        
        appState.planUnsubscribe = docRef.onSnapshot((doc) => {
            if (doc.exists) {
                const remoteData = doc.data();
                appState.planData = remoteData;
                updateViewWithRemoteData(remoteData); 
                updateUI();
            } else {
                console.log("No such document!");
                appState.planData = {};
            }
        }, (error) => {
            console.error("Error listening to plan changes:", error);
        });
    }

    function updateViewWithRemoteData(remoteData) {
        if (DOMElements.appView.classList.contains('hidden') || appState.currentView === 'summary') {
            return;
        }
    
        // Add this block to the end of the updateViewWithRemoteData function
        if (appState.currentView.startsWith('month-')) {
            const monthNum = parseInt(appState.currentView.split('-')[1], 10);
            updateWeeklyTabCompletion(monthNum, remoteData);
        }
    
        document.querySelectorAll('#app-view input, #app-view [contenteditable="true"]').forEach(el => {
            if (document.activeElement !== el) {
                if (el.id && remoteData[el.id] !== undefined) {
                    if (el.isContentEditable) {
                        if (el.innerHTML !== remoteData[el.id]) {
                            el.innerHTML = remoteData[el.id];
                        }
                    } else {
                        if (el.value !== remoteData[el.id]) {
                            el.value = remoteData[el.id];
                        }
                    }
                }
            }
            if (el.isContentEditable) managePlaceholder(el);
        });
        
        document.querySelectorAll('.pillar-buttons').forEach(group => {
            const stepKey = group.dataset.stepKey;
            const dataKey = `${stepKey}_pillar`;
            const pillar = remoteData[dataKey];
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
                const status = remoteData[key];
                group.querySelectorAll('.selected').forEach(s => s.classList.remove('selected'));
                if (status) {
                    const buttonToSelect = group.querySelector(`[data-status="${status}"]`);
                    if (buttonToSelect) buttonToSelect.classList.add('selected');
                }
            });
        }
    }


  function saveData(forceImmediate = false, directPayload = null) {
        if (!appState.currentUser || !appState.currentPlanId) return Promise.resolve();

        const localChanges = {};
        const fieldsToDelete = {};

        document.querySelectorAll('#app-view input, #app-view [contenteditable="true"]').forEach(el => {
            if (el.id) {
                localChanges[el.id] = el.isContentEditable ? el.innerHTML : el.value;
            }
        });

        document.querySelectorAll('.pillar-buttons').forEach(group => {
            const stepKey = group.dataset.stepKey;
            const selected = group.querySelector('.selected');
            const dataKey = `${stepKey}_pillar`;
            if (selected) {
                localChanges[dataKey] = selected.dataset.pillar;
            } else {
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
                    localChanges[key] = selected.dataset.status;
                } else {
                    fieldsToDelete[key] = firebase.firestore.FieldValue.delete();
                }
            });
        }

        const changedData = {};
        let hasChanges = false;
        for (const key in localChanges) {
            if (localChanges[key] !== appState.planData[key]) {
                changedData[key] = localChanges[key];
                hasChanges = true;
            }
        }

        for (const key in fieldsToDelete) {
            if (appState.planData[key] !== undefined) {
                changedData[key] = fieldsToDelete[key];
                hasChanges = true;
            }
        }

        if (directPayload) {
            for (const key in directPayload) {
                if (directPayload[key] !== appState.planData[key]) {
                    changedData[key] = directPayload[key];
                    hasChanges = true;
                }
            }
        }

        if (!hasChanges) {
            return Promise.resolve();
        }

        clearTimeout(appState.saveTimeout);

        const saveToFirestore = async () => {
            const docRef = db.collection("users").doc(appState.currentUser.uid).collection("plans").doc(appState.currentPlanId);
            const dataToSave = {
                ...changedData,
                lastEdited: firebase.firestore.FieldValue.serverTimestamp()
            };

            await docRef.update(dataToSave);

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

    function getVisionProgress(planData) {
        const data = planData || appState.planData;
        const isContentEmpty = (htmlContent) => {
            if (!htmlContent) return true;
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;
            return tempDiv.innerText.trim() === '';
        };
        const requiredFields = templates.vision.requiredFields;
        const total = requiredFields.length;
        const completed = requiredFields.filter(field => !isContentEmpty(data[field])).length;
        return { completed, total };
    }
    
function isWeekComplete(monthNum, weekNum, planData) {
        const data = planData || appState.planData;
        const status = data[`m${monthNum}s5_w${weekNum}_status`];
        const win = data[`m${monthNum}s5_w${weekNum}_win`];
        const spotlight = data[`m${monthNum}s5_w${weekNum}_spotlight`];

        const isContentEmpty = (htmlContent) => {
            if (!htmlContent) return true;
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;
            return tempDiv.innerText.trim() === '';
        };

        return !!status && !isContentEmpty(win) && !isContentEmpty(spotlight);
    }

    function updateWeeklyTabCompletion(monthNum, planData) {
        for (let w = 1; w <= 4; w++) {
            const isComplete = isWeekComplete(monthNum, w, planData);
            const tab = document.querySelector(`.weekly-tab[data-week="${w}"]`);
            if (tab) {
                const tickIcon = tab.querySelector('.week-complete-icon');
                if (tickIcon) {
                    tickIcon.classList.toggle('hidden', !isComplete);
                }
            }
        }
    }
    
    function getMonthProgress(monthNum, planData) {
        const data = planData || appState.planData;
        const isContentEmpty = (htmlContent) => {
            if (!htmlContent) return true;
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;
            return tempDiv.innerText.trim() === '';
        };
        const requiredFields = [
            `m${monthNum}s1_battle`, `m${monthNum}s1_pillar`, `m${monthNum}s2_levers`,
            `m${monthNum}s2_powerup_q`, `m${monthNum}s2_powerup_a`, `m${monthNum}s3_people`,
            `m${monthNum}s4_people`, `m${monthNum}s4_product`, `m${monthNum}s4_customer`, `m${monthNum}s4_place`,
            `m${monthNum}s6_win`, `m${monthNum}s6_challenge`, `m${monthNum}s6_next`
        ];

        // FIX: Add all 12 weekly check-in fields to the progress calculation
        for (let w = 1; w <= 4; w++) {
            requiredFields.push(`m${monthNum}s5_w${w}_status`);
            requiredFields.push(`m${monthNum}s5_w${w}_win`);
            requiredFields.push(`m${monthNum}s5_w${w}_spotlight`);
        }

        if (monthNum == 3) {
            requiredFields.push('m3s7_achievements', 'm3s7_challenges', 'm3s7_narrative', 'm3s7_next_quarter');
        }
        const total = requiredFields.length;
        const completed = requiredFields.filter(field => !isContentEmpty(data[field])).length;
        return { completed, total };
    }

    function isStepComplete(stepKey, data) {
        if (stepKey === 'vision') {
            const progress = getVisionProgress(data);
            return progress.total > 0 && progress.completed === progress.total;
        }
        return false;
    }

    function isMonthComplete(monthNum, data) {
        const progress = getMonthProgress(monthNum, data);
        return progress.total > 0 && progress.completed === progress.total;
    }

    function updateSidebarNavStatus() {
        const updateNavItem = (navId, progress) => {
            const navLink = document.querySelector(navId);
            if (!navLink) return;

            const isComplete = progress.total > 0 && progress.completed === progress.total;
            navLink.classList.toggle('completed', isComplete);

            const progressCircle = navLink.querySelector('.progress-donut__progress');
            if (progressCircle) {
                const radius = progressCircle.r.baseVal.value;
                const circumference = 2 * Math.PI * radius;
                progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
                const progressFraction = progress.total > 0 ? progress.completed / progress.total : 0;
                const offset = circumference - (progressFraction * circumference);
                progressCircle.style.strokeDashoffset = offset;
            }
        };

        updateNavItem('#nav-vision', getVisionProgress());
        for (let m = 1; m <= 3; m++) {
            updateNavItem(`#nav-month-${m}`, getMonthProgress(m));
        }
    }

    function calculatePlanCompletion(planData) {
        let totalFields = 0;
        let completedFields = 0;
        const visionProgress = getVisionProgress(planData);
        totalFields += visionProgress.total;
        completedFields += visionProgress.completed;
        for (let m = 1; m <= 3; m++) {
            const monthProgress = getMonthProgress(m, planData);
            totalFields += monthProgress.total;
            completedFields += monthProgress.completed;
        }
        return totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
    }

    function updateOverallProgress() {
        const percentage = calculatePlanCompletion(appState.planData);
        DOMElements.progressPercentage.textContent = `${percentage}%`;
        DOMElements.progressBarFill.style.width = `${percentage}%`;
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
            populateViewWithData();
        }
        document.querySelectorAll('#main-nav a').forEach(a => a.classList.remove('active'));
        document.querySelector(`#nav-${viewId}`)?.classList.add('active');

        DOMElements.appView.classList.remove('sidebar-open');
        initializeCharCounters();
    }

    function renderSummary() {
        const formData = appState.planData;

        // FIX: Upgraded the 'e' helper to correctly handle empty HTML
        const e = (html) => {
            if (!html) return '...'; // Handles null, undefined, ""
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            if (tempDiv.innerText.trim() === '') {
                return '...'; // Handles '<p></p>', '<br>', etc.
            }
            return html; // Return the original html if it has content
        };

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
            return `<div class="content-card p-0 overflow-hidden mt-8">
                        <h2 class="text-2xl font-bold font-poppins p-6 bg-gray-50 border-b">Month ${monthNum} Sprint</h2>
                        <div class="summary-grid">
                            <div class="p-6">
                                ${pillarHTML}
                                <div class="summary-section"><h3 class="summary-heading">Must-Win Battle</h3><div class="summary-content prose prose-sm">${e(formData[`m${monthNum}s1_battle`])}</div></div>
                                <div class="summary-section"><h3 class="summary-heading">Key Levers</h3><div class="summary-content prose prose-sm">${e(formData[`m${monthNum}s2_levers`])}</div></div>
                                <div class="summary-section"><h3 class="summary-heading">People Growth</h3><div class="summary-content prose prose-sm">${e(formData[`m${monthNum}s3_people`])}</div></div>
                            </div>
                            <div class="p-6 bg-gray-50/70 border-l">
                                <div class="summary-section"><h3 class="summary-heading">Protect the Core</h3><ul class="space-y-3 mt-2"><li class="flex items-start text-sm"><i class="bi bi-people-fill w-5 text-center mr-3 text-gray-400"></i><span class="flex-1">${e(formData[`m${monthNum}s4_people`])}</span></li><li class="flex items-start text-sm"><i class="bi bi-cup-hot-fill w-5 text-center mr-3 text-gray-400"></i><span class="flex-1">${e(formData[`m${monthNum}s4_product`])}</span></li><li class="flex items-start text-sm"><i class="bi bi-heart-fill w-5 text-center mr-3 text-gray-400"></i><span class="flex-1">${e(formData[`m${monthNum}s4_customer`])}</span></li><li class="flex items-start text-sm"><i class="bi bi-shop w-5 text-center mr-3 text-gray-400"></i><span class="flex-1">${e(formData[`m${monthNum}s4_place`])}</span></li></ul></div>
                                <div class="summary-section"><h3 class="summary-heading">Weekly Momentum Wins & Learnings</h3>${weeklyCheckinHTML}</div>
                                <div class="summary-section"><h3 class="summary-heading">End of Month Review</h3><ul class="space-y-3 mt-2"><li class="flex items-start text-sm"><i class="bi bi-trophy-fill w-5 text-center mr-3 text-gray-400"></i><span class="flex-1"><strong class="font-semibold text-gray-700">Win:</strong> ${e(formData[`m${monthNum}s6_win`])}</span></li><li class="flex items-start text-sm"><i class="bi bi-lightbulb-fill w-5 text-center mr-3 text-gray-400"></i><span class="flex-1"><strong class="font-semibold text-gray-700">Challenge:</strong> ${e(formData[`m${monthNum}s6_challenge`])}</span></li><li class="flex items-start text-sm"><i class="bi bi-rocket-takeoff-fill w-5 text-center mr-3 text-gray-400"></i><span class="flex-1"><strong class="font-semibold text-gray-700">Next:</strong> ${e(formData[`m${monthNum}s6_next`])}</span></li></ul></div>
                            </div>
                        </div>
                    </div>`;
        };
        DOMElements.contentArea.innerHTML = `<div class="space-y-8 summary-content">
                                                <div class="content-card p-6">
                                                    <h2 class="text-2xl font-bold font-poppins mb-4">Quarterly Vision & Sprints</h2>
                                                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-4 mb-4">
                                                        <div><h4 class="font-semibold text-sm text-gray-500">Manager</h4><p class="text-gray-800 font-medium">${formData.managerName || '...'}</p></div>
                                                        <div><h4 class="font-semibold text-sm text-gray-500">Bakery</h4><p class="text-gray-800 font-medium">${formData.bakeryLocation || '...'}</p></div>
                                                        <div><h4 class="font-semibold text-sm text-gray-500">Quarter</h4><p class="text-gray-800 font-medium">${formData.quarter || '...'}</p></div>
                                                    </div>
                                                    <div class="mb-6"><h4 class="font-semibold text-sm text-gray-500">Quarterly Theme</h4><div class="text-gray-800 prose prose-sm">${e(formData.quarterlyTheme)}</div></div>
                                                    <div><h3 class="text-lg font-bold border-b pb-2 mb-3">Proposed Monthly Sprints</h3><div class="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3 text-sm"><div><strong class="font-semibold text-gray-600 block">Month 1 Goal:</strong><div class="text-gray-800 mt-1 prose prose-sm">${e(formData.month1Goal)}</div></div><div><strong class="font-semibold text-gray-600 block">Month 2 Goal:</strong><div class="text-gray-800 mt-1 prose prose-sm">${e(formData.month2Goal)}</div></div><div><strong class="font-semibold text-gray-600 block">Month 3 Goal:</strong><div class="text-gray-800 mt-1 prose prose-sm">${e(formData.month3Goal)}</div></div></div></div>
                                                </div>
                                                ${renderMonthSummary(1)}
                                                ${renderMonthSummary(2)}
                                                ${renderMonthSummary(3)}
                                                <div class="content-card p-6 mt-8" style="background-color: var(--review-blue-bg); border-color: var(--review-blue-border);"><h2 class="text-2xl font-bold mb-4" style="color: var(--review-blue-text);">Final Quarterly Reflection</h2><div class="space-y-4"><div><h3 class="font-bold text-lg flex items-center gap-2" style="color: var(--review-blue-text);"><i class="bi bi-award-fill"></i> Biggest Achievements</h3><div class="text-gray-700 mt-1 prose prose-sm">${e(formData.m3s7_achievements)}</div></div><div><h3 class="font-bold text-lg flex items-center gap-2" style="color: var(--review-blue-text);"><i class="bi bi-bar-chart-line-fill"></i> Biggest Challenges & Learnings</h3><div class="text-gray-700 mt-1 prose prose-sm">${e(formData.m3s7_challenges)}</div></div><div><h3 class="font-bold text-lg flex items-center gap-2" style="color: var(--review-blue-text);"><i class="bi bi-bullseye"></i> Performance vs Narrative</h3><div class="text-gray-700 mt-1 prose prose-sm">${e(formData.m3s7_narrative)}</div></div><div><h3 class="font-bold text-lg flex items-center gap-2" style="color: var(--review-blue-text);"><i class="bi bi-forward-fill"></i> Focus For Next Quarter</h3><div class="text-gray-700 mt-1 prose prose-sm">${e(formData.m3s7_next_quarter)}</div></div></div></div>
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

    // ====================================================================
    // AI ACTION PLAN LOGIC (with Undo/Redo)
    // ====================================================================

    function updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        if (undoBtn) undoBtn.disabled = undoStack.length <= 1;
        if (redoBtn) redoBtn.disabled = redoStack.length === 0;
    }

    function saveState() {
        const printableArea = document.getElementById('ai-printable-area');
        if (printableArea) {
            undoStack.push(printableArea.innerHTML);
            redoStack = []; // Clear redo stack on new action
            updateUndoRedoButtons();
        }
    }

    function undo() {
        if (undoStack.length > 1) {
            const currentState = undoStack.pop();
            redoStack.push(currentState);
            const previousState = undoStack[undoStack.length - 1];
            document.getElementById('ai-printable-area').innerHTML = previousState;
            updateUndoRedoButtons();
        }
    }

    function redo() {
        if (redoStack.length > 0) {
            const nextState = redoStack.pop();
            undoStack.push(nextState);
            document.getElementById('ai-printable-area').innerHTML = nextState;
            updateUndoRedoButtons();
        }
    }
    
    function setupAiModalInteractivity(container) {
        if (!container) return;

        const makeTablesSortable = (container) => {
            const tables = container.querySelectorAll('table');
            tables.forEach(table => {
                const headers = table.querySelectorAll('thead th');
                const sortableColumns = {
                    'Action Step': { index: 0, type: 'text' },
                    'Pillar': { index: 1, type: 'text' },
                    'Owner': { index: 2, type: 'text' },
                    'Due Date': { index: 3, type: 'date' },
                    'Status': { index: 5, type: 'text' }
                };

                headers.forEach((th) => {
                    const headerText = th.innerText.trim();
                    if (sortableColumns[headerText]) {
                        const config = sortableColumns[headerText];
                        th.classList.add('sortable-header');
                        th.dataset.column = config.index;
                        th.dataset.sortType = config.type;
                        
                        th.innerHTML = '';
                        const wrapper = document.createElement('div');
                        wrapper.className = 'header-flex-wrapper';

                        const textSpan = document.createElement('span');
                        textSpan.textContent = headerText;

                        const iconSpan = document.createElement('span');
                        iconSpan.className = 'sort-icon';

                        wrapper.appendChild(textSpan);
                        wrapper.appendChild(iconSpan);
                        th.appendChild(wrapper);
                    }
                });
            });
        };

        makeTablesSortable(container);

        const handleTableSort = (header) => {
            const table = header.closest('table');
            const tbody = table.querySelector('tbody');
            const columnIndex = parseInt(header.dataset.column, 10);
            const sortType = header.dataset.sortType || 'text';
            const currentDirection = header.dataset.sortDir || 'desc';
            const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';

            table.querySelectorAll('.sortable-header').forEach(th => {
                th.removeAttribute('data-sort-dir');
            });
            header.dataset.sortDir = newDirection;

            const rows = Array.from(tbody.querySelectorAll('tr'));
            
            rows.sort((rowA, rowB) => {
                const cellA = rowA.querySelectorAll('td')[columnIndex];
                const cellB = rowB.querySelectorAll('td')[columnIndex];
                const valA = cellA ? cellA.innerText.trim() : '';
                const valB = cellB ? cellB.innerText.trim() : '';
                
                let compareResult = 0;
                if (sortType === 'date') {
                    const dateA = parseUkDate(valA);
                    const dateB = parseUkDate(valB);

                    if (dateA && dateB) {
                        compareResult = dateA.getTime() - dateB.getTime();
                    } else if (dateA && !dateB) {
                        compareResult = -1;
                    } else if (!dateA && dateB) {
                        compareResult = 1;
                    } else {
                        compareResult = 0;
                    }
                } else {
                    compareResult = valA.localeCompare(valB, undefined, {numeric: true});
                }
                
                return newDirection === 'asc' ? compareResult : -compareResult;
            });
            
            tbody.innerHTML = '';
            rows.forEach(row => tbody.appendChild(row));
            saveState();
        };

        container.addEventListener('click', (e) => {
            const addBtn = e.target.closest('.btn-add-row');
            const removeBtn = e.target.closest('.btn-remove-row');
            const tab = e.target.closest('.ai-tab-btn');
            const sortHeader = e.target.closest('.sortable-header');

            if (addBtn) {
                const tableBody = addBtn.closest('table').querySelector('tbody');
                if (tableBody) {
                    const newRow = document.createElement('tr');
                    newRow.innerHTML = `
                        <td contenteditable="true"></td>
                        <td contenteditable="true"></td>
                        <td contenteditable="true"></td>
                        <td contenteditable="true"></td>
                        <td contenteditable="true"></td>
                        <td contenteditable="true"></td>
                        <td class="actions-cell"><button class="btn-remove-row"><i class="bi bi-trash3"></i></button></td>
                    `;
                    tableBody.appendChild(newRow);
                    saveState();
                }
            }
            if (removeBtn) {
                removeBtn.closest('tr').remove();
                saveState();
            }
            if (tab) {
                if (tab.classList.contains('active')) return;
                
                const tabContainer = tab.closest('.ai-action-plan-container');
                const tabs = tabContainer.querySelectorAll('.ai-tab-btn');
                const panels = tabContainer.querySelectorAll('.ai-tabs-content > div');

                tabs.forEach(t => t.classList.remove('active'));
                panels.forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                const targetPanel = tabContainer.querySelector(`[data-tab-panel="${tab.dataset.tab}"]`);
                if (targetPanel) targetPanel.classList.add('active');
            }
            if (sortHeader) {
                handleTableSort(sortHeader);
            }
        });

        const observer = new MutationObserver((mutations) => {
            const isTextChange = mutations.some(m => m.type === 'characterData');
            if (isTextChange) {
               saveState();
            }
        });
        observer.observe(container, {
            childList: false,
            subtree: true,
            characterData: true
        });
    }

    async function handleAIActionPlan() {
        const savedPlan = appState.planData.aiActionPlan;

        if (savedPlan) {
            openModal('aiActionPlan_view');
            const modalContent = document.getElementById('modal-content');
            modalContent.innerHTML = `<div id="ai-printable-area" class="editable-action-plan">${savedPlan}</div>`;

            undoStack = [];
            redoStack = [];
            saveState();
            setupAiModalInteractivity(modalContent.querySelector('#ai-printable-area'));
        } else {
            openModal('aiActionPlan_generate');
            try {
                const planSummary = summarizePlanForAI(appState.planData);
                const response = await fetch('/.netlify/functions/generate-plan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ planSummary })
                });

                if (!response.ok) {
                    let errorResult;
                    try {
                        errorResult = await response.json();
                    } catch (e) {
                        throw new Error(response.statusText || 'The AI assistant failed to respond.');
                    }
                    throw new Error(errorResult.error || 'The AI assistant failed to generate a response.');
                }
                
                const textResponse = await response.text();
                if (!textResponse) {
                    throw new Error("The AI assistant returned an empty plan. Please try regenerating.");
                }

                const data = JSON.parse(textResponse);
                
                const cleanedHTML = data.actionPlan.replace(/^```(html)?\s*/, '').replace(/```$/, '').trim();

                appState.planData.aiActionPlan = cleanedHTML;
                await saveData(true);
                handleAIActionPlan();
            } catch (error) {
                console.error("Error generating AI plan:", error);
                const modalContent = document.getElementById('modal-content');
                modalContent.innerHTML = `<p class="text-red-600 font-semibold">An error occurred.</p><p class="text-gray-600 mt-2 text-sm">${error.message}</p>`;
                DOMElements.modalActionBtn.style.display = 'none';
                DOMElements.modalCancelBtn.textContent = 'Close';
            }
        }
    }

    function requestCloseModal() {
        const isAiModal = DOMElements.modalBox.dataset.type === 'aiActionPlan_view';
        const hasUnsavedChanges = undoStack.length > 1;

        if (isAiModal && hasUnsavedChanges) {
            openModal('confirmClose');
        } else {
            closeModal();
        }
    }

   async function saveActionPlan() {
        const editedContent = document.getElementById('ai-printable-area').innerHTML;
        
        // DO NOT update the local state here. Send the change directly.
        // appState.planData.aiActionPlan = editedContent; // This was the line causing the bug.

        const saveButton = DOMElements.modalActionBtn;
        const originalHTML = saveButton.innerHTML;
        saveButton.disabled = true;
        saveButton.innerHTML = `<i class="bi bi-check-circle-fill"></i> Saved!`;

        // Pass the new content directly to our robust saveData function.
        // It will compare it to the old state and save the change.
        await saveData(true, { aiActionPlan: editedContent });

        const printableArea = document.getElementById('ai-printable-area');
        if (printableArea) {
            // The undo stack should be reset after a successful save.
            undoStack = [editedContent];
            redoStack = [];
            updateUndoRedoButtons();
        }

        setTimeout(() => {
            saveButton.disabled = false;
            saveButton.innerHTML = originalHTML;
        }, 2000);
    }
    function handleRegenerateActionPlan() {
        openModal('confirmRegenerate');
    }
    
    async function handleShare() {
        openModal('sharing');
        try {
            let shareableLink;
            const pointerQuery = db.collection('sharedPlans').where('originalPlanId', '==', appState.currentPlanId);
            const querySnapshot = await pointerQuery.get();
            if (!querySnapshot.empty) {
                const existingPointer = querySnapshot.docs[0];
                shareableLink = `${window.location.origin}/view.html?id=${existingPointer.id}`;
            } else {
                const originalPlanRef = db.collection('users').doc(appState.currentUser.uid).collection('plans').doc(appState.currentPlanId);
                await originalPlanRef.update({ isShared: true });
                const pointerDoc = {
                    originalUserId: appState.currentUser.uid,
                    originalPlanId: appState.currentPlanId,
                    sharedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                const newPointerRef = await db.collection('sharedPlans').add(pointerDoc);
                shareableLink = `${window.location.origin}/view.html?id=${newPointerRef.id}`;
            }
            const modalContent = document.getElementById('modal-content');
            modalContent.innerHTML = `<p class="text-sm text-gray-600 mb-4">This is a live link that will update as you make changes to your plan.</p>
                                      <label for="shareable-link" class="font-semibold block mb-2">Shareable Link:</label>
                                      <div class="flex items-center gap-2">
                                          <input type="text" id="shareable-link" class="form-input" value="${shareableLink}" readonly>
                                          <button id="copy-link-btn" class="btn btn-secondary"><i class="bi bi-clipboard"></i></button>
                                      </div>
                                      <p id="copy-success-msg" class="text-green-600 text-sm mt-2 hidden">Link copied to clipboard!</p>`;
            document.getElementById('copy-link-btn').addEventListener('click', () => {
                const linkInput = document.getElementById('shareable-link');
                linkInput.select();
                document.execCommand('copy');
                document.getElementById('copy-success-msg').classList.remove('hidden');
                setTimeout(() => document.getElementById('copy-success-msg').classList.add('hidden'), 2000);
            });
            DOMElements.modalActionBtn.style.display = 'none';
            DOMElements.modalCancelBtn.textContent = 'Done';
        } catch (error) {
            console.error("Error creating shareable link:", error);
            const modalContent = document.getElementById('modal-content');
            modalContent.innerHTML = `<p class="text-red-600">Could not create a shareable link. Please try again later.</p>`;
        }
    }

    function openModal(type, context = {}) {
        const { planId, currentName, planName } = context;
        DOMElements.modalBox.dataset.type = type;
        DOMElements.modalBox.dataset.planId = planId;

        const modalHeader = DOMElements.modalTitle.parentNode;
        const footer = DOMElements.modalActionBtn.parentNode;
        
        // Clear any dynamic elements from previous modal openings
        footer.classList.remove('is-confirming');
        footer.querySelectorAll('.dynamic-btn').forEach(btn => btn.remove());
        modalHeader.querySelectorAll('.dynamic-btn').forEach(btn => btn.remove());

        // Reset default button states
        DOMElements.modalActionBtn.style.display = 'inline-flex';
        DOMElements.modalCancelBtn.style.display = 'inline-flex';
        footer.style.justifyContent = 'flex-end'; // Default alignment

        DOMElements.modalActionBtn.onclick = handleModalAction;
        DOMElements.modalCancelBtn.onclick = requestCloseModal;

        switch (type) {
            case 'create':
                DOMElements.modalTitle.textContent = "Create New Plan";
                DOMElements.modalContent.innerHTML = `<label for="newPlanName" class="font-semibold block mb-2">Plan Name:</label>
                                                  <input type="text" id="newPlanName" class="form-input" placeholder="e.g., Q4 2025 Focus" value="New Plan ${new Date().toLocaleDateString('en-GB')}">
                                                  <div id="modal-error-container" class="modal-error-container"></div>`;
                DOMElements.modalActionBtn.textContent = "Create Plan";
                DOMElements.modalActionBtn.className = 'btn btn-primary';
                const newPlanNameInput = document.getElementById('newPlanName');
                newPlanNameInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') handleModalAction(); });
                break;
            case 'edit':
                DOMElements.modalTitle.textContent = "Edit Plan Name";
                DOMElements.modalContent.innerHTML = `<label for="editPlanName" class="font-semibold block mb-2">Plan Name:</label><input type="text" id="editPlanName" class="form-input" value="${currentName}">`;
                DOMElements.modalActionBtn.textContent = "Save Changes";
                DOMElements.modalActionBtn.className = 'btn btn-primary';
                document.getElementById('editPlanName').addEventListener('keyup', (e) => { if (e.key === 'Enter') handleModalAction(); });
                break;
            case 'delete':
                DOMElements.modalTitle.textContent = "Confirm Deletion";
                DOMElements.modalContent.innerHTML = `<p>Are you sure you want to permanently delete the plan: <strong class="font-bold">${planName}</strong>?</p><p class="mt-2 text-sm text-red-700 bg-red-100 p-3 rounded-lg">This action is final and cannot be undone.</p>`;
                DOMElements.modalActionBtn.textContent = "Confirm Delete";
                DOMElements.modalActionBtn.className = 'btn btn-primary bg-red-600 hover:bg-red-700';
                break;
            case 'timeout':
                DOMElements.modalTitle.textContent = "Session Timed Out";
                DOMElements.modalContent.innerHTML = `<p>For your security, you have been logged out due to inactivity. All of your progress has been saved.</p>`;
                DOMElements.modalActionBtn.textContent = "OK";
                DOMElements.modalActionBtn.className = 'btn btn-primary';
                DOMElements.modalCancelBtn.style.display = 'none';
                DOMElements.modalActionBtn.onclick = closeModal;
                break;
            case 'sharing':
                DOMElements.modalTitle.textContent = "Share Your Plan";
                DOMElements.modalContent.innerHTML = `<div class="flex items-center justify-center p-8"><div class="loading-spinner"></div><p class="ml-4 text-gray-600">Generating secure shareable link...</p></div>`;
                DOMElements.modalActionBtn.style.display = 'none';
                DOMElements.modalCancelBtn.textContent = 'Cancel';
                break;
            case 'aiActionPlan_generate':
                DOMElements.modalTitle.textContent = "Generating AI Action Plan";
                DOMElements.modalContent.innerHTML = `<div class="flex flex-col items-center justify-center p-8">
                                                          <div class="loading-spinner"></div>
                                                          <p class="mt-4 text-gray-600">Please wait, the AI is creating your plan...</p>
                                                      </div>`;
                DOMElements.modalActionBtn.style.display = 'none';
                DOMElements.modalCancelBtn.style.display = 'none';
                break;
            case 'aiActionPlan_view': {
                DOMElements.modalTitle.textContent = "Edit Your Action Plan";
                
                // 1. Get rid of the cancel button
                DOMElements.modalCancelBtn.style.display = 'none';
                
                // Set footer to space buttons between left and right
                footer.style.justifyContent = 'space-between';

                // 2. Create and place "Generate New" button on the left
                const regenButton = document.createElement('button');
                regenButton.id = 'modal-regen-btn';
                regenButton.className = 'btn btn-secondary dynamic-btn';
                regenButton.innerHTML = `<i class="bi bi-stars"></i> Generate New`;
                regenButton.onclick = handleRegenerateActionPlan;
                footer.insertBefore(regenButton, footer.firstChild);

                // Create a container for all right-side buttons to keep them grouped
                const rightButtonsContainer = document.createElement('div');
                rightButtonsContainer.className = 'flex items-center gap-2 dynamic-btn';

                // 3 & 4. Create, restyle, and add Undo/Redo and Print buttons
                const printBtn = document.createElement('button');
                printBtn.id = 'modal-print-btn';
                printBtn.className = 'btn btn-secondary';
                printBtn.innerHTML = `<i class="bi bi-printer-fill"></i> Print Plan`;
                
                const undoBtn = document.createElement('button');
                undoBtn.id = 'undo-btn';
                undoBtn.className = 'btn btn-secondary !p-2'; // Style for icon-only
                undoBtn.title = 'Undo';
                undoBtn.innerHTML = `<i class="bi bi-arrow-counterclockwise text-lg"></i>`;
                undoBtn.onclick = undo;

                const redoBtn = document.createElement('button');
                redoBtn.id = 'redo-btn';
                redoBtn.className = 'btn btn-secondary !p-2'; // Style for icon-only
                redoBtn.title = 'Redo';
                redoBtn.innerHTML = `<i class="bi bi-arrow-clockwise text-lg"></i>`;
                redoBtn.onclick = redo;

                // Add buttons to the right container in visual order
                rightButtonsContainer.appendChild(printBtn);
                rightButtonsContainer.appendChild(undoBtn);
                rightButtonsContainer.appendChild(redoBtn);
                
                // Move the existing "Save Changes" button into the container
                DOMElements.modalActionBtn.textContent = "Save Changes";
                DOMElements.modalActionBtn.className = 'btn btn-primary';
                DOMElements.modalActionBtn.onclick = saveActionPlan;
                rightButtonsContainer.appendChild(DOMElements.modalActionBtn);
                
                // Add the whole right-side container to the footer
                footer.appendChild(rightButtonsContainer);

                printBtn.onclick = () => {
                    const aiPlanContainer = document.getElementById('ai-printable-area');
                    const activeTabPanel = aiPlanContainer.querySelector('.ai-tabs-content > div.active');
                    const activeTabButton = aiPlanContainer.querySelector('.ai-tabs-nav .ai-tab-btn.active');

                    if (!activeTabPanel || !activeTabButton) {
                        alert("Could not find the active month to print.");
                        return;
                    }
                    
                    const monthTitle = `${activeTabButton.textContent} Action Plan`;
                    const printNode = activeTabPanel.cloneNode(true);
                    printNode.querySelectorAll('.actions-cell, .btn-remove-row, tfoot').forEach(el => el.remove());

                    const printableHTML = printNode.innerHTML;

                    const printStyles = `
                        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Poppins:wght@700;900&display=swap');
                        @page { size: A4; margin: 25mm; }
                        body { font-family: 'DM Sans', sans-serif; color: #1F2937; }
                        .print-header { text-align: center; border-bottom: 2px solid #D10A11; padding-bottom: 15px; margin-bottom: 25px; }
                        .print-header h1 { font-family: 'Poppins', sans-serif; font-size: 24pt; color: #1F2937; margin: 0; }
                        .print-header h2 { font-family: 'Poppins', sans-serif; font-size: 16pt; color: #D10A11; margin-top: 5px; margin-bottom: 5px; font-weight: 700; }
                        .print-header p { font-size: 11pt; color: #6B7280; margin: 5px 0 0; }
                        table { width: 100%; border-collapse: collapse; font-size: 9pt; page-break-inside: auto; }
                        tr { page-break-inside: avoid; page-break-after: auto; }
                        th, td { border: 1px solid #E5E7EB; padding: 10px 12px; text-align: left; vertical-align: top; }
                        thead { display: table-header-group; }
                        th { background-color: #F9FAFB; font-weight: 600; color: #374151; }
                        th:last-child, td:last-child { display: none !important; }
                    `;

                    const printWindow = window.open('', '', 'height=800,width=1200');
                    printWindow.document.write('<html><head><title>AI Action Plan</title>');
                    printWindow.document.write(`<style>${printStyles}</style>`);
                    printWindow.document.write('</head><body>');
                    printWindow.document.write(`<div class="print-header"><h1>AI Action Plan</h1><h2>${monthTitle}</h2><p>${appState.planData.planName || 'Growth Plan'} | ${appState.planData.bakeryLocation || 'Your Bakery'}</p></div>`);
                    printWindow.document.write(printableHTML);
                    printWindow.document.write('</body></html>');
                    printWindow.document.close();

                    setTimeout(() => { printWindow.print(); }, 500);
                };
                
                updateUndoRedoButtons();
                break;
            }
            case 'confirmClose': {
                DOMElements.modalTitle.textContent = "Discard Changes?";
                DOMElements.modalContent.innerHTML = `<p>You have unsaved changes. Are you sure you want to close without saving?</p>`;
                
                DOMElements.modalActionBtn.textContent = "Discard";
                DOMElements.modalActionBtn.className = 'btn btn-primary bg-red-600 hover:bg-red-700';
                DOMElements.modalCancelBtn.textContent = "Cancel";

                DOMElements.modalActionBtn.onclick = () => {
                    closeModal();
                };

                DOMElements.modalCancelBtn.onclick = () => {
                    const lastUnsavedState = undoStack[undoStack.length - 1];
                    openModal('aiActionPlan_view');
                    const modalContent = document.getElementById('modal-content');
                    modalContent.innerHTML = `<div id="ai-printable-area" class="editable-action-plan">${lastUnsavedState}</div>`;
                    setupAiModalInteractivity(modalContent.querySelector('#ai-printable-area'));
                    updateUndoRedoButtons();
                };
                
                break;
            }
            case 'confirmRegenerate': {
                DOMElements.modalTitle.textContent = "Are you sure?";
                DOMElements.modalContent.innerHTML = `<div class="p-4 text-center">
                                    <p class="text-gray-600 mt-2">Generating a new plan will overwrite your existing action plan and any edits you've made. This cannot be undone.</p>
                                </div>`;

                const confirmBtn = DOMElements.modalActionBtn;
                const cancelBtn = DOMElements.modalCancelBtn;

                confirmBtn.textContent = "Yes, Generate New Plan";
                confirmBtn.className = 'btn btn-primary bg-red-600 hover:bg-red-700';
                cancelBtn.textContent = "Cancel";

                footer.classList.add('is-confirming');
                footer.querySelectorAll('.dynamic-btn').forEach(btn => btn.style.display = 'none');

                confirmBtn.onclick = () => {
                    footer.classList.remove('is-confirming');
                    delete appState.planData.aiActionPlan;
                    saveData(true).then(() => {
                        handleAIActionPlan();
                    });
                };

                cancelBtn.onclick = () => {
                    footer.classList.remove('is-confirming');
                    const lastUnsavedState = undoStack[undoStack.length - 1];
                    openModal('aiActionPlan_view');
                    const modalContent = document.getElementById('modal-content');
                    modalContent.innerHTML = `<div id="ai-printable-area" class="editable-action-plan">${lastUnsavedState}</div>`;
                    setupAiModalInteractivity(modalContent.querySelector('#ai-printable-area'));
                    updateUndoRedoButtons();
                };
                break;
            }
        }
        DOMElements.modalOverlay.classList.remove('hidden');
    }

    function closeModal() {
        document.querySelectorAll('.dynamic-btn').forEach(btn => btn.remove());
        DOMElements.modalActionBtn.onclick = null;
        DOMElements.modalCancelBtn.onclick = null; 
        DOMElements.modalActionBtn.style.display = 'inline-flex';
        DOMElements.modalOverlay.classList.add('hidden');
    }

    async function handleModalAction() {
        const type = DOMElements.modalBox.dataset.type;
        const planId = DOMElements.modalBox.dataset.planId;
        if (type === 'timeout') {
            closeModal();
            return;
        }
        switch(type) {
            case 'create':
                const newPlanNameInput = document.getElementById('newPlanName');
                const newPlanName = newPlanNameInput.value.trim();
                const originalButtonText = DOMElements.modalActionBtn.textContent;
                const errorContainer = document.getElementById('modal-error-container');
                if(errorContainer) errorContainer.innerHTML = '';
                newPlanNameInput.classList.remove('input-error');
                if (!newPlanName) {
                    newPlanNameInput.classList.add('input-error', 'shake');
                    setTimeout(() => newPlanNameInput.classList.remove('shake'), 500);
                    return;
                }
                DOMElements.modalActionBtn.disabled = true;
                DOMElements.modalActionBtn.textContent = 'Checking...';
                const plansRef = db.collection('users').doc(appState.currentUser.uid).collection('plans');
                const nameQuery = await plansRef.where('planName', '==', newPlanName).get();
                if (!nameQuery.empty) {
                    newPlanNameInput.classList.add('input-error', 'shake');
                    if(errorContainer) {
                       errorContainer.innerHTML = `<p class="auth-error" style="display:block; margin: 0; width: 100%;">A plan with this name already exists. Please choose another.</p>`;
                    }
                    DOMElements.modalActionBtn.disabled = false;
                    DOMElements.modalActionBtn.textContent = originalButtonText;
                    setTimeout(() => newPlanNameInput.classList.remove('shake'), 500);
                    return;
                }
                DOMElements.modalActionBtn.disabled = false;
                DOMElements.modalActionBtn.textContent = originalButtonText;
                closeModal();
                DOMElements.creationLoadingView.classList.remove('hidden');
                try {
                    const newPlan = await plansRef.add({
                        planName: newPlanName,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        lastEdited: firebase.firestore.FieldValue.serverTimestamp(),
                        managerName: ''
                    });
                    await handleSelectPlan(newPlan.id);
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
                        await renderDashboard();
                    } catch (error) { console.error("Error updating plan name:", error); }
                }
                closeModal();
                break;
            case 'delete':
                try {
                    await db.collection('users').doc(appState.currentUser.uid).collection('plans').doc(planId).delete();
                    await renderDashboard();
                } catch (error) { console.error("Error deleting plan:", error); }
                closeModal();
                break;
        }
    }

    // --- EVENT LISTENERS ---
    const handleLoginAttempt = () => {
        DOMElements.authError.style.display = 'none';
        auth.signInWithEmailAndPassword(DOMElements.emailInput.value, DOMElements.passwordInput.value)
            .catch(error => {
                let friendlyMessage = 'An unexpected error occurred. Please try again.';
                switch (error.code) {
                    case 'auth/invalid-login-credentials':
                    case 'auth/invalid-credential':
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                        friendlyMessage = 'Incorrect email or password. Please check your details and try again.';
                        break;
                    case 'auth/invalid-email':
                        friendlyMessage = 'The email address is not valid. Please enter a valid email.';
                        break;
                }
                DOMElements.authError.textContent = friendlyMessage;
                DOMElements.authError.style.display = 'block';
            });
    };

    DOMElements.loginBtn.addEventListener('click', handleLoginAttempt);
    const loginOnEnter = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleLoginAttempt();
        }
    };
    DOMElements.emailInput.addEventListener('keyup', loginOnEnter);
    DOMElements.passwordInput.addEventListener('keyup', loginOnEnter);

    DOMElements.createAccountBtn.addEventListener('click', () => {
        const email = DOMElements.registerEmail.value;
        const password = DOMElements.registerPassword.value;
        const errorContainer = DOMElements.registerError;
        errorContainer.style.display = 'none';
        if (!DOMElements.termsAgreeCheckbox.checked) {
            errorContainer.textContent = 'You must agree to the Terms and Conditions and Privacy Policy.';
            errorContainer.style.display = 'block';
            return;
        }
        auth.createUserWithEmailAndPassword(email, password)
            .catch(error => {
                let friendlyMessage = 'An unexpected error occurred. Please try again.';
                switch (error.code) {
                    case 'auth/email-already-in-use':
                        friendlyMessage = 'An account with this email address already exists. Please try logging in.';
                        break;
                    case 'auth/weak-password':
                        friendlyMessage = 'The password is too weak. Please choose a stronger password.';
                        break;
                    case 'auth/invalid-email':
                        friendlyMessage = 'The email address is not valid. Please enter a valid email.';
                        break;
                }
                errorContainer.textContent = friendlyMessage;
                errorContainer.style.display = 'block';
            });
    });

    DOMElements.showRegisterViewBtn.addEventListener('click', (e) => {
        e.preventDefault();
        DOMElements.loginView.classList.add('hidden');
        DOMElements.resetView.classList.add('hidden');
        DOMElements.registerView.classList.remove('hidden');
        DOMElements.authError.style.display = 'none';
    });
    DOMElements.backToLoginFromRegisterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        DOMElements.registerView.classList.add('hidden');
        DOMElements.loginView.classList.remove('hidden');
    });
    DOMElements.forgotPasswordBtn.addEventListener('click', (e) => {
        e.preventDefault();
        DOMElements.loginView.classList.add('hidden');
        DOMElements.registerView.classList.add('hidden');
        DOMElements.resetView.classList.remove('hidden');
        DOMElements.authError.style.display = 'none';
        DOMElements.resetMessageContainer.innerHTML = '';
    });
    DOMElements.backToLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        DOMElements.resetView.classList.add('hidden');
        DOMElements.loginView.classList.remove('hidden');
    });
    DOMElements.sendResetBtn.addEventListener('click', () => {
        const email = DOMElements.resetEmail.value;
        const messageContainer = DOMElements.resetMessageContainer;
        messageContainer.innerHTML = '';
        if (!email) {
            messageContainer.innerHTML = `<p class="auth-error" style="display:block; margin-bottom: 1rem;">Please enter your email address.</p>`;
            return;
        }
        DOMElements.sendResetBtn.disabled = true;
        DOMElements.sendResetBtn.textContent = 'Sending...';
        auth.sendPasswordResetEmail(email)
            .then(() => {
                messageContainer.innerHTML = `<p class="auth-success">If an account exists for this email, a password reset link has been sent. Please check your inbox.</p>`;
            })
            .catch((error) => {
                messageContainer.innerHTML = `<p class="auth-success">If an account exists for this email, a password reset link has been sent. Please check your inbox.</p>`;
                console.error("Password Reset Error:", error.message);
            })
            .finally(() => {
                setTimeout(() => {
                    DOMElements.sendResetBtn.disabled = false;
                    DOMElements.sendResetBtn.textContent = 'Send Reset Link';
                }, 3000);
            });
    });

    DOMElements.logoutBtn.addEventListener('click', () => handleLogout(false));
    DOMElements.dashboardLogoutBtn.addEventListener('click', () => handleLogout(false));
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

    DOMElements.mainNav.addEventListener('click', (e) => { e.preventDefault(); const navLink = e.target.closest('a'); if (navLink) { switchView(navLink.id.replace('nav-', '')); }});

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
            managePlaceholder(e.target);
        }
    });

    DOMElements.contentArea.addEventListener('click', (e) => {
        const target = e.target;
        const pillarButton = target.closest('.pillar-button');
        if (pillarButton) {
            const alreadySelected = pillarButton.classList.contains('selected');
            pillarButton.parentElement.querySelectorAll('.pillar-button').forEach(btn => btn.classList.remove('selected'));
            if (!alreadySelected) {
                pillarButton.classList.add('selected');
            }
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

    DOMElements.modalCloseBtn.addEventListener('click', requestCloseModal);
    DOMElements.modalOverlay.addEventListener('mousedown', (e) => {
        if (e.target === DOMElements.modalOverlay) {
            requestCloseModal();
        }
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

    // --- COOKIE CONSENT ---
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

document.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();
});














