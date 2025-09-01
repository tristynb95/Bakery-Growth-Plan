import { DOMElements } from './dom.js';
import { appState } from './state.js';
import { templates } from './config.js';
import { db } from './firebase.js';
import { setupPlanListener, handleShare } from './api.js';
import { handleAIActionPlan } from './ai.js';
import { openModal } from './modal.js';

/**
 * Updates the main UI elements like the sidebar info and progress bars.
 */
export function updateUI() {
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
        const pillars = appState.planData[dataKey];
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

function managePlaceholder(editor) {
    if (!editor || !editor.isContentEditable) return;
    if (editor.innerText.trim() === '') {
        editor.classList.add('is-placeholder-showing');
    } else {
        editor.classList.remove('is-placeholder-showing');
    }
}

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

export function switchView(viewId) {
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

export function updateViewWithRemoteData(remoteData) {
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
        const pillars = remoteData[dataKey];
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

export async function renderDashboard() {
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

export async function restoreLastView(planId, viewId) {
    appState.currentPlanId = planId;
    await setupPlanListener();
    DOMElements.dashboardView.classList.add('hidden');
    DOMElements.appView.classList.remove('hidden');
    switchView(viewId);
    document.getElementById('radial-menu-container').classList.remove('hidden');
}

export function handleCreateNewPlan() { openModal('create'); }
export function handleEditPlanName(planId, currentName) { openModal('edit', { planId, currentName }); }
export function handleDeletePlan(planId, planName) { openModal('delete', { planId, planName }); }

export async function handleSelectPlan(planId) {
    appState.currentPlanId = planId;
    await setupPlanListener();
    DOMElements.dashboardView.classList.add('hidden');
    DOMElements.appView.classList.remove('hidden');
    switchView('vision');
    document.getElementById('radial-menu-container').classList.remove('hidden');
}

export function handleBackToDashboard() {
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
    document.getElementById('radial-menu-container').classList.add('hidden');
    renderDashboard();
}
