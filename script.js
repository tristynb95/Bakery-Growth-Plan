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
    
    // --- AUTHENTICATION, DASHBOARD, DATA HANDLING... (All these sections remain the same)

    // --- Replace the following functions in your existing file ---

    function handleSaveAsWord() {
        const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } = docx;
    
        const printableArea = document.getElementById('ai-printable-area');
        if (!printableArea) return;
    
        const docSections = [];
        const elements = Array.from(printableArea.children);
    
        elements.forEach(element => {
            if (element.tagName === 'H2') {
                docSections.push(new Paragraph({ text: element.innerText, heading: HeadingLevel.HEADING_2, spacing: { before: 400, after: 200 } }));
            }
    
            if (element.tagName === 'TABLE') {
                const tableRows = [];
                const htmlRows = Array.from(element.querySelectorAll('tr'));
    
                htmlRows.forEach(htmlRow => {
                    const tableCells = [];
                    const htmlCells = Array.from(htmlRow.children);
    
                    htmlCells.forEach(htmlCell => {
                        tableCells.push(
                            new TableCell({
                                children: [new Paragraph({ text: htmlCell.innerText })],
                            })
                        );
                    });
    
                    tableRows.push(new TableRow({ children: tableCells }));
                });
    
                const docxTable = new Table({
                    rows: tableRows,
                    width: {
                        size: 100,
                        type: WidthType.PERCENTAGE,
                    },
                });
                docSections.push(docxTable);
            }
        });
    
        const doc = new Document({
            sections: [{
                children: docSections,
            }],
        });
    
        Packer.toBlob(doc).then(blob => {
            saveAs(blob, "AI-Generated Action Plan.docx");
        });
    }

    async function handleAIActionPlan() {
        openModal('aiActionPlan');
        const savedPlan = appState.planData.aiActionPlan;

        if (savedPlan) {
            openModal('aiActionPlan_view');
            const modalContent = document.getElementById('modal-content');
            modalContent.innerHTML = `<div id="ai-printable-area" contenteditable="true" class="editable-action-plan">${savedPlan}</div>`;
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
                    const errorResult = await response.json();
                    throw new Error(errorResult.error || 'The AI assistant failed to generate a response.');
                }

                const data = await response.json();
                appState.planData.aiActionPlan = data.actionPlan;
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
    
    async function saveActionPlan() {
        const editedContent = document.getElementById('ai-printable-area').innerHTML;
        appState.planData.aiActionPlan = editedContent;
        await saveData(true);
        closeModal();
    }
    
    function handleRegenerateActionPlan() {
        const modalContent = document.getElementById('modal-content');
        modalContent.innerHTML = `
            <div class="p-4 text-center">
                <h4 class="font-bold text-lg">Are you sure?</h4>
                <p class="text-gray-600 mt-2">Generating a new plan will overwrite your existing action plan and any edits you've made. This cannot be undone.</p>
            </div>
        `;
    
        DOMElements.modalActionBtn.textContent = "Yes, Generate New Plan";
        DOMElements.modalActionBtn.className = 'btn btn-primary bg-red-600 hover:bg-red-700';
        DOMElements.modalActionBtn.onclick = async () => {
            delete appState.planData.aiActionPlan;
            await saveData(true);
            handleAIActionPlan();
        };
    
        DOMElements.modalCancelBtn.textContent = "Cancel";
        DOMElements.modalCancelBtn.onclick = handleAIActionPlan;
    }

    function openModal(type, context = {}) {
        const { planId, currentName, planName } = context;
        DOMElements.modalBox.dataset.type = type;
        DOMElements.modalBox.dataset.planId = planId;
    
        // Clean up footer from previous modal instances
        const footer = DOMElements.modalActionBtn.parentNode;
        footer.querySelectorAll('.dynamic-btn').forEach(btn => btn.remove());
        DOMElements.modalActionBtn.style.display = 'inline-flex';
        DOMElements.modalCancelBtn.style.display = 'inline-flex';
    
        switch (type) {
            // ... (keep cases for 'create', 'edit', 'delete', 'timeout', 'sharing')
            case 'aiActionPlan_generate':
                DOMElements.modalTitle.textContent = "AI Action Plan";
                DOMElements.modalContent.innerHTML = `<div class="flex items-center justify-center p-8"><div class="loading-spinner"></div><p class="ml-4 text-gray-600">Your AI assistant is building your plan...</p></div>`;
                DOMElements.modalActionBtn.style.display = 'none';
                DOMElements.modalCancelBtn.textContent = 'Cancel';
                break;
            case 'aiActionPlan_view':
                DOMElements.modalTitle.textContent = "Edit Your Action Plan";
                
                const regenButton = document.createElement('button');
                regenButton.className = 'btn btn-secondary dynamic-btn';
                regenButton.innerHTML = `<i class="bi bi-stars"></i> Generate New`;
                regenButton.onclick = handleRegenerateActionPlan;
    
                const saveWordBtn = document.createElement('button');
                saveWordBtn.className = 'btn btn-secondary dynamic-btn';
                saveWordBtn.innerHTML = 'Save as Word';
                saveWordBtn.onclick = handleSaveAsWord;

                const printBtn = document.createElement('button');
                printBtn.className = 'btn btn-secondary dynamic-btn';
                printBtn.innerHTML = 'Print Plan';
                printBtn.onclick = () => { /* your existing print logic */ };

                footer.insertBefore(regenButton, DOMElements.modalActionBtn);
                footer.insertBefore(saveWordBtn, DOMElements.modalActionBtn);
                footer.insertBefore(printBtn, DOMElements.modalActionBtn);
                
                DOMElements.modalActionBtn.textContent = "Save Changes";
                DOMElements.modalActionBtn.className = 'btn btn-primary';
                DOMElements.modalActionBtn.onclick = saveActionPlan;
                DOMElements.modalCancelBtn.textContent = 'Close';
                break;
        }
        DOMElements.modalOverlay.classList.remove('hidden');
    }
    
    function closeModal() {
        document.querySelectorAll('.dynamic-btn').forEach(btn => btn.remove());
        DOMElements.modalActionBtn.onclick = handleModalAction;
        DOMElements.modalCancelBtn.onclick = closeModal;
        DOMElements.modalActionBtn.style.display = 'inline-flex';
        DOMElements.modalOverlay.classList.add('hidden');
    }

    // --- Make sure to keep the rest of your script.js file from here downwards ---
    // (handleModalAction, all event listeners, etc.)
}
