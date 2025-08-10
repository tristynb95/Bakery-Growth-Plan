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
        initialLoadingView: document.getElementById('initial-loading-view'), // NEW
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
        registerBtn: document.getElementById('register-btn'),
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
        saveIndicator: document.getElementById('save-indicator'),
        headerTitle: document.getElementById('header-title'),
        headerSubtitle: document.getElementById('header-subtitle'),
        progressBarFill: document.getElementById('progress-bar-fill'),
        progressPercentage: document.getElementById('progress-percentage'),
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
        sessionTimeout: null, // To hold the timeout ID
    };

    // --- SESSION TIMEOUT ---
    const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes

    function resetSessionTimeout() {
        clearTimeout(appState.sessionTimeout);
        appState.sessionTimeout = setTimeout(async () => {
            if (appState.currentUser) {
                await saveData(true); // Force immediate save
                handleLogout(true); // Pass true to indicate timeout
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


    // --- HTML TEMPLATES ---
    const templates = {
        vision: {
            html: `<div class="space-y-8">
                        <div class="content-card p-6 md:p-8"><div class="grid grid-cols-1 md:grid-cols-3 gap-6"><div><label for="managerName" class="font-semibold block mb-2">Manager:</label><input type="text" id="managerName" class="form-input" placeholder="e.g., Tristen Bayley"></div><div><label for="bakeryLocation" class="font-semibold block mb-2">Bakery:</label><input type="text" id="bakeryLocation" class="form-input" placeholder="e.g., Marlow"></div><div><label for="quarter" class="font-semibold block mb-2">Quarter:</label><input type="text" id="quarter" class="form-input" placeholder="e.g., Q3 FY26"></div></div></div>
                        
                        <div class="bg-amber-50 border border-amber-200 rounded-xl p-6 shadow-sm">
                            <h3 class="font-bold text-lg text-amber-900 mb-2">Our Mission</h3>
                            <p class="text-xl font-semibold text-gray-800">"To make world-class, craft baking a part of every neighbourhood."</p>
                        </div>
                        
                        <div class="content-card p-8"><label for="quarterlyTheme" class="block text-lg font-semibold mb-2">This Quarter's Narrative: <i class="bi bi-info-circle info-icon" title="The big, overarching mission for the next 90 days."></i></label><textarea id="quarterlyTheme" class="form-input" rows="2" placeholder="e.g., Become the undisputed neighbourhood favourite by mastering our availability."></textarea></div>
                        <div class="content-card p-8"><h3 class="text-2xl font-bold mb-6">Proposed Monthly Sprints</h3><div class="grid grid-cols-1 md:grid-cols-3 gap-6"><div><label for="month1Goal" class="font-bold block mb-1">Month 1 Goal: <i class="bi bi-info-circle info-icon" title="High-level goal for the first 30-day sprint."></i></label><textarea id="month1Goal" class="form-input text-sm" rows="3" placeholder="e.g., PRODUCT: Master afternoon availability and reduce waste."></textarea></div><div><label for="month2Goal" class="font-bold block mb-1">Month 2 Goal: <i class="bi bi-info-circle info-icon" title="High-level goal for the second 30-day sprint."></i></label><textarea id="month2Goal" class="form-input text-sm" rows="3" placeholder="e.g., PLACE: Embed new production processes and daily checks."></textarea></div><div><label for="month3Goal" class="font-bold block mb-1">Month 3 Goal: <i class="bi bi-info-circle info-icon" title="High-level goal for the third 30-day sprint."></i></label><textarea id="month3Goal" class="form-input text-sm" rows="3" placeholder="e.g., PEOPLE: Develop team skills for consistent execution."></textarea></div></div></div>
                   </div>`,
            requiredFields: ['managerName', 'bakeryLocation', 'quarter', 'quarterlyTheme', 'month1Goal', 'month2Goal', 'month3Goal']
        },
        month: (monthNum) => `<div class="grid grid-cols-1 lg:grid-cols-4 gap-8"><div class="lg:col-span-1 no-print"><nav id="month-${monthNum}-stepper" class="space-y-4"></nav></div><div class="lg:col-span-3"><div id="step-content-container"></div><div class="mt-8 flex justify-between no-print"><button id="prev-step-btn" class="btn btn-secondary">Previous</button><button id="next-step-btn" class="btn btn-primary">Next Step</button></div></div></div>`,
        step: {
            'm1s1':{title:"Must-Win Battle", requiredFields:['m1s1_battle'], html:`<div class="content-card p-8"><h3 class="text-xl font-bold mb-1 gails-red-text">Step 1: The Must-Win Battle</h3><p class="text-gray-600 mb-4">What is the single most important, measurable outcome for this month?</p><textarea id="m1s1_battle" class="form-input" rows="3" placeholder="Example: 'Achieve >80% availability by implementing the production matrix correctly and placing smart orders.'"></textarea></div>`},
            'm1s2':{title:"Levers & Power-Up", requiredFields:['m1s2_levers', 'm1s2_powerup_q', 'm1s2_powerup_a'], html:`<div class="content-card p-8"><h3 class="text-xl font-bold mb-1 gails-red-text">Step 2: Key Levers & Team Power-Up</h3><p class="text-gray-600 mb-6">What actions will you take, and how will you involve your team?</p><div class="grid grid-cols-1 md:grid-cols-2 gap-6"><div class="flex flex-col"><label for="m1s2_levers" class="font-semibold block mb-2">My Key Levers (The actions I will own):</label><textarea id="m1s2_levers" class="form-input flex-grow" rows="4" placeholder="1. Review ordering report with daily.\n2. Coach the team on the 'why' behind the production matrix."></textarea></div><div class="space-y-4"><div><label for="m1s2_powerup_q" class="font-semibold block mb-2">Team Power-Up Question:</label><textarea id="m1s2_powerup_q" class="form-input" rows="2" placeholder="e.g., 'What is one thing that slows us down before 8am?'"></textarea></div><div><label for="m1s2_powerup_a" class="font-semibold block mb-2">Our Team's Winning Idea:</label><textarea id="m1s2_powerup_a" class="form-input" rows="2" placeholder="e.g., Pre-portioning key ingredients the night before."></textarea></div></div></div></div>`},
            'm1s3':{title:"People Growth", requiredFields:['m1s3_people'], html:`<div class="content-card p-8"><h3 class="text-xl font-bold mb-1 gails-red-text">Step 3: People Growth</h3><p class="text-gray-600 mb-4">Who will I invest in this month to help us win our battle, and how?</p><textarea id="m1s3_people" class="form-input" rows="4" placeholder="Example: 'Sarah: Coach on the production matrix to build her confidence.'"></textarea></div>`},
            'm1s4':{
                title:"Protect the Core",
                requiredFields:['m1s4_people', 'm1s4_product', 'm1s4_customer', 'm1s4_place'],
                html:`<div class="content-card p-8"><h3 class="text-xl font-bold mb-1 gails-red-text">Step 4: Protect the Core</h3><p class="text-gray-600 mb-6">One key behaviour you will protect for each pillar to ensure standards don't slip.</p><div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <div><label for="m1s4_people" class="font-semibold block mb-2">PEOPLE 👥</label><textarea id="m1s4_people" class="form-input" rows="2" placeholder="e.g., Meaningful 1-2-1s with my two keyholders."></textarea></div>
                    <div><label for="m1s4_product" class="font-semibold block mb-2">PRODUCT 🥐</label><textarea id="m1s4_product" class="form-input" rows="2" placeholder="e.g., Daily quality checks of the first bake."></textarea></div>
                    <div><label for="m1s4_customer" class="font-semibold block mb-2">CUSTOMER ❤️</label><textarea id="m1s4_customer" class="form-input" rows="2" placeholder="e.g., Action all customer feedback within 24 hours."></textarea></div>
                    <div><label for="m1s4_place" class="font-semibold block mb-2">PLACE 🏡</label><textarea id="m1s4_place" class="form-input" rows="2" placeholder="e.g., Complete a bakery travel path twice a day."></textarea></div>
                </div></div>`
            },
            'm1s5':{
                title:"Weekly Check-in",
                requiredFields:[],
                html:`<div class="content-card p-8"><h3 class="text-xl font-bold mb-1 gails-red-text">Step 5: Weekly Momentum Check</h3><p class="text-gray-600 mb-6">A 5-minute pulse check each Friday to maintain focus and celebrate wins.</p><div class="space-y-6">
                    ${[1,2,3,4].map(w => `<div class="border-t border-gray-200 pt-4"><h4 class="font-bold text-lg mb-4">Week ${w}</h4><div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        <div><label class="font-semibold block mb-2 text-sm">Progress:</label><div class="flex items-center space-x-2 status-buttons" data-week="${w}"><button class="status-button" data-status="on-track">ON TRACK</button><button class="status-button" data-status="issues">ISSUES</button><button class="status-button" data-status="off-track">OFF TRACK</button></div></div>
                        <div><label for="m1s5_w${w}_win" class="font-semibold block mb-2 text-sm">A Win or Learning:</label><textarea id="m1s5_w${w}_win" class="form-input text-sm" rows="2" placeholder="e.g., The team hit 80% availability on Thursday!"></textarea></div>
                        <div class="md:col-span-2"><label for="m1s5_w${w}_spotlight" class="font-semibold block mb-2 text-sm">Team Member Spotlight:</label><textarea id="m1s5_w${w}_spotlight" class="form-input text-sm" rows="2" placeholder="e.g., Sarah for her excellent attention to detail during the bake."></textarea></div>
                    </div></div>`).join("")}
                </div></div>`
            },
            'm1s6':{title:"End of Month Review", requiredFields:['m1s6_win', 'm1s6_challenge', 'm1s6_next'], html:`<div class="content-card p-8 bg-red-50 border border-red-100"><h3 class="text-xl font-bold mb-1 gails-red-text">Step 6: End of Month Review</h3><p class="text-gray-600 mb-6">Reflect on the month to prepare for your conversation with your line manager.</p><div class="space-y-6">
                <div><label for="m1s6_win" class="font-semibold block mb-1 text-lg gails-red-text">🎉 Biggest Win:</label><textarea id="m1s6_win" class="form-input" rows="2"></textarea></div>
                <div><label for="m1s6_challenge" class="font-semibold block mb-1 text-lg gails-red-text">🤔 Toughest Challenge & What I Learned:</label><textarea id="m1s6_challenge" class="form-input" rows="2"></textarea></div>
                <div><label for="m1s6_next" class="font-semibold block mb-1 text-lg gails-red-text">🚀 What's Next (Focus for Next Month):</label><textarea id="m1s6_next" class="form-input" rows="2"></textarea></div>
                </div></div>`},
            'm2s1':{},'m2s2':{},'m2s3':{},'m2s4':{},'m2s5':{},'m2s6':{},
            'm3s1':{},'m3s2':{},'m3s3':{},'m3s4':{},'m3s5':{},'m3s6':{},
            'm3s7':{title:"Quarterly Reflection", requiredFields:['m3s7_achievements', 'm3s7_challenges', 'm3s7_narrative', 'm3s7_next_quarter'], html:`<div class="content-card p-8" style="background-color: var(--review-blue-bg); border-color: var(--review-blue-border);"><h3 class="text-xl font-bold mb-1" style="color: var(--review-blue-text);">Step 7: Final Quarterly Reflection</h3><p class="text-gray-600 mb-6">A deep dive into the whole quarter's performance to prepare for your review with your line manager.</p><div class="space-y-6">
                <div><label for="m3s7_achievements" class="font-semibold block mb-1 text-lg" style="color: var(--review-blue-text);">🏆 What were the quarter's biggest achievements?</label><textarea id="m3s7_achievements" class="form-input" rows="3" placeholder="Consider financial results, team growth, customer feedback, and process improvements."></textarea></div>
                <div><label for="m3s7_challenges" class="font-semibold block mb-1 text-lg" style="color: var(--review-blue-text);">🧗 What were the biggest challenges and what did you learn?</label><textarea id="m3s7_challenges" class="form-input" rows="3" placeholder="What didn't go to plan? What were the key takeaways?"></textarea></div>
                <div><label for="m3s7_narrative" class="font-semibold block mb-1 text-lg" style="color: var(--review-blue-text);">🎯 How did you perform against the quarterly narrative?</label><textarea id="m3s7_narrative" class="form-input" rows="3" placeholder="Review the 'Central Theme' you set in the Vision section. How well did you deliver on it?"></textarea></div>
                <div><label for="m3s7_next_quarter" class="font-semibold block mb-1 text-lg" style="color: var(--review-blue-text);">🚀 What is the primary focus for next quarter?</label><textarea id="m3s7_next_quarter" class="form-input" rows="3" placeholder="Based on your learnings, what is the 'must-win battle' for the next 90 days?"></textarea></div>
                </div></div>`}
        }
    };

    // --- AUTHENTICATION & APP FLOW ---
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // A user is authenticated. Keep the loading screen, hide login.
            DOMElements.loginView.classList.add('hidden');
            DOMElements.resetView.classList.add('hidden');
            
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
            
            // Hide the initial loading screen now that content is ready.
            DOMElements.initialLoadingView.classList.add('hidden');

        } else {
            // No user is logged in. Hide loading and show the login page.
            appState.currentUser = null;
            appState.planData = {};
            appState.currentPlanId = null;
            clearActivityListeners();
            
            DOMElements.initialLoadingView.classList.add('hidden');
            DOMElements.appView.classList.add('hidden');
            DOMElements.dashboardView.classList.add('hidden');
            DOMElements.resetView.classList.add('hidden');
            DOMElements.loginView.classList.remove('hidden');
        }
    });

    const handleLogout = (isTimeout = false) => {
        // When logging out, clear the saved plan from localStorage
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
                            <div class="flex justify-between items-center"><span class="font-semibold text-gray-600">Completion:</span><span class="font-bold gails-red-text">${completion}%</span></div>
                        </div>
                    </div>
                </div>`;
        });

        dashboardHTML += `<div class="plan-card new-plan-card" id="create-new-plan-btn"><i class="bi bi-plus-circle-dotted text-4xl"></i><p class="mt-2 font-semibold">Create New Plan</p></div></div>`;
        DOMElements.dashboardContent.innerHTML = dashboardHTML;
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
        // When going back to dashboard, clear the saved plan from localStorage
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
            await docRef.set({ ...appState.planData, lastEdited: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            
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

    function isStepComplete(stepKey, data) {
        const planData = data || appState.planData;
        const stepDefinition = templates.step[stepKey] || (stepKey === 'vision' ? templates.vision : null);
        if (!stepDefinition) return false;

        if (stepKey.endsWith('s5')) {
            const monthNum = stepKey.charAt(1);
            for (let w = 1; w <= 4; w++) {
                const winFilled = planData[`m${monthNum}s5_w${w}_win`] && planData[`m${monthNum}s5_w${w}_win`].trim() !== '';
                const spotlightFilled = planData[`m${monthNum}s5_w${w}_spotlight`] && planData[`m${monthNum}s5_w${w}_spotlight`].trim() !== '';
                const statusSelected = !!planData[`m${monthNum}s5_w${w}_status`];
                if (!winFilled || !spotlightFilled || !statusSelected) return false;
            }
            return true;
        }

        const fields = stepDefinition.requiredFields;
        if (!fields || fields.length === 0) return false;
        return fields.every(fieldId => {
            const value = planData[fieldId];
            return value && value.trim() !== '';
        });
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
                const replacementRegex = new RegExp(`id="${sourceStepKey}`, 'g');
                const replacementRegexFor = new RegExp(`for="${sourceStepKey}`, 'g');
                let newHtml = sourceStep.html.replace(replacementRegex, `id="${targetStepKey}`);
                newHtml = newHtml.replace(replacementRegexFor, `for="${targetStepKey}`);
                templates.step[targetStepKey] = {
                    ...sourceStep,
                    html: newHtml,
                    requiredFields: sourceStep.requiredFields.map(field => field.replace(sourceStepKey, targetStepKey))
                };
            }
        }
    }

    function populateViewWithData() {
        document.querySelectorAll('#app-view input, #app-view textarea').forEach(el => {
            el.value = appState.planData[el.id] || '';
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
    }

    function switchView(viewId) {
        appState.currentView = viewId;
        
        // Persist the user's location in the app
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
            DOMElements.printBtn.classList.remove('hidden');
            renderSummary();
        } else {
            DOMElements.printBtn.classList.add('hidden');
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
    }

    function renderStep(stepNum) {
        const monthKey = appState.currentView;
        appState.monthContext[monthKey].currentStep = stepNum;
        const monthNum = monthKey.split('-')[1];
        const stepKey = `m${monthNum}s${stepNum}`;

        document.getElementById('step-content-container').innerHTML = templates.step[stepKey].html;

        populateViewWithData();
        renderStepper(stepNum);
        
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
            item.innerHTML = `<div class="flex flex-col items-center mr-4"><div class="step-circle w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"><span class="step-number">${i}</span></div>${i < totalSteps ? '<div class="step-line w-0.5 h-16 mt-2"></div>' : ''}</div><div><p class="step-label font-medium text-gray-500">${templates.step[stepKey].title}</p></div>`;
            item.addEventListener('click', () => renderStep(i));
            stepperNav.appendChild(item);
        }
    }

    function renderSummary() {
        const formData = appState.planData;
        const e = (text) => (text || '...').replace(/\n/g, '<br>');

        const renderMonthSummary = (monthNum) => {
            let weeklyCheckinHTML = '';
            for (let w = 1; w <= 4; w++) {
                const statusKey = `m${monthNum}s5_w${w}_status`;
                const status = formData[statusKey] || 'N/A';
                const statusColors = { 'on-track': 'bg-green-100 text-green-800', 'issues': 'bg-yellow-100 text-yellow-800', 'off-track': 'bg-red-100 text-red-800', 'N/A': 'bg-gray-100 text-gray-800'};
                const statusBadge = `<span class="text-xs font-semibold ml-2 px-2 py-0.5 rounded-full capitalize ${statusColors[status] || statusColors['N/A']}">${status.replace('-', ' ')}</span>`;
                weeklyCheckinHTML += `<div class="border-t pt-3 mt-3"><h5 class="font-bold text-sm">Week ${w}${statusBadge}</h5><div class="text-sm mt-2"><strong class="text-gray-600">Win/Learning:</strong> <span class="text-gray-800">${e(formData[`m${monthNum}s5_w${w}_win`])}</span></div><div class="text-sm mt-1"><strong class="text-gray-600">Spotlight:</strong> <span class="text-gray-800">${e(formData[`m${monthNum}s5_w${w}_spotlight`])}</span></div></div>`;
            }

            return `<div class="content-card p-6 mt-8">
                <h2 class="text-2xl font-bold gails-red-text mb-4">Month ${monthNum} Sprint</h2>
                <div class="space-y-6">
                    <div><h3 class="font-bold border-b pb-2 mb-2">Must-Win Battle</h3><p class="text-gray-700 whitespace-pre-wrap">${e(formData[`m${monthNum}s1_battle`])}</p></div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                        <div><h4 class="font-semibold text-gray-800">Key Levers</h4><p class="text-sm text-gray-700 whitespace-pre-wrap mt-1">${e(formData[`m${monthNum}s2_levers`])}</p></div>
                        <div><h4 class="font-semibold text-gray-800">People Growth</h4><p class="text-sm text-gray-700 whitespace-pre-wrap mt-1">${e(formData[`m${monthNum}s3_people`])}</p></div>
                        <div class="col-span-1"><h4 class="font-semibold text-gray-800">Team Power-Up Question</h4><p class="text-sm text-gray-700 whitespace-pre-wrap mt-1">${e(formData[`m${monthNum}s2_powerup_q`])}</p></div>
                        <div class="col-span-1"><h4 class="font-semibold text-gray-800">Team's Winning Idea</h4><p class="text-sm text-gray-700 whitespace-pre-wrap mt-1">${e(formData[`m${monthNum}s2_powerup_a`])}</p></div>
                    </div>
                    <div><h3 class="font-bold border-b pb-2 mb-2">Protect the Core Behaviours</h3><div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                        <div><strong class="text-gray-600 block">👥 People</strong><span class="text-gray-800">${e(formData[`m${monthNum}s4_people`])}</span></div>
                        <div><strong class="text-gray-600 block">🥐 Product</strong><span class="text-gray-800">${e(formData[`m${monthNum}s4_product`])}</span></div>
                        <div><strong class="text-gray-600 block">❤️ Customer</strong><span class="text-gray-800">${e(formData[`m${monthNum}s4_customer`])}</span></div>
                        <div><strong class="text-gray-600 block">🏡 Place</strong><span class="text-gray-800">${e(formData[`m${monthNum}s4_place`])}</span></div>
                    </div></div>
                    <div><h3 class="font-bold border-b pb-2 mb-2">Weekly Momentum Check</h3>${weeklyCheckinHTML}</div>
                    <div><h3 class="font-bold border-b pb-2 mb-2">End of Month Review</h3><div class="text-sm mt-2 space-y-2">
                        <p><strong class="font-medium text-gray-600">Biggest Win 🎉:</strong> <span class="text-gray-800">${e(formData[`m${monthNum}s6_win`])}</span></p>
                        <p><strong class="font-medium text-gray-600">Toughest Challenge 🤔:</strong> <span class="text-gray-800">${e(formData[`m${monthNum}s6_challenge`])}</span></p>
                        <p><strong class="font-medium text-gray-600">What's Next 🚀:</strong> <span class="text-gray-800">${e(formData[`m${monthNum}s6_next`])}</span></p>
                    </div></div>
                </div></div>`;
        };

        DOMElements.contentArea.innerHTML = `
            <div class="space-y-8 summary-content">
                <div class="content-card p-6">
                    <h2 class="text-2xl font-bold gails-red-text mb-4">Quarterly Vision & Sprints</h2>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-4 mb-4">
                        <div><h4 class="font-semibold text-sm text-gray-500">Manager</h4><p class="text-gray-800 font-medium">${e(formData.managerName)}</p></div>
                        <div><h4 class="font-semibold text-sm text-gray-500">Bakery</h4><p class="text-gray-800 font-medium">${e(formData.bakeryLocation)}</p></div>
                        <div><h4 class="font-semibold text-sm text-gray-500">Quarter</h4><p class="text-gray-800 font-medium">${e(formData.quarter)}</p></div>
                    </div>
                    <div class="mb-6"><h4 class="font-semibold text-sm text-gray-500">Quarterly Theme</h4><p class="text-gray-800 whitespace-pre-wrap">${e(formData.quarterlyTheme)}</p></div>
                    <div><h3 class="text-lg font-bold border-b pb-2 mb-3">Proposed Monthly Sprints</h3><div class="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                        <div><strong class="font-semibold text-gray-600 block">Month 1 Goal:</strong><p class="text-gray-800 mt-1 whitespace-pre-wrap">${e(formData.month1Goal)}</p></div>
                        <div><strong class="font-semibold text-gray-600 block">Month 2 Goal:</strong><p class="text-gray-800 mt-1 whitespace-pre-wrap">${e(formData.month2Goal)}</p></div>
                        <div><strong class="font-semibold text-gray-600 block">Month 3 Goal:</strong><p class="text-gray-800 mt-1 whitespace-pre-wrap">${e(formData.month3Goal)}</p></div>
                    </div></div>
                </div>
                ${renderMonthSummary(1)}
                ${renderMonthSummary(2)}
                ${renderMonthSummary(3)}
                <div class="content-card p-6 mt-8" style="background-color: var(--review-blue-bg); border-color: var(--review-blue-border);">
                    <h2 class="text-2xl font-bold mb-4" style="color: var(--review-blue-text);">Final Quarterly Reflection</h2>
                    <div class="space-y-4">
                        <div><h3 class="font-bold text-lg" style="color: var(--review-blue-text);">🏆 Biggest Achievements</h3><p class="text-gray-700 whitespace-pre-wrap mt-1">${e(formData.m3s7_achievements)}</p></div>
                        <div><h3 class="font-bold text-lg" style="color: var(--review-blue-text);">🧗 Biggest Challenges & Learnings</h3><p class="text-gray-700 whitespace-pre-wrap mt-1">${e(formData.m3s7_challenges)}</p></div>
                        <div><h3 class="font-bold text-lg" style="color: var(--review-blue-text);">🎯 Performance vs Narrative</h3><p class="text-gray-700 whitespace-pre-wrap mt-1">${e(formData.m3s7_narrative)}</p></div>
                        <div><h3 class="font-bold text-lg" style="color: var(--review-blue-text);">🚀 Focus For Next Quarter</h3><p class="text-gray-700 whitespace-pre-wrap mt-1">${e(formData.m3s7_next_quarter)}</p></div>
                    </div>
                </div>
            </div>`;
    }

    // --- Modal Management ---
    const handleEscKey = (event) => {
        if (event.key === 'Escape') {
            closeModal();
        }
    };
    
    function openModal(type, context = {}) {
        const { planId, currentName, planName } = context;
        DOMElements.modalBox.dataset.type = type;
        DOMElements.modalBox.dataset.planId = planId;

        const handleEnterKey = (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleModalAction();
            }
        };

        switch (type) {
            case 'create':
                DOMElements.modalTitle.textContent = "Create New Plan";
                DOMElements.modalContent.innerHTML = `
                    <label for="newPlanName" class="font-semibold block mb-2">Plan Name:</label>
                    <input type="text" id="newPlanName" class="form-input" placeholder="e.g., Q4 2025 Focus" value="New Plan ${new Date().toLocaleDateString('en-GB')}">
                    <div id="modal-error-container" class="modal-error-container"></div>
                `;
                DOMElements.modalActionBtn.textContent = "Create Plan";
                DOMElements.modalActionBtn.className = 'btn btn-primary';
                DOMElements.modalCancelBtn.style.display = 'inline-flex';
                const newPlanNameInput = document.getElementById('newPlanName');
                newPlanNameInput.addEventListener('keyup', handleEnterKey);
                newPlanNameInput.addEventListener('input', () => {
                    newPlanNameInput.classList.remove('input-error');
                    const errorContainer = document.getElementById('modal-error-container');
                    if (errorContainer) {
                        errorContainer.innerHTML = '';
                    }
                });
                break;
            case 'edit':
                DOMElements.modalTitle.textContent = "Edit Plan Name";
                DOMElements.modalContent.innerHTML = `<label for="editPlanName" class="font-semibold block mb-2">Plan Name:</label><input type="text" id="editPlanName" class="form-input" value="${currentName}">`;
                DOMElements.modalActionBtn.textContent = "Save Changes";
                DOMElements.modalActionBtn.className = 'btn btn-primary';
                DOMElements.modalCancelBtn.style.display = 'inline-flex';
                document.getElementById('editPlanName').addEventListener('keyup', handleEnterKey);
                break;
            case 'delete':
                DOMElements.modalTitle.textContent = "Confirm Deletion";
                DOMElements.modalContent.innerHTML = `<p>Are you sure you want to permanently delete the plan: <strong class="font-bold">${planName}</strong>?</p><p class="mt-2 text-sm text-red-700 bg-red-100 p-3 rounded-lg">This action is final and cannot be undone.</p>`;
                DOMElements.modalActionBtn.textContent = "Confirm Delete";
                DOMElements.modalActionBtn.className = 'btn btn-primary bg-red-600 hover:bg-red-700';
                DOMElements.modalCancelBtn.style.display = 'inline-flex';
                break;
            case 'timeout':
                DOMElements.modalTitle.textContent = "Session Timed Out";
                DOMElements.modalContent.innerHTML = `<p>For your security, you have been logged out due to inactivity. All of your progress has been saved.</p>`;
                DOMElements.modalActionBtn.textContent = "OK";
                DOMElements.modalActionBtn.className = 'btn btn-primary';
                DOMElements.modalCancelBtn.style.display = 'none'; // Hide cancel button
                break;
        }
        DOMElements.modalOverlay.classList.remove('hidden');
        window.addEventListener('keydown', handleEscKey);
        const input = DOMElements.modalBox.querySelector('input');
        if(input) {
            input.focus();
            input.select();
        }
    }

    function closeModal() {
        if (DOMElements.modalBox.dataset.type === 'timeout') {
            DOMElements.modalOverlay.classList.add('hidden');
            window.removeEventListener('keydown', handleEscKey);
            // The user is already logged out, so no further action is needed.
            // The auth state change will handle showing the login screen.
        } else {
            DOMElements.modalOverlay.classList.add('hidden');
            window.removeEventListener('keydown', handleEscKey);
        }
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
                DOMElements.authError.textContent = error.message;
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


    DOMElements.registerBtn.addEventListener('click', () => {
        DOMElements.authError.style.display = 'none';
        auth.createUserWithEmailAndPassword(DOMElements.emailInput.value, DOMElements.passwordInput.value)
            .catch(error => {
                DOMElements.authError.textContent = error.message;
                DOMElements.authError.style.display = 'block';
            });
    });

    DOMElements.forgotPasswordBtn.addEventListener('click', (e) => {
        e.preventDefault();
        DOMElements.loginView.classList.add('hidden');
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
    DOMElements.contentArea.addEventListener('input', (e) => { if (e.target.matches('input, textarea')) { saveData(); }});
    DOMElements.contentArea.addEventListener('click', (e) => { const target = e.target; if (target.closest('.status-button')) { const button = target.closest('.status-button'); const alreadySelected = button.classList.contains('selected'); button.parentElement.querySelectorAll('.status-button').forEach(btn => btn.classList.remove('selected')); if (!alreadySelected) button.classList.add('selected'); saveData(); }});
    DOMElements.printBtn.addEventListener('click', () => window.print());

    DOMElements.modalCloseBtn.addEventListener('click', closeModal);
    DOMElements.modalCancelBtn.addEventListener('click', closeModal);
    DOMElements.modalOverlay.addEventListener('mousedown', (e) => {
        if (e.target === DOMElements.modalOverlay) {
            closeModal();
        }
    });
    DOMElements.modalActionBtn.addEventListener('click', handleModalAction);
    
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

    // --- INITIALIZE APP ---
    generateTemplates();

} 

// This is the new, single line that starts your entire application.
initializeFirebase();
