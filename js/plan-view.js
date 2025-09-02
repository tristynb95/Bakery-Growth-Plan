// js/plan-view.js

// Dependencies passed from main.js
let db, appState, openModal, initializeCharCounters, handleAIActionPlan, handleShare;

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

// --- Progress Calculation & Data Helpers ---

function isContentEmpty(htmlContent) {
    if (!htmlContent) return true;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    return tempDiv.innerText.trim() === '';
}

function getVisionProgress(planData) {
    const data = planData || appState.planData;
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
    return !!status && !isContentEmpty(win) && !isContentEmpty(spotlight) && !isContentEmpty(shine);
}

function getMonthProgress(monthNum, planData) {
    const data = planData || appState.planData;
    const requiredFields = [
        `m${monthNum}s1_battle`, `m${monthNum}s1_pillar`, `m${monthNum}s2_levers`,
        `m${monthNum}s2_powerup_q`, `m${monthNum}s2_powerup_a`, `m${monthNum}s3_people`,
        `m${monthNum}s4_people`, `m${monthNum}s4_product`, `m${monthNum}s4_customer`, `m${monthNum}s4_place`,
        `m${monthNum}s6_win`, `m${monthNum}s6_challenge`, `m${monthNum}s6_next`
    ];
    for (let w = 1; w <= 4; w++) {
        requiredFields.push(`m${monthNum}s5_w${w}_status`, `m${monthNum}s5_w${w}_win`, `m${monthNum}s5_w${w}_spotlight`, `m${monthNum}s5_w${w}_shine`);
    }
    if (monthNum == 3) {
        requiredFields.push('m3s7_achievements', 'm3s7_challenges', 'm3s7_narrative', 'm3s7_next_quarter');
    }
    const total = requiredFields.length;
    const completed = requiredFields.filter(field => !isContentEmpty(data[field])).length;
    return { completed, total };
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

export function summarizePlanForAI(planData) {
    const e = (text) => {
        if (!text) return '';
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = text;
        return tempDiv.innerText.trim();
    };

    let summary = `MANAGER: ${e(planData.managerName)}\n`;
    summary += `BAKERY: ${e(planData.bakeryLocation)}\n`;
    summary += `QUARTER: ${e(planData.quarter)}\n`;
    summary += `QUARTERLY VISION: ${e(planData.quarterlyTheme)}\n\n`;

    for (let m = 1; m <= 3; m++) {
        summary += `--- MONTH ${m} ---\n`;
        summary += `GOAL: ${e(planData[`month${m}Goal`])}\n`;
        
        const pillars = planData[`m${m}s1_pillar`];
        if (Array.isArray(pillars) && pillars.length > 0) {
            summary += `PILLAR FOCUS: ${pillars.join(', ')}\n`;
        }

        summary += `MUST-WIN BATTLE: ${e(planData[`m${m}s1_battle`])}\n`;
        summary += `KEY ACTIONS: ${e(planData[`m${m}s2_levers`])}\n`;
        summary += `TEAM POWER-UP QUESTION: ${e(planData[`m${m}s2_powerup_q`])}\n`;
        summary += `TEAM'S WINNING IDEA: ${e(planData[`m${m}s2_powerup_a`])}\n`;
        summary += `DEVELOPING OUR BREADHEADS: ${e(planData[`m${m}s3_people`])}\n`;
        summary += `UPHOLDING PILLARS (PEOPLE): ${e(planData[`m${m}s4_people`])}\n`;
        summary += `UPHOLDING PILLARS (PRODUCT): ${e(planData[`m${m}s4_product`])}\n`;
        summary += `UPHOLDING PILLARS (CUSTOMER): ${e(planData[`m${m}s4_customer`])}\n`;
        summary += `UPHOLDING PILLARS (PLACE): ${e(planData[`m${m}s4_place`])}\n\n`;
    }
    return summary;
}


// --- Data Handling & Saving ---

export function saveData(forceImmediate = false, directPayload = null) {
    if (!appState.currentUser || !appState.currentPlanId) return Promise.resolve();

    // If a direct payload is provided (e.g., for saving the AI plan), merge it into the state
    if (directPayload) {
        appState.planData = { ...appState.planData, ...directPayload };
    }
    
    // The state is already updated by the event listeners, so we just need to save it.
    // We add a check to see if there are any actual changes to save.
    // This is a simplified check; a more robust solution might involve deep-checking or tracking a 'dirty' flag.
    if (appState.isSaving) return Promise.resolve(); // Prevent concurrent saves

    clearTimeout(appState.saveTimeout);

    const saveToFirestore = async () => {
        appState.isSaving = true;
        const docRef = db.collection("users").doc(appState.currentUser.uid).collection("plans").doc(appState.currentPlanId);
        
        // Create a clean copy of the data to save, excluding any client-side only flags
        const dataToSave = { ...appState.planData };
        delete dataToSave.isSaving; // Example of a client-side flag

        await docRef.set({ // Using set with merge:true is often safer than update
            ...dataToSave,
            lastEdited: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        DOMElements.saveIndicator.classList.remove('opacity-0');
        setTimeout(() => DOMElements.saveIndicator.classList.add('opacity-0'), 2000);
        appState.isSaving = false;
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
    // Make sure placeholders are correct after populating data
    document.querySelectorAll('#app-view [contenteditable="true"]').forEach(el => {
        if (el.innerText.trim() === '') {
            el.classList.add('is-placeholder-showing');
        } else {
            el.classList.remove('is-placeholder-showing');
        }
    });
}

function updateViewWithRemoteData(remoteData) {
    if (appState.currentView === 'summary') {
        renderSummary(); // Re-render summary view on data change
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
        // Only update if the element is not currently focused by the user
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
        if (el.isContentEditable) {
            if (el.innerText.trim() === '') {
                el.classList.add('is-placeholder-showing');
            } else {
                el.classList.remove('is-placeholder-showing');
            }
        }
    });
    // This logic handles multi-select buttons like pillars
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
    // This logic handles single-select buttons like weekly status
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

function updateOverallProgress() {
    const percentage = calculatePlanCompletion(appState.planData);
    DOMElements.progressPercentage.textContent = `${percentage}%`;
    DOMElements.progressBarFill.style.width = `${percentage}%`;
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
    updateOverallProgress();
    updateSidebarNavStatus();
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
                if (!isContentEmpty(win)) checkinContent += `<p class="text-sm text-gray-600 mb-2"><strong>Win/Learning:</strong> ${e(win)}</p>`;
                if (!isContentEmpty(spotlight)) checkinContent += `<p class="text-sm text-gray-600 mb-2"><strong>Breadhead Spotlight:</strong> ${e(spotlight)}</p>`;
                if (!isContentEmpty(shine)) checkinContent += `<p class="text-sm text-gray-600"><strong>SHINE Focus:</strong> ${e(shine)}</p>`;
                if (checkinContent === '') checkinContent = '<p class="text-sm text-gray-500 italic">No details logged.</p>';

                weeklyCheckinHTML += `<li class="mb-3 pb-3 border-b last:border-b-0"><div class="flex justify-between items-center mb-2"><strong class="font-semibold text-gray-700">Week ${w}</strong>${statusBadgeHTML}</div>${checkinContent}</li>`;
            }
        }
        if (!hasLoggedWeeks) weeklyCheckinHTML = '<p class="text-sm text-gray-500">No weekly check-ins logged.</p>';
        else weeklyCheckinHTML += '</ul>';

        const pillars = formData[`m${monthNum}s1_pillar`];
        const pillarIcons = { 'people': 'bi-people-fill', 'product': 'bi-cup-hot-fill', 'customer': 'bi-heart-fill', 'place': 'bi-shop' };
        let pillarBadgesHTML = '';
        if (Array.isArray(pillars) && pillars.length > 0) {
            pillarBadgesHTML = pillars.map(p => `<span class="pillar-badge"><i class="bi ${pillarIcons[p]}"></i> ${p.charAt(0).toUpperCase() + p.slice(1)}</span>`).join('');
        }
        let pillarHTML = pillarBadgesHTML ? `<div class="flex items-center gap-2 mb-4 flex-wrap"><span class="font-semibold text-sm text-gray-500">Pillar Focus:</span>${pillarBadgesHTML}</div>` : '';

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
                    <div class="summary-section"><h3 class="summary-heading">Upholding Pillars</h3><ul class="space-y-3 mt-2"><li class="flex items-start text-sm"><i class="bi bi-people-fill w-5 text-center mr-3 text-gray-400"></i><span class="flex-1">${e(formData[`m${monthNum}s4_people`])}</span></li><li class="flex items-start text-sm"><i class="bi bi-cup-hot-fill w-5 text-center mr-3 text-gray-400"></i><span class="flex-1">${e(formData[`m${monthNum}s4_product`])}</span></li><li class="flex items-start text-sm"><i class="bi bi-heart-fill w-5 text-center mr-3 text-gray-400"></i><span class="flex-1">${e(formData[`m${monthNum}s4_customer`])}</span></li><li class="flex items-start text-sm"><i class="bi bi-shop w-5 text-center mr-3 text-gray-400"></i><span class="flex-1">${e(formData[`m${monthNum}s4_place`])}</span></li></ul></div>
                    <div class="summary-section"><h3 class="summary-heading">Weekly Momentum</h3>${weeklyCheckinHTML}</div>
                    <div class="summary-section"><h3 class="summary-heading">End of Month Review</h3><ul class="space-y-3 mt-2"><li class="flex items-start text-sm"><i class="bi bi-trophy-fill w-5 text-center mr-3 text-gray-400"></i><span class="flex-1"><strong>Win:</strong> ${e(formData[`m${monthNum}s6_win`])}</span></li><li class="flex items-start text-sm"><i class="bi bi-lightbulb-fill w-5 text-center mr-3 text-gray-400"></i><span class="flex-1"><strong>Challenge:</strong> ${e(formData[`m${monthNum}s6_challenge`])}</span></li><li class="flex items-start text-sm"><i class="bi bi-rocket-takeoff-fill w-5 text-center mr-3 text-gray-400"></i><span class="flex-1"><strong>Next:</strong> ${e(formData[`m${monthNum}s6_next`])}</span></li></ul></div>
                </div>
            </div>
        </div>`;
    };
    DOMElements.contentArea.innerHTML = `<div class="space-y-8 summary-content">
        <div class="content-card p-6"><h2 class="text-2xl font-bold font-poppins mb-4">Quarter Overview</h2><div class="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-4 mb-4"><div><h4 class="font-semibold text-sm text-gray-500">Manager</h4><p class="text-gray-800 font-medium">${formData.managerName || '...'}</p></div><div><h4 class="font-semibold text-sm text-gray-500">Bakery</h4><p class="text-gray-800 font-medium">${formData.bakeryLocation || '...'}</p></div><div><h4 class="font-semibold text-sm text-gray-500">Quarter</h4><p class="text-gray-800 font-medium">${formData.quarter || '...'}</p></div></div><div class="mb-6"><h4 class="font-semibold text-sm text-gray-500">Quarterly Vision</h4><div class="text-gray-800 prose prose-sm">${e(formData.quarterlyTheme)}</div></div><div><h3 class="text-lg font-bold border-b pb-2 mb-3">Key Monthly Objectives</h3><div class="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3 text-sm"><div><strong class="font-semibold text-gray-600 block">Month 1:</strong><div class="text-gray-800 mt-1 prose prose-sm">${e(formData.month1Goal)}</div></div><div><strong class="font-semibold text-gray-600 block">Month 2:</strong><div class="text-gray-800 mt-1 prose prose-sm">${e(formData.month2Goal)}</div></div><div><strong class="font-semibold text-gray-600 block">Month 3:</strong><div class="text-gray-800 mt-1 prose prose-sm">${e(formData.month3Goal)}</div></div></div></div></div>
        ${renderMonthSummary(1)}
        ${renderMonthSummary(2)}
        ${renderMonthSummary(3)}
        <div class="content-card p-6 mt-8" style="background-color: var(--review-blue-bg); border-color: var(--review-blue-border);"><h2 class="text-2xl font-bold mb-4" style="color: var(--review-blue-text);">Final Quarterly Reflection</h2><div class="space-y-4"><div><h3 class="font-bold text-lg flex items-center gap-2" style="color: var(--review-blue-text);"><i class="bi bi-award-fill"></i> Biggest Achievements</h3><div class="text-gray-700 mt-1 prose prose-sm">${e(formData.m3s7_achievements)}</div></div><div><h3 class="font-bold text-lg flex items-center gap-2" style="color: var(--review-blue-text);"><i class="bi bi-bar-chart-line-fill"></i> Biggest Challenges & Learnings</h3><div class="text-gray-700 mt-1 prose prose-sm">${e(formData.m3s7_challenges)}</div></div><div><h3 class="font-bold text-lg flex items-center gap-2" style="color: var(--review-blue-text);"><i class="bi bi-bullseye"></i> Performance vs Narrative</h3><div class="text-gray-700 mt-1 prose prose-sm">${e(formData.m3s7_narrative)}</div></div><div><h3 class="font-bold text-lg flex items-center gap-2" style="color: var(--review-blue-text);"><i class="bi bi-forward-fill"></i> Focus For Next Quarter</h3><div class="text-gray-700 mt-1 prose prose-sm">${e(formData.m3s7_next_quarter)}</div></div></div></div>
    </div>`;
}

function switchView(viewId) {
    appState.currentView = viewId;
    localStorage.setItem('lastPlanId', appState.currentPlanId);
    localStorage.setItem('lastViewId', viewId);

    const titles = {
        vision: { title: 'Bakery Growth Plan', subtitle: appState.planData.planName || 'Your 90-Day Sprint to a Better Bakery.' },
        'month-1': { title: '30 Day Plan', subtitle: 'Lay the foundations for success.' },
        'month-2': { title: '60 Day Plan', subtitle: 'Build momentum and embed processes.' },
        'month-3': { title: '90 Day Plan', subtitle: 'Refine execution and review the quarter.' },
        summary: { title: '90-Day Plan Summary', subtitle: 'A complete overview of your quarterly plan.' }
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
        if (monthNum) {
            updateWeeklyTabCompletion(monthNum, appState.planData);
        }
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
            // A more robust check to prevent unnecessary re-renders
            if (JSON.stringify(remoteData) !== JSON.stringify(appState.planData)) {
                appState.planData = remoteData;
                updateViewWithRemoteData(remoteData); // Use the more robust function
                updateUI(); // This updates sidebar, progress bars etc.
            }
        } else {
            console.error("Plan document not found! Returning to dashboard.");
            document.dispatchEvent(new CustomEvent('back-to-dashboard'));
        }
    }, (error) => {
        console.error("Error listening to plan changes:", error);
        document.dispatchEvent(new CustomEvent('back-to-dashboard'));
    });

    // We need to fetch the data once before setting the view
    planDocRef.get().then(doc => {
        if (doc.exists) {
            appState.planData = doc.data();
            updateUI();
            const lastViewId = localStorage.getItem('lastViewId') || 'vision';
            switchView(lastViewId);
        }
    });
}

export function initializePlanView(database, state, modalFunc, charCounterFunc, aiActionPlanFunc, shareFunc) {
    db = database;
    appState = state;
    openModal = modalFunc;
    initializeCharCounters = charCounterFunc;
    handleAIActionPlan = aiActionPlanFunc;
    handleShare = shareFunc;

    // --- Event Listeners for the Plan View ---
    DOMElements.mainNav.addEventListener('click', (e) => {
        e.preventDefault();
        const navLink = e.target.closest('a');
        if (navLink) {
            switchView(navLink.id.replace('nav-', ''));
        }
    });

    DOMElements.contentArea.addEventListener('input', (e) => {
        const target = e.target;
        if (target.matches('input, [contenteditable="true"]')) {
            const key = target.id;
            const value = target.isContentEditable ? target.innerHTML : target.value;
            if (appState.planData[key] !== value) {
                appState.planData[key] = value;
                saveData();
            }
        }
        if (target.isContentEditable) {
            if (target.innerText.trim() === '') {
                target.classList.add('is-placeholder-showing');
            } else {
                target.classList.remove('is-placeholder-showing');
            }
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

    DOMElements.contentArea.addEventListener('click', (e) => {
        const pillarButton = e.target.closest('.pillar-button');
        if (pillarButton) {
            pillarButton.classList.toggle('selected');
            const group = pillarButton.closest('.pillar-buttons');
            const stepKey = group.dataset.stepKey;
            const dataKey = `${stepKey}_pillar`;
            const selectedPillars = Array.from(group.querySelectorAll('.selected')).map(btn => btn.dataset.pillar);
            appState.planData[dataKey] = selectedPillars.length > 0 ? selectedPillars : firebase.firestore.FieldValue.delete();
            saveData(true);
            return;
        }
        const statusButton = e.target.closest('.status-button');
        if (statusButton) {
            const alreadySelected = statusButton.classList.contains('selected');
            statusButton.parentElement.querySelectorAll('.status-button').forEach(btn => btn.classList.remove('selected'));
            if (!alreadySelected) {
                statusButton.classList.add('selected');
                const monthNum = appState.currentView.split('-')[1];
                const week = statusButton.closest('.status-buttons').dataset.week;
                const key = `m${monthNum}s5_w${week}_status`;
                appState.planData[key] = statusButton.dataset.status;
            } else {
                const monthNum = appState.currentView.split('-')[1];
                const week = statusButton.closest('.status-buttons').dataset.week;
                const key = `m${monthNum}s5_w${week}_status`;
                delete appState.planData[key];
            }
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

    DOMElements.printBtn.addEventListener('click', () => window.print());
    DOMElements.shareBtn.addEventListener('click', () => handleShare(db, appState));
    DOMElements.aiActionBtn.addEventListener('click', () => {
        const planSummary = summarizePlanForAI(appState.planData);
        handleAIActionPlan(appState, saveData, planSummary);
    });

    // --- Radial Menu Button Listeners ---
    const actionPlanButton = document.getElementById('radial-action-plan');
    if (actionPlanButton) {
        actionPlanButton.addEventListener('click', () => {
            const planSummary = summarizePlanForAI(appState.planData);
            handleAIActionPlan(appState, saveData, planSummary);
            document.getElementById('radial-menu-container').classList.remove('open');
        });
    }

    const geminiButton = document.getElementById('radial-action-gemini');
    if (geminiButton) {
        geminiButton.addEventListener('click', () => {
            alert("Gemini AI feature coming soon!");
            document.getElementById('radial-menu-container').classList.remove('open');
        });
    }
}
