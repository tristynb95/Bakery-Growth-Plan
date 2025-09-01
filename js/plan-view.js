// js/plan-view.js

// Dependencies passed from main.js
let db, appState, openModal, initializeCharCounters;

// --- DOM Element References ---
const DOMElements = {
    appView: document.getElementById('app-view'),
    contentArea: document.getElementById('content-area'),
    mainNav: document.getElementById('main-nav'),
    headerTitle: document.getElementById('header-title'),
    headerSubtitle: document.getElementById('header-subtitle'),
    sidebarName: document.getElementById('sidebar-name'),
    sidebarBakery: document.getElementById('sidebar-bakery'),
    sidebarInitials: document.getElementById('sidebar-initials'),
    progressBarFill: document.getElementById('progress-bar-fill'),
    progressPercentage: document.getElementById('progress-percentage'),
    backToDashboardBtn: document.getElementById('back-to-dashboard-btn'),
    sidebarLogoutBtn: document.getElementById('sidebar-logout-btn'),
    printBtn: document.getElementById('print-btn'),
    shareBtn: document.getElementById('share-btn'),
    aiActionBtn: document.getElementById('ai-action-btn'),
    desktopHeaderButtons: document.getElementById('desktop-header-buttons'),
    saveIndicator: document.getElementById('save-indicator'),
};

// --- HTML Templates for Views ---
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
                                <div id="m${monthNum}s2_levers" class="form-input is-placeholder-showing flex-grow key-levers-input" contenteditable="true" data-placeholder="1. Daily: Review the production report from yesterday to adjust today's baking.&#10;2. Lead a 'Coffee calibration' session in the management meeting &#10;3. Ongoing: Coach one team member daily on a specific SHINE principle." data-maxlength="600"></div>
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
                            ${[1, 2, 3, 4].map(w => `<a href="#" class="weekly-tab ${w === 1 ? 'active' : ''}" data-week="${w}">Week ${w}</a>`).join('')}
                        </nav>
                    </div>
                    <div id="weekly-tab-content">
                        ${[1, 2, 3, 4].map(w => `
                            <div class="weekly-tab-panel ${w !== 1 ? 'hidden' : ''}" data-week-panel="${w}">
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                                    <div class="md:col-span-2"><label class="font-semibold block mb-3 text-gray-700">Progress:</label><div class="flex items-center space-x-2 status-buttons" data-week="${w}"><button class="status-button" data-status="on-track">ON TRACK</button><button class="status-button" data-status="issues">ISSUES</button><button class="status-button" data-status="off-track">OFF TRACK</button></div></div>
                                    <div><label for="m${monthNum}s5_w${w}_win" class="font-semibold block mb-2 text-gray-700">A Win or Learning:</label><div id="m${monthNum}s5_w${w}_win" class="form-input text-sm is-placeholder-showing weekly-check-in-input" contenteditable="true" data-placeholder="e.g., The team hit 80% availability on Thursday!" data-maxlength="400"></div></div>
                                    <div><label for="m${monthNum}s5_w${w}_spotlight" class="font-semibold block mb-2 text-gray-700">Breadhead Spotlight:</label><div id="m${monthNum}s5_w${w}_spotlight" class="form-input text-sm is-placeholder-showing weekly-check-in-input" contenteditable="true" data-placeholder="e.g., Sarah, for making a customer's day by remembering their name and usual order—a perfect example of our SHINE values." data-maxlength="400"></div></div>
                                    <div class="md:col-span-2"><label for="m${monthNum}s5_w${w}_shine" class="font-semibold block mb-2 text-gray-700">This Week's SHINE Focus:</label><div id="m${monthNum}s5_w${w}_shine" class="form-input text-sm is-placeholder-showing weekly-check-in-input" contenteditable="true" data-placeholder="e.g., Ensuring every customer is greeted within 30 seconds." data-maxlength="400"></div></div>
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

// --- Data Handling & Saving ---

function saveData(forceImmediate = false, directPayload = null) {
    if (!appState.currentUser || !appState.currentPlanId) return Promise.resolve();
    
    const localChanges = {};
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
            localChanges[dataKey] = Array.from(selectedButtons).map(btn => btn.dataset.pillar);
        } else {
            localChanges[dataKey] = firebase.firestore.FieldValue.delete();
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
                localChanges[key] = firebase.firestore.FieldValue.delete();
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
    
    if (directPayload) {
        for (const key in directPayload) {
            if (directPayload[key] !== appState.planData[key]) {
                changedData[key] = directPayload[key];
                hasChanges = true;
            }
        }
    }

    if (!hasChanges) return Promise.resolve();
    
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

// --- UI Rendering & Updates ---

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
        const pillars = appState.planData[dataKey] || [];
        group.querySelectorAll('.selected').forEach(s => s.classList.remove('selected'));
        pillars.forEach(pillar => {
            const buttonToSelect = group.querySelector(`[data-pillar="${pillar}"]`);
            if (buttonToSelect) buttonToSelect.classList.add('selected');
        });
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

function updateUI() {
    updateSidebarInfo();
    // updateOverallProgress(); // This logic can be moved here if needed
}

function switchView(viewId) {
    appState.currentView = viewId;
    localStorage.setItem('lastPlanId', appState.currentPlanId);
    localStorage.setItem('lastViewId', viewId);

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
        // renderSummary(); // This function would need to be moved here as well
    } else {
        DOMElements.desktopHeaderButtons.classList.add('hidden');
        const monthNum = viewId.startsWith('month-') ? viewId.split('-')[1] : null;
        DOMElements.contentArea.innerHTML = monthNum ? templates.month(monthNum) : templates.vision.html;
        populateViewWithData();
    }

    document.querySelectorAll('#main-nav a').forEach(a => a.classList.remove('active'));
    document.querySelector(`#nav-${viewId}`)?.classList.add('active');
    
    if (initializeCharCounters) {
        initializeCharCounters();
    }
}

// --- Main Functions ---

export function showPlanView(planId) {
    appState.currentPlanId = planId;
    DOMElements.appView.classList.remove('hidden');
    
    if (appState.planUnsubscribe) appState.planUnsubscribe();

    const planDocRef = db.collection("users").doc(appState.currentUser.uid).collection("plans").doc(planId);
    
    appState.planUnsubscribe = planDocRef.onSnapshot((doc) => {
        if (doc.exists) {
            const remoteData = doc.data();
            if (JSON.stringify(remoteData) !== JSON.stringify(appState.planData)) {
                appState.planData = remoteData;
                updateUI();
                if(appState.currentView !== 'summary') {
                    populateViewWithData();
                }
            }
        } else {
            console.error("Plan document not found!");
            document.dispatchEvent(new CustomEvent('back-to-dashboard'));
        }
    });

    switchView('vision');
}

export function initializePlanView(database, state, modalFunc, charCounterFunc) {
    db = database;
    appState = state;
    openModal = modalFunc;
    initializeCharCounters = charCounterFunc;

    // --- Event Listeners for the Plan View ---
    DOMElements.mainNav.addEventListener('click', (e) => {
        e.preventDefault();
        const navLink = e.target.closest('a');
        if (navLink) {
            switchView(navLink.id.replace('nav-', ''));
        }
    });

    DOMElements.contentArea.addEventListener('input', (e) => {
        if (e.target.matches('input, [contenteditable="true"]')) {
            saveData();
        }
    });

    DOMElements.contentArea.addEventListener('click', (e) => {
        const pillarButton = e.target.closest('.pillar-button');
        if (pillarButton) {
            pillarButton.classList.toggle('selected');
            saveData(true);
            return;
        }
        const statusButton = e.target.closest('.status-button');
        if (statusButton) {
            const alreadySelected = statusButton.classList.contains('selected');
            statusButton.parentElement.querySelectorAll('.status-button').forEach(btn => btn.classList.remove('selected'));
            if (!alreadySelected) statusButton.classList.add('selected');
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
    
    DOMElements.backToDashboardBtn.addEventListener('click', () => {
         document.dispatchEvent(new CustomEvent('back-to-dashboard'));
    });

    DOMElements.sidebarLogoutBtn.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('logout-request'));
    });
}
