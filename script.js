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
        dashboardProfileBtn: document.getElementById('dashboard-profile-btn'),
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
        saveTimeout: null,
        sessionTimeout: null,
        planUnsubscribe: null,
        calendarUnsubscribe: null,
        calendar: {
            currentDate: new Date(),
            data: {},
            editingEventIndex: null
        }
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
                        <div class="content-card p-8"><label for="quarterlyTheme" class="block text-lg font-semibold mb-2">Quarterly Vision: <i class="bi bi-info-circle info-icon" title="The big, overarching mission for the next 90 days."></i></label><div id="quarterlyTheme" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="e.g., Become the undisputed neighbourhood favourite by mastering our availability." data-maxlength="400"></div></div>
                        <div class="content-card p-8"><h3 class="text-2xl font-bold mb-6">Key Monthly Objectives</h3><div class="grid grid-cols-1 md:grid-cols-3 gap-6"><div><label for="month1Goal" class="font-bold block mb-1">Month 1: <i class="bi bi-info-circle info-icon" title="High-level goal for the first 30-day sprint."></i></label><div id="month1Goal" class="form-input text-sm is-placeholder-showing" contenteditable="true" data-placeholder="e.g., PRODUCT: Master afternoon availability and reduce waste." data-maxlength="300"></div></div><div><label for="month2Goal" class="font-bold block mb-1">Month 2: <i class="bi bi-info-circle info-icon" title="High-level goal for the second 30-day sprint."></i></label><div id="month2Goal" class="form-input text-sm is-placeholder-showing" contenteditable="true" data-placeholder="e.g., PLACE: Embed new production processes and daily checks." data-maxlength="300"></div></div><div><label for="month3Goal" class="font-bold block mb-1">Month 3: <i class="bi bi-info-circle info-icon" title="High-level goal for the third 30-day sprint."></i></label><div id="month3Goal" class="form-input text-sm is-placeholder-showing" contenteditable="true" data-placeholder="e.g., PEOPLE: Develop team skills for consistent execution." data-maxlength="300"></div></div></div></div>
                   </div>`,
            requiredFields: ['managerName', 'bakeryLocation', 'quarter', 'quarterlyTheme', 'month1Goal', 'month2Goal', 'month3Goal']
        },
        month: (monthNum) => `
            <div class="space-y-8">
                <div class="content-card p-6 md:p-8">
                    <h2 class="text-2xl font-bold font-poppins mb-1">Your Foundation</h2>
                    <p class="text-gray-600 mb-6">Complete these sections at the start of your month to set a clear direction.</p>
                    <div class="space-y-6">
                        <div>
                            <label class="font-semibold text-lg block mb-2 text-gray-800">Must-Win Battle:</label>
                            <div id="m${monthNum}s1_battle" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="Example: 'Achieve >80% availability by implementing the production matrix correctly...'" data-maxlength="500"></div>
                            <div class="mt-4">
                                <label class="font-semibold block mb-3 text-sm text-gray-600">Pillar Focus:</label>
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
                                <label for="m${monthNum}s2_levers" class="font-semibold text-lg block mb-2 text-gray-800">My Key Actions:</label>
                                <div id="m${monthNum}s2_levers" class="form-input is-placeholder-showing flex-grow key-levers-input" contenteditable="true" data-placeholder="1. Daily: Review the production report from yesterday to adjust today's baking.&#10;
2. Lead a 'Coffee calibration' session in the management meeting 
3. Ongoing: Coach one team member daily on a specific SHINE principle." data-maxlength="600"></div>
                            </div>
                            <div class="space-y-4">
                                <div>
                                    <label for="m${monthNum}s2_powerup_q" class="font-semibold text-lg block mb-2 text-gray-800">Team Power-Up Question:</label>
                                    <div id="m${monthNum}s2_powerup_q" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="What's one small change we could make this week to make our customers smile?" data-maxlength="300"></div>
                                </div>
                                <div>
                                    <label for="m${monthNum}s2_powerup_a" class="font-semibold text-lg block mb-2 text-gray-800">Our Team's Winning Idea:</label>
                                    <div id="m${monthNum}s2_powerup_a" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="Creating a 'regular's board' to remember our most frequent customers' orders." data-maxlength="300"></div>
                                </div>
                            </div>
                        </div>
                        <div class="pt-6 border-t">
                            <label class="font-semibold text-lg block mb-2 text-gray-800">Developing Our Breadheads:</label>
                            <div id="m${monthNum}s3_people" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="Example: 'Sarah: Coach on the production matrix to build her confidence.'" data-maxlength="600"></div>
                        </div>
                        <div class="pt-6 border-t">
                            <label class="font-semibold text-lg block mb-2 text-gray-800">Upholding Our Pillars:</label>
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
                                        <label for="m${monthNum}s5_w${w}_spotlight" class="font-semibold block mb-2 text-gray-700">Breadhead Spotlight:</label>
                                        <div id="m${monthNum}s5_w${w}_spotlight" class="form-input text-sm is-placeholder-showing weekly-check-in-input" contenteditable="true" data-placeholder="e.g., Sarah, for making a customer's day by remembering their name and usual order—a perfect example of our SHINE values." data-maxlength="400"></div>
                                    </div>
                                    <div class="md:col-span-2">
                                        <label for="m${monthNum}s5_w${w}_shine" class="font-semibold block mb-2 text-gray-700">This Week's SHINE Focus:</label>
                                        <div id="m${monthNum}s5_w${w}_shine" class="form-input text-sm is-placeholder-showing weekly-check-in-input" contenteditable="true" data-placeholder="e.g., Ensuring every customer is greeted within 30 seconds." data-maxlength="400"></div>
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
        const dateRegex = /^\s*(\d{1,2})[\s\/-](\d{1,2}|[a-zA-Z]{3})[\s\/-](\d{2}|\d{4})\s*$/;
        const match = str.trim().match(dateRegex);
        if (!match) return null;
        let [, day, month, year] = match;
        day = parseInt(day, 10);
        year = parseInt(year, 10);
        if (year < 100) { year += 2000; }
        if (isNaN(month)) {
            const monthMap = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
            month = monthMap[month.toLowerCase()];
            if (month === undefined) return null;
        } else {
            month = parseInt(month, 10) - 1;
        }
        const date = new Date(Date.UTC(year, month, day));
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
        if (appState.calendarUnsubscribe) {
            appState.calendarUnsubscribe();
            appState.calendarUnsubscribe = null;
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
        if (appState.calendarUnsubscribe) {
            appState.calendarUnsubscribe();
            appState.calendarUnsubscribe = null;
        }
        localStorage.removeItem('lastPlanId');
        localStorage.removeItem('lastViewId');
        localStorage.removeItem('lastActivity');
        document.getElementById('calendar-fab').classList.add('hidden');
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
    function formatLastEditedDate(lastEditedDate) {
        if (!lastEditedDate) {
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

    async function restoreLastView(planId, viewId) {
        appState.currentPlanId = planId;
        await setupPlanListener();
        DOMElements.dashboardView.classList.add('hidden');
        DOMElements.appView.classList.remove('hidden');
        switchView(viewId);
        document.getElementById('calendar-fab').classList.remove('hidden');
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
            const editedDate = formatLastEditedDate(plan.lastEdited);
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

    function handleCreateNewPlan() { openModal('create'); }
    function handleEditPlanName(planId, currentName) { openModal('edit', { planId, currentName }); }
    function handleDeletePlan(planId, planName) { openModal('delete', { planId, planName }); }

    async function handleSelectPlan(planId) {
        appState.currentPlanId = planId;
        await setupPlanListener();
        DOMElements.dashboardView.classList.add('hidden');
        DOMElements.appView.classList.remove('hidden');
        switchView('vision');
        document.getElementById('calendar-fab').classList.remove('hidden');
    }

    function handleBackToDashboard() {
        if (appState.planUnsubscribe) {
            appState.planUnsubscribe();
            appState.planUnsubscribe = null;
        }
        if (appState.calendarUnsubscribe) {
            appState.calendarUnsubscribe();
            appState.calendarUnsubscribe = null;
        }
        localStorage.removeItem('lastPlanId');
        localStorage.removeItem('lastViewId');
        appState.planData = {};
        appState.currentPlanId = null;
        DOMElements.appView.classList.add('hidden');
        DOMElements.dashboardView.classList.remove('hidden');
        document.getElementById('calendar-fab').classList.add('hidden');
        renderDashboard();
    }

    // --- DATA HANDLING ---
    async function setupPlanListener() {
        if (appState.planUnsubscribe) {
            appState.planUnsubscribe();
        }
        if (appState.calendarUnsubscribe) {
            appState.calendarUnsubscribe();
        }

        if (!appState.currentUser || !appState.currentPlanId) {
            appState.planData = {};
            appState.calendar.data = {};
            return;
        }
        const planDocRef = db.collection("users").doc(appState.currentUser.uid).collection("plans").doc(appState.currentPlanId);
        const calendarDocRef = db.collection('users').doc(appState.currentUser.uid).collection('calendar').doc(appState.currentPlanId);
        try {
            const doc = await planDocRef.get();
            if (doc.exists) {
                appState.planData = doc.data();
            } else {
                console.log("No such document on initial load!");
                appState.planData = {};
                handleBackToDashboard();
            }
        } catch (error) {
            console.error("Error fetching initial plan data:", error);
            handleBackToDashboard();
        }

        await loadCalendarData();

        appState.planUnsubscribe = planDocRef.onSnapshot((doc) => {
            if (doc.exists) {
                const remoteData = doc.data();
                if (JSON.stringify(remoteData) !== JSON.stringify(appState.planData)) {
                    appState.planData = remoteData;
                    updateViewWithRemoteData(remoteData);
                    updateUI();
                }
            }
        }, (error) => {
            console.error("Error listening to plan changes:", error);
        });

        appState.calendarUnsubscribe = calendarDocRef.onSnapshot((doc) => {
            const remoteCalendarData = doc.exists ? doc.data() : {};
            if (JSON.stringify(remoteCalendarData) !== JSON.stringify(appState.calendar.data)) {
                appState.calendar.data = remoteCalendarData;
                if (!document.getElementById('calendar-modal').classList.contains('hidden')) {
                    renderCalendar();
                }
            }
        }, (error) => {
            console.error("Error listening to calendar changes:", error);
        });
    }

    function updateViewWithRemoteData(remoteData) {
        if (appState.currentView === 'summary') {
            renderSummary();
            return;
        }
        if (DOMElements.appView.classList.contains('hidden')) {
            return;
        }
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
            const pillars = remoteData[dataKey]; // This will be an array or undefined
            group.querySelectorAll('.selected').forEach(s => s.classList.remove('selected'));
            if (Array.isArray(pillars)) {
                pillars.forEach(pillar => {
                    const buttonToSelect = group.querySelector(`[data-pillar="${pillar}"]`);
                    if (buttonToSelect) buttonToSelect.classList.add('selected');
                });
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
            const dataKey = `${stepKey}_pillar`;
            const selectedButtons = group.querySelectorAll('.selected');
            if (selectedButtons.length > 0) {
                const selectedPillars = Array.from(selectedButtons).map(btn => btn.dataset.pillar).sort();
                localChanges[dataKey] = selectedPillars;
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
            if (JSON.stringify(localChanges[key]) !== JSON.stringify(appState.planData[key])) {
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
        const shine = data[`m${monthNum}s5_w${weekNum}_shine`];
        const isContentEmpty = (htmlContent) => {
            if (!htmlContent) return true;
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;
            return tempDiv.innerText.trim() === '';
        };
        return !!status && !isContentEmpty(win) && !isContentEmpty(spotlight) && !isContentEmpty(shine);
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
        for (let w = 1; w <= 4; w++) {
            requiredFields.push(`m${monthNum}s5_w${w}_status`);
            requiredFields.push(`m${monthNum}s5_w${w}_win`);
            requiredFields.push(`m${monthNum}s5_w${w}_spotlight`);
            requiredFields.push(`m${monthNum}s5_w${w}_shine`);
        }
        if (monthNum == 3) {
            requiredFields.push('m3s7_achievements', 'm3s7_challenges', 'm3s7_narrative', 'm3s7_next_quarter');
        }
        const total = requiredFields.length;
        const completed = requiredFields.filter(field => !isContentEmpty(data[field])).length;
        return { completed, total };
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
            const pillars = appState.planData[dataKey]; // This is an array now
            group.querySelectorAll('.selected').forEach(s => s.classList.remove('selected'));
            if (Array.isArray(pillars)) {
                 pillars.forEach(pillar => {
                    const buttonToSelect = group.querySelector(`[data-pillar="${pillar}"]`);
                    if (buttonToSelect) buttonToSelect.classList.add('selected');
                });
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
            'month-1': { title: '30 Day Plan', subtitle: 'Lay the foundations for success.'},
            'month-2': { title: '60 Day Plan', subtitle: 'Build momentum and embed processes.'},
            'month-3': { title: '90 Day Plan', subtitle: 'Refine execution and review the quarter.'},
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
        const e = (html) => {
            if (!html) return '...';
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            if (tempDiv.innerText.trim() === '') { return '...'; }
            return html;
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
                const spotlight = formData[`m${monthNum}s5_w${w}_spotlight`];
                const shine = formData[`m${monthNum}s5_w${w}_shine`];

                if (status) {
                    hasLoggedWeeks = true;
                    const statusText = status.replace('-', ' ').toUpperCase();
                    const statusBadgeHTML = `<span class="summary-status-badge status-${status}">${statusText}</span>`;

                    let checkinContent = '';
                    if (!isContentEmpty(win)) {
                        checkinContent += `<p class="text-sm text-gray-600 mb-2"><strong>Win/Learning:</strong> ${e(win)}</p>`;
                    }
                    if (!isContentEmpty(spotlight)) {
                        checkinContent += `<p class="text-sm text-gray-600 mb-2"><strong>Breadhead Spotlight:</strong> ${e(spotlight)}</p>`;
                    }
                    if (!isContentEmpty(shine)) {
                        checkinContent += `<p class="text-sm text-gray-600"><strong>SHINE Focus:</strong> ${e(shine)}</p>`;
                    }
                    if (checkinContent === '') {
                        checkinContent = '<p class="text-sm text-gray-500 italic">No details logged for this week.</p>';
                    }

                    weeklyCheckinHTML += `<li class="mb-3 pb-3 border-b last:border-b-0">
                                            <div class="flex justify-between items-center mb-2">
                                                <strong class="font-semibold text-gray-700">Week ${w}</strong>
                                                ${statusBadgeHTML}
                                            </div>
                                            ${checkinContent}
                                          </li>`;
                }
            }
            if (!hasLoggedWeeks) {
                weeklyCheckinHTML = '<p class="text-sm text-gray-500">No weekly check-ins have been logged for this month.</p>';
            } else {
                weeklyCheckinHTML += '</ul>';
            }
            const pillars = formData[`m${monthNum}s1_pillar`];
            const pillarIcons = {
                'people': '<i class="bi bi-people-fill"></i>',
                'product': '<i class="bi bi-cup-hot-fill"></i>',
                'customer': '<i class="bi bi-heart-fill"></i>',
                'place': '<i class="bi bi-shop"></i>'
            };
            let pillarBadgesHTML = '';
            if (Array.isArray(pillars) && pillars.length > 0) {
                pillarBadgesHTML = pillars.map(pillar => {
                    const pillarIcon = pillarIcons[pillar] || '';
                    const pillarText = pillar.charAt(0).toUpperCase() + pillar.slice(1);
                    return `<span class="pillar-badge">${pillarIcon} ${pillarText}</span>`;
                }).join('');
            }

            let pillarHTML = '';
            if (pillarBadgesHTML) {
                pillarHTML = `<div class="flex items-center gap-2 mb-4 flex-wrap"><span class="font-semibold text-sm text-gray-500">Pillar Focus:</span>${pillarBadgesHTML}</div>`;
            }

            return `<div class="content-card p-0 overflow-hidden mt-8">
                        <h2 class="text-2xl font-bold font-poppins p-6 bg-gray-50 border-b">${monthNum * 30} Day Plan</h2>
                        <div class="summary-grid">
                            <div class="p-6">
                                ${pillarHTML}
                                <div class="summary-section"><h3 class="summary-heading">Must-Win Battle</h3><div class="summary-content prose prose-sm">${e(formData[`m${monthNum}s1_battle`])}</div></div>
                                <div class="summary-section"><h3 class="summary-heading">Key Actions</h3><div class="summary-content prose prose-sm">${e(formData[`m${monthNum}s2_levers`])}</div></div>
                                <div class="summary-section"><h3 class="summary-heading">Developing Our Breadheads</h3><div class="summary-content prose prose-sm">${e(formData[`m${monthNum}s3_people`])}</div></div>
                            </div>
                            <div class="p-6 bg-gray-50/70 border-l">
                                <div class="summary-section"><h3 class="summary-heading">Upholding Our Pillars</h3><ul class="space-y-3 mt-2"><li class="flex items-start text-sm"><i class="bi bi-people-fill w-5 text-center mr-3 text-gray-400"></i><span class="flex-1">${e(formData[`m${monthNum}s4_people`])}</span></li><li class="flex items-start text-sm"><i class="bi bi-cup-hot-fill w-5 text-center mr-3 text-gray-400"></i><span class="flex-1">${e(formData[`m${monthNum}s4_product`])}</span></li><li class="flex items-start text-sm"><i class="bi bi-heart-fill w-5 text-center mr-3 text-gray-400"></i><span class="flex-1">${e(formData[`m${monthNum}s4_customer`])}</span></li><li class="flex items-start text-sm"><i class="bi bi-shop w-5 text-center mr-3 text-gray-400"></i><span class="flex-1">${e(formData[`m${monthNum}s4_place`])}</span></li></ul></div>
                                <div class="summary-section"><h3 class="summary-heading">Weekly Momentum Wins & Learnings</h3>${weeklyCheckinHTML}</div>
                                <div class="summary-section"><h3 class="summary-heading">End of Month Review</h3><ul class="space-y-3 mt-2"><li class="flex items-start text-sm"><i class="bi bi-trophy-fill w-5 text-center mr-3 text-gray-400"></i><span class="flex-1"><strong class="font-semibold text-gray-700">Win:</strong> ${e(formData[`m${monthNum}s6_win`])}</span></li><li class="flex items-start text-sm"><i class="bi bi-lightbulb-fill w-5 text-center mr-3 text-gray-400"></i><span class="flex-1"><strong class="font-semibold text-gray-700">Challenge:</strong> ${e(formData[`m${monthNum}s6_challenge`])}</span></li><li class="flex items-start text-sm"><i class="bi bi-rocket-takeoff-fill w-5 text-center mr-3 text-gray-400"></i><span class="flex-1"><strong class="font-semibold text-gray-700">Next:</strong> ${e(formData[`m${monthNum}s6_next`])}</span></li></ul></div>
                            </div>
                        </div>
                    </div>`;
        };
        DOMElements.contentArea.innerHTML = `<div class="space-y-8 summary-content">
                                                <div class="content-card p-6">
                                                    <h2 class="text-2xl font-bold font-poppins mb-4">Quarter Overview</h2>
                                                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-4 mb-4">
                                                        <div><h4 class="font-semibold text-sm text-gray-500">Manager</h4><p class="text-gray-800 font-medium">${formData.managerName || '...'}</p></div>
                                                        <div><h4 class="font-semibold text-sm text-gray-500">Bakery</h4><p class="text-gray-800 font-medium">${formData.bakeryLocation || '...'}</p></div>
                                                        <div><h4 class="font-semibold text-sm text-gray-500">Quarter</h4><p class="text-gray-800 font-medium">${formData.quarter || '...'}</p></div>
                                                    </div>
                                                    <div class="mb-6"><h4 class="font-semibold text-sm text-gray-500">Quarterly Vision</h4><div class="text-gray-800 prose prose-sm">${e(formData.quarterlyTheme)}</div></div>
                                                    <div><h3 class="text-lg font-bold border-b pb-2 mb-3">Key Monthly Objectives</h3><div class="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3 text-sm"><div><strong class="font-semibold text-gray-600 block">Month 1:</strong><div class="text-gray-800 mt-1 prose prose-sm">${e(formData.month1Goal)}</div></div><div><strong class="font-semibold text-gray-600 block">Month 2:</strong><div class="text-gray-800 mt-1 prose prose-sm">${e(formData.month2Goal)}</div></div><div><strong class="font-semibold text-gray-600 block">Month 3:</strong><div class="text-gray-800 mt-1 prose prose-sm">${e(formData.month3Goal)}</div></div></div></div>
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
            summary += `KEY ACTIONS: ${e(planData[`m${m}s2_levers`])}\n`;
            summary += `DEVELOPING OUR BREADHEADS: ${e(planData[`m${m}s3_people`])}\n`;
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
        const saveButton = DOMElements.modalActionBtn;
        const originalHTML = saveButton.innerHTML;
        saveButton.disabled = true;
        saveButton.innerHTML = `<i class="bi bi-check-circle-fill"></i> Saved!`;
        await saveData(true, { aiActionPlan: editedContent });
        const printableArea = document.getElementById('ai-printable-area');
        if (printableArea) {
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

        const footer = DOMElements.modalActionBtn.parentNode;
        
        // --- ROBUST CLEANUP ---
        footer.querySelectorAll('.dynamic-btn').forEach(btn => btn.remove());
        DOMElements.modalActionBtn.style.display = 'inline-flex';
        DOMElements.modalCancelBtn.style.display = 'inline-flex';
        DOMElements.modalActionBtn.className = 'btn btn-primary';
        DOMElements.modalCancelBtn.className = 'btn btn-secondary';
        DOMElements.modalActionBtn.textContent = 'Action';
        DOMElements.modalCancelBtn.textContent = 'Cancel';
        DOMElements.modalActionBtn.disabled = false;
        DOMElements.modalCancelBtn.disabled = false;
        DOMElements.modalActionBtn.onclick = handleModalAction;
        DOMElements.modalCancelBtn.onclick = requestCloseModal;
        footer.style.justifyContent = 'flex-end';
        // --- END CLEANUP ---

        switch (type) {
            case 'create':
                DOMElements.modalTitle.textContent = "Create New Plan";
                DOMElements.modalContent.innerHTML = `<label for="newPlanName" class="font-semibold block mb-2">Plan Name:</label>
                                                  <input type="text" id="newPlanName" class="form-input" placeholder="e.g., Q4 2025 Focus" value="New Plan ${new Date().toLocaleDateString('en-GB')}">
                                                  <div id="modal-error-container" class="modal-error-container"></div>`;
                DOMElements.modalActionBtn.textContent = "Create Plan";
                const newPlanNameInput = document.getElementById('newPlanName');
                newPlanNameInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') handleModalAction(); });
                break;
            case 'edit':
                DOMElements.modalTitle.textContent = "Edit Plan Name";
                DOMElements.modalContent.innerHTML = `<label for="editPlanName" class="font-semibold block mb-2">Plan Name:</label><input type="text" id="editPlanName" class="form-input" value="${currentName}">`;
                DOMElements.modalActionBtn.textContent = "Save Changes";
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
                DOMElements.modalContent.innerHTML = `<div class="flex flex-col items-center justify-center p-8"><div class="loading-spinner"></div><p class="mt-4 text-gray-600">Please wait, the AI is creating your plan...</p></div>`;
                DOMElements.modalActionBtn.style.display = 'none';
                DOMElements.modalCancelBtn.style.display = 'none';
                break;
            case 'aiActionPlan_view': {
                DOMElements.modalTitle.textContent = "Edit Your Action Plan";
                footer.style.justifyContent = 'space-between';
                
                const undoRedoContainer = document.createElement('div');
                undoRedoContainer.className = 'undo-redo-container dynamic-btn';
                
                const undoBtn = document.createElement('button');
                undoBtn.id = 'undo-btn';
                undoBtn.className = 'btn btn-secondary btn-icon';
                undoBtn.title = 'Undo';
                undoBtn.innerHTML = `<i class="bi bi-arrow-counterclockwise"></i>`;
                undoBtn.onclick = undo;
                
                const redoBtn = document.createElement('button');
                redoBtn.id = 'redo-btn';
                redoBtn.className = 'btn btn-secondary btn-icon';
                redoBtn.title = 'Redo';
                redoBtn.innerHTML = `<i class="bi bi-arrow-clockwise"></i>`;
                redoBtn.onclick = redo;
                
                undoRedoContainer.appendChild(undoBtn);
                undoRedoContainer.appendChild(redoBtn);
                footer.insertBefore(undoRedoContainer, footer.firstChild);
                
                const regenButton = document.createElement('button');
                regenButton.id = 'modal-regen-btn';
                regenButton.className = 'btn btn-secondary dynamic-btn';
                regenButton.innerHTML = `<i class="bi bi-stars"></i> Generate New`;
                regenButton.onclick = handleRegenerateActionPlan;
                
                const printBtn = document.createElement('button');
                printBtn.id = 'modal-print-btn';
                printBtn.className = 'btn btn-secondary dynamic-btn';
                printBtn.innerHTML = `<i class="bi bi-printer-fill"></i> Print Plan`;
                printBtn.onclick = () => {
                    const aiPlanContainer = document.getElementById('ai-printable-area');
                    const activeTabPanel = aiPlanContainer.querySelector('.ai-tabs-content > div.active');
                    const activeTabButton = aiPlanContainer.querySelector('.ai-tabs-nav .ai-tab-btn.active');

                    if (!activeTabPanel || !activeTabButton) {
                        alert("Could not find the active month to print.");
                        return;
                    }

                    const monthTitle = `${activeTabButton.textContent}`;
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
                        th.actions-cell, td.actions-cell { display: none !important; }`;
                    
                    const printWindow = window.open('', '', 'height=800,width=1200');
                    printWindow.document.write(`<html><head><title>Our Action Plan</title><style>${printStyles}</style></head><body>`);
                    printWindow.document.write(`<div class="print-header"><h1>${monthTitle}</h1><h2>Our Bakery Action Plan</h2><p>${appState.planData.planName || 'Growth Plan'} | ${appState.planData.bakeryLocation || 'Your Bakery'}</p></div>`);
                    printWindow.document.write(printableHTML);
                    printWindow.document.write('</body></html>');
                    printWindow.document.close();
                    setTimeout(() => { printWindow.print(); }, 500);
                };

                DOMElements.modalActionBtn.textContent = "Save Changes";
                DOMElements.modalActionBtn.onclick = saveActionPlan;
                
                footer.insertBefore(regenButton, DOMElements.modalActionBtn);
                footer.insertBefore(printBtn, DOMElements.modalActionBtn);
                
                DOMElements.modalCancelBtn.style.display = 'none';
                
                updateUndoRedoButtons();
                break;
            }
            case 'confirmRegenerate':
                DOMElements.modalTitle.textContent = "Are you sure?";
                DOMElements.modalContent.innerHTML = `<p class="text-gray-600">Generating a new plan will overwrite your existing action plan and any edits you've made. This cannot be undone.</p>`;

                DOMElements.modalActionBtn.textContent = "Yes, Generate New";
                DOMElements.modalActionBtn.className = 'btn btn-primary bg-red-600 hover:bg-red-700';
                DOMElements.modalActionBtn.onclick = () => {
                    delete appState.planData.aiActionPlan;
                    saveData(true).then(() => { handleAIActionPlan(); });
                };

                DOMElements.modalCancelBtn.textContent = "Cancel";
                DOMElements.modalCancelBtn.onclick = () => {
                    openModal('aiActionPlan_view'); 
                    const modalContent = document.getElementById('modal-content');
                    const lastUnsavedState = undoStack.length > 0 ? undoStack[undoStack.length - 1] : appState.planData.aiActionPlan || '';
                    modalContent.innerHTML = `<div id="ai-printable-area" class="editable-action-plan">${lastUnsavedState}</div>`;
                    setupAiModalInteractivity(modalContent.querySelector('#ai-printable-area'));
                };
                break;
            case 'confirmClose':
                DOMElements.modalTitle.textContent = "Discard Changes?";
                DOMElements.modalContent.innerHTML = `<p>You have unsaved changes. Are you sure you want to close without saving?</p>`;
                DOMElements.modalActionBtn.textContent = "Discard";
                DOMElements.modalActionBtn.className = 'btn btn-primary bg-red-600 hover:bg-red-700';
                DOMElements.modalActionBtn.onclick = () => closeModal();

                DOMElements.modalCancelBtn.textContent = "Cancel";
                DOMElements.modalCancelBtn.onclick = () => {
                    openModal('aiActionPlan_view');
                    const lastUnsavedState = undoStack[undoStack.length - 1];
                    const modalContent = document.getElementById('modal-content');
                    modalContent.innerHTML = `<div id="ai-printable-area" class="editable-action-plan">${lastUnsavedState}</div>`;
                    setupAiModalInteractivity(modalContent.querySelector('#ai-printable-area'));
                    updateUndoRedoButtons();
                };
                break;
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

    // --- CALENDAR LOGIC (REDESIGNED & ENHANCED) ---
    let selectedDateKey = null;

    function renderCalendar() {
        const calendarGrid = document.getElementById('calendar-grid');
        if (!calendarGrid) return;
        calendarGrid.innerHTML = '';
        const date = appState.calendar.currentDate;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const month = date.getMonth();
        const year = date.getFullYear();

        document.getElementById('calendar-month-year').textContent = date.toLocaleString('en-GB', { month: 'long', year: 'numeric' });

        const firstDayOfMonth = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; // 0 = Monday

        ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.classList.add('calendar-day-header');
            dayHeader.textContent = day;
            calendarGrid.appendChild(dayHeader);
        });

        for (let i = 0; i < startDayOfWeek; i++) {
            calendarGrid.appendChild(document.createElement('div'));
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const dayCell = document.createElement('div');
            dayCell.classList.add('calendar-day');
            const currentDayDate = new Date(year, month, i);
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            dayCell.dataset.dateKey = dateKey;

            if (currentDayDate.getTime() === today.getTime()) {
                dayCell.classList.add('current-day');
            }
            if (dateKey === selectedDateKey) {
                dayCell.classList.add('selected');
            }

            const dayNumber = document.createElement('div');
            dayNumber.classList.add('calendar-day-number');
            dayNumber.textContent = i;
            dayCell.appendChild(dayNumber);

            const eventsContainer = document.createElement('div');
            eventsContainer.classList.add('event-dots-container');
            
            const dayEvents = appState.calendar.data[dateKey] || [];
            
            // --- NEW: Day Density & Event Stack Logic ---
            if (Array.isArray(dayEvents) && dayEvents.length > 0) {
                // 1. Set Day Density for Heat Map
                if (dayEvents.length >= 8) {
                    dayCell.classList.add('day-density-4');
                } else if (dayEvents.length >= 6) {
                    dayCell.classList.add('day-density-3');
                } else if (dayEvents.length >= 4) {
                    dayCell.classList.add('day-density-2');
                } else if (dayEvents.length >= 1) {
                    dayCell.classList.add('day-density-1');
                }

                // 2. Sort events for consistent dot display
                dayEvents.sort((a, b) => {
                    if (a.allDay && !b.allDay) return -1;
                    if (!a.allDay && b.allDay) return 1;
                    return (a.timeFrom || '').localeCompare(b.timeFrom || '');
                });

                // 3. Render Dots or Overflow Stack
                if (dayEvents.length <= 3) {
                    // Show up to 3 dots
                    dayEvents.forEach(event => {
                        let element;
                        if (event.type === 'birthday') {
                            element = document.createElement('i');
                            element.className = 'bi bi-cake2';
                        } else {
                            element = document.createElement('div');
                            element.className = `event-dot option-dot ${event.type}`;
                        }
                        eventsContainer.appendChild(element);
                    });
                } else {
                    // Show the new stack indicator
                    const overflowStack = document.createElement('div');
                    overflowStack.className = 'event-overflow-stack';
                    overflowStack.innerHTML = `
                        <div class="stack-bar"></div>
                        <div class="stack-bar"></div>
                        <div class="stack-bar"></div>
                    `;
                    eventsContainer.appendChild(overflowStack);
                }
            }
            // --- END of New Logic ---
            
            dayCell.appendChild(eventsContainer);
            calendarGrid.appendChild(dayCell);
        }
    }

    async function loadCalendarData() {
        if (!appState.currentUser || !appState.currentPlanId) return;
        const calendarRef = db.collection('users').doc(appState.currentUser.uid).collection('calendar').doc(appState.currentPlanId);
        try {
            const doc = await calendarRef.get();
            appState.calendar.data = doc.exists ? doc.data() : {};
        } catch (error) {
            console.error("Error loading calendar data:", error);
            appState.calendar.data = {};
        }
    }

    function renderDayDetails(dateKey) {
        selectedDateKey = dateKey;

        document.querySelectorAll('.calendar-day.selected').forEach(d => d.classList.remove('selected'));
        const selectedDayCell = document.querySelector(`.calendar-day[data-date-key="${dateKey}"]`);
        if (selectedDayCell) selectedDayCell.classList.add('selected');

        const [year, month, day] = dateKey.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const formattedDate = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
        
        document.getElementById('day-detail-title').textContent = formattedDate;
        document.getElementById('add-event-form').classList.add('hidden');

        const eventList = document.getElementById('day-event-list');
        eventList.classList.remove('hidden');
        eventList.innerHTML = '';
        const dayEvents = appState.calendar.data[dateKey] || [];

        if (dayEvents.length > 0) {
            dayEvents.sort((a,b) => {
                if (a.allDay && !b.allDay) return -1;
                if (!a.allDay && b.allDay) return 1;
                return (a.timeFrom || '').localeCompare(b.timeFrom || '');
            });
            dayEvents.forEach((event, index) => {
                const eventItem = document.createElement('div');
                eventItem.classList.add('event-item');
                eventItem.dataset.index = index;
                
                let timeHTML = '';
                if (event.allDay) {
                    timeHTML = `<p class="event-item-time font-semibold">All Day</p>`;
                } else if (event.timeFrom) {
                    let timeString = event.timeFrom;
                    if (event.timeTo) {
                        timeString += ` - ${event.timeTo}`;
                    }
                    timeHTML = `<p class="event-item-time">${timeString}</p>`;
                }
                
                const descriptionHTML = event.description ? `<p class="event-item-description">${event.description.replace(/\n/g, '<br>')}</p>` : '';

                eventItem.innerHTML = `
                    <div class="event-item-header">
                        <div>
                            <h5 class="event-item-title">${event.title}</h5>
                            ${timeHTML}
                        </div>
                        <div class="flex items-center gap-2">
                             <span class="event-type-badge ${event.type}">${event.type}</span>
                             <button class="btn-remove-row btn-remove-event" data-index="${index}" title="Delete event"><i class="bi bi-x-lg"></i></button>
                        </div>
                    </div>
                    ${descriptionHTML}
                `;
                eventList.appendChild(eventItem);
            });
        } else {
            eventList.innerHTML = '<p class="text-gray-500 text-center py-4">No events scheduled for this day.</p>';
        }
        
        
        document.getElementById('add-event-form').classList.add('hidden');
    }

    // MODIFIED: Now correctly handles loading an event with an icon
function showEditEventForm(index) {
    appState.calendar.editingEventIndex = index;
    const event = appState.calendar.data[selectedDateKey][index];

    document.getElementById('day-event-list').classList.add('hidden');
    document.getElementById('add-event-form').classList.remove('hidden');
    document.getElementById('add-event-form-title').textContent = 'Edit Event';
    document.getElementById('save-event-btn').textContent = 'Update Event';
    document.getElementById('event-title-input').value = event.title;
    const allDayCheckbox = document.getElementById('event-all-day-toggle');
    allDayCheckbox.checked = event.allDay || false;
    document.getElementById('event-time-inputs-container').classList.toggle('hidden', allDayCheckbox.checked);
    document.getElementById('event-time-from-input').value = event.timeFrom || '';
    document.getElementById('event-time-to-input').value = event.timeTo || '';
    document.getElementById('event-description-input').value = event.description || '';

    const searchInput = document.getElementById('category-search-input');
    const hiddenInput = document.getElementById('event-type-input');
    const iconContainer = document.getElementById('category-selected-icon-container');
    const optionsContainer = document.querySelector('#category-dropdown .dropdown-options');

    // Clear previous state
    iconContainer.innerHTML = '<span id="category-selected-dot" class="selected-dot"></span>';
    iconContainer.className = 'selected-icon-container';

    if (event.type) {
        const optionToSelect = optionsContainer.querySelector(`.dropdown-option[data-type="${event.type}"]`);
        if (optionToSelect) {
            const iconElement = optionToSelect.querySelector('.option-icon, .option-dot');
            iconContainer.innerHTML = iconElement.outerHTML;
            iconContainer.classList.add(event.type);
            iconContainer.classList.toggle('has-icon', iconElement.classList.contains('option-icon'));

            searchInput.value = optionToSelect.textContent.trim();
            hiddenInput.value = event.type;
        } else {
            searchInput.value = '';
            hiddenInput.value = '';
        }
    } else {
        searchInput.value = '';
        hiddenInput.value = '';
    }
}
    // MODIFIED: This entire function has been updated to support the searchable category dropdown.
function setupCalendarEventListeners() {
    const calendarFab = document.getElementById('calendar-fab');
    const calendarModal = document.getElementById('calendar-modal');
    const calendarCloseBtn = document.getElementById('calendar-close-btn');
    const calendarPrevMonthBtn = document.getElementById('calendar-prev-month-btn');
    const calendarNextMonthBtn = document.getElementById('calendar-next-month-btn');
    const calendarTodayBtn = document.getElementById('calendar-today-btn');
    const calendarGrid = document.getElementById('calendar-grid');
    const addEventBtn = document.getElementById('add-event-btn');
    const cancelEventBtn = document.getElementById('cancel-event-btn');
    const saveEventBtn = document.getElementById('save-event-btn');
    const allDayCheckbox = document.getElementById('event-all-day-toggle');
    const timeInputsContainer = document.getElementById('event-time-inputs-container');
    const dayEventList = document.getElementById('day-event-list');

    // --- NEW: Searchable Dropdown Elements ---
    const categoryDropdown = document.getElementById('category-dropdown');
    const searchInput = document.getElementById('category-search-input');

    if (!calendarFab || !calendarModal || !allDayCheckbox || !categoryDropdown) {
        console.warn("Calendar UI elements not found. Skipping event listener setup.");
        return;
    }

    allDayCheckbox.addEventListener('change', () => {
        if (timeInputsContainer) {
            timeInputsContainer.classList.toggle('hidden', allDayCheckbox.checked);
        }
    });

    // --- NEW: Searchable Dropdown Logic ---
    if (categoryDropdown && searchInput) {
        const selectedDisplay = categoryDropdown.querySelector('.dropdown-selected');
        const optionsContainer = categoryDropdown.querySelector('.dropdown-options');
        const hiddenInput = document.getElementById('event-type-input');
        const selectedDot = document.getElementById('category-selected-dot');

        const filterOptions = () => {
            const searchTerm = searchInput.value.toLowerCase();
            const options = optionsContainer.querySelectorAll('.dropdown-option:not(.no-results)');
            let visibleCount = 0;

            options.forEach(option => {
                const text = option.textContent.trim().toLowerCase();
                if (text.includes(searchTerm)) {
                    option.style.display = 'flex';
                    visibleCount++;
                } else {
                    option.style.display = 'none';
                }
            });

            let noResultsMsg = optionsContainer.querySelector('.no-results');
            if (visibleCount === 0) {
                if (!noResultsMsg) {
                    noResultsMsg = document.createElement('div');
                    noResultsMsg.className = 'dropdown-option no-results';
                    noResultsMsg.textContent = 'No results found';
                    optionsContainer.appendChild(noResultsMsg);
                }
                noResultsMsg.style.display = 'flex';
            } else if (noResultsMsg) {
                noResultsMsg.style.display = 'none';
            }
        };

        // MODIFIED: This function now handles both icons and dots
const selectOption = (option) => {
    const type = option.dataset.type;
    const iconContainer = document.getElementById('category-selected-icon-container');
    const iconElement = option.querySelector('.option-icon, .option-dot');

    // Copy the icon/dot element into the selected display
    iconContainer.innerHTML = iconElement.outerHTML;
    iconContainer.className = `selected-icon-container ${type}`; // Pass class for styling
    iconContainer.classList.toggle('has-icon', iconElement.classList.contains('option-icon'));

    searchInput.value = option.textContent.trim();
    hiddenInput.value = type;
    categoryDropdown.classList.remove('open');
};

        searchInput.addEventListener('focus', () => {
            categoryDropdown.classList.add('open');
            searchInput.select();
            filterOptions(); // Show all options when focused
        });

        searchInput.addEventListener('input', filterOptions);

        selectedDisplay.addEventListener('click', (e) => {
            if (e.target !== searchInput) {
                searchInput.focus();
            }
        });
        
        document.addEventListener('click', (e) => {
            if (!categoryDropdown.contains(e.target)) {
                categoryDropdown.classList.remove('open');
                // If input is not a valid category, reset it
                const currentVal = searchInput.value;
                const hiddenVal = hiddenInput.value;
                if(hiddenVal && currentVal.toLowerCase() !== hiddenVal.toLowerCase()) {
                    const validOption = optionsContainer.querySelector(`.dropdown-option[data-type="${hiddenVal}"]`);
                    if(validOption) searchInput.value = validOption.textContent.trim();
                } else if (!hiddenVal) {
                    searchInput.value = ''; // Clear if nothing was ever selected
                }
            }
        });

        optionsContainer.addEventListener('click', (e) => {
            const option = e.target.closest('.dropdown-option:not(.no-results)');
            if (option) {
                selectOption(option);
            }
        });
    }

    calendarFab.addEventListener('click', () => {
        appState.calendar.currentDate = new Date();
        const today = new Date();
        selectedDateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        renderCalendar();
        renderDayDetails(selectedDateKey);
        calendarModal.classList.remove('hidden');
    });

    if (calendarCloseBtn) calendarCloseBtn.addEventListener('click', () => calendarModal.classList.add('hidden'));
    
    if (calendarPrevMonthBtn) calendarPrevMonthBtn.addEventListener('click', () => {
        appState.calendar.currentDate.setMonth(appState.calendar.currentDate.getMonth() - 1);
        renderCalendar();
    });

    if (calendarNextMonthBtn) calendarNextMonthBtn.addEventListener('click', () => {
        appState.calendar.currentDate.setMonth(appState.calendar.currentDate.getMonth() + 1);
        renderCalendar();
    });

    if (calendarTodayBtn) calendarTodayBtn.addEventListener('click', () => {
        const today = new Date();
        appState.calendar.currentDate = today;
        const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        renderCalendar();
        renderDayDetails(dateKey);
    });

    if (calendarGrid) calendarGrid.addEventListener('click', (e) => {
        const dayCell = e.target.closest('.calendar-day');
        if (dayCell && dayCell.dataset.dateKey) {
            renderDayDetails(dayCell.dataset.dateKey);
        }
    });
    
    if (dayEventList) dayEventList.addEventListener('click', async (e) => {
        const removeBtn = e.target.closest('.btn-remove-event');
        const eventItem = e.target.closest('.event-item');

        if (removeBtn) {
            e.stopPropagation();
            if (!confirm('Are you sure you want to delete this event?')) return;
            const indexToRemove = parseInt(removeBtn.dataset.index, 10);
            const dayEvents = appState.calendar.data[selectedDateKey] || [];
            dayEvents.splice(indexToRemove, 1);
            const calendarRef = db.collection('users').doc(appState.currentUser.uid).collection('calendar').doc(appState.currentPlanId);
            const dataToUpdate = {};
            dataToUpdate[selectedDateKey] = dayEvents.length > 0 ? dayEvents : firebase.firestore.FieldValue.delete();
            try {
                await calendarRef.set(dataToUpdate, { merge: true });
                renderCalendar();
                renderDayDetails(selectedDateKey);
            } catch (error) {
                console.error("Error removing event:", error);
                alert("Could not remove the event. Please try again.");
            }
        } else if (eventItem) {
            const index = parseInt(eventItem.dataset.index, 10);
            showEditEventForm(index);
        }
    });

    // MODIFIED: The reset logic now clears the icon container
if (addEventBtn) addEventBtn.addEventListener('click', () => {
    appState.calendar.editingEventIndex = null;
    if (dayEventList) dayEventList.classList.add('hidden');
    const form = document.getElementById('add-event-form');
    if (form) form.classList.remove('hidden');

    // Reset standard fields
    document.getElementById('event-title-input').value = '';
    document.getElementById('event-all-day-toggle').checked = false;
    document.getElementById('event-time-inputs-container').classList.remove('hidden');
    document.getElementById('event-time-from-input').value = '';
    document.getElementById('event-time-to-input').value = '';
    document.getElementById('event-description-input').value = '';

    // Reset searchable dropdown and icon
    if (categoryDropdown) {
        const iconContainer = document.getElementById('category-selected-icon-container');
        iconContainer.innerHTML = '<span id="category-selected-dot" class="selected-dot"></span>';
        iconContainer.className = 'selected-icon-container';
        document.getElementById('category-search-input').value = '';
        document.getElementById('event-type-input').value = '';
    }

    document.getElementById('add-event-form-title').textContent = 'Add New Event';
    document.getElementById('save-event-btn').textContent = 'Save Event';
});

    if (cancelEventBtn) cancelEventBtn.addEventListener('click', () => {
        appState.calendar.editingEventIndex = null;
        const form = document.getElementById('add-event-form');
        if (form) form.classList.add('hidden');

        if (dayEventList) dayEventList.classList.remove('hidden');
    });

    if (saveEventBtn) saveEventBtn.addEventListener('click', async () => {
        const title = document.getElementById('event-title-input').value.trim();
        const eventType = document.getElementById('event-type-input').value;
        if (!title || !eventType) {
            alert('Please provide a title and select an event type.');
            return;
        }

        const isAllDay = allDayCheckbox.checked;
        const eventData = {
            title: title,
            allDay: isAllDay,
            timeFrom: isAllDay ? '' : document.getElementById('event-time-from-input').value,
            timeTo: isAllDay ? '' : document.getElementById('event-time-to-input').value,
            type: eventType,
            description: document.getElementById('event-description-input').value.trim(),
        };

        const dayEvents = appState.calendar.data[selectedDateKey] || [];
        
        if (appState.calendar.editingEventIndex !== null) {
            dayEvents[appState.calendar.editingEventIndex] = eventData;
        } else {
            dayEvents.push(eventData);
        }

        const calendarRef = db.collection('users').doc(appState.currentUser.uid).collection('calendar').doc(appState.currentPlanId);
        const dataToUpdate = {};
        dataToUpdate[selectedDateKey] = dayEvents;

        try {
            await calendarRef.set(dataToUpdate, { merge: true });
            appState.calendar.editingEventIndex = null;
            renderCalendar();
            renderDayDetails(selectedDateKey);
        } catch (error) {
            console.error("Error saving event:", error);
            alert("Could not save the event. Please try again.");
        }
    });
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
    DOMElements.mobileMenuBtn.addEventListener('click', () => {
        DOMElements.appView.classList.toggle('sidebar-open');
    });

    DOMElements.sidebarOverlay.addEventListener('click', () => {
        DOMElements.appView.classList.remove('sidebar-open');
    });

    DOMElements.logoutBtn.addEventListener('click', () => handleLogout(false));
    DOMElements.dashboardLogoutBtn.addEventListener('click', () => handleLogout(false));
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
    
    // Setup listeners for the new calendar
    setupCalendarEventListeners();
}

document.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();
});










