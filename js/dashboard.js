// js/dashboard.js

// These will be passed in from main.js so this module can talk to the database and the rest of the app.
let db, currentUser, appState, openModal, handleSelectPlan;

// --- Helper Functions for Progress Calculation ---

// A small, local version of the templates object, just for the dashboard's needs.
const templates = {
    vision: {
        requiredFields: ['managerName', 'bakeryLocation', 'quarter', 'quarterlyTheme', 'month1Goal', 'month2Goal', 'month3Goal']
    }
};

/**
 * Checks if a piece of content (like from a text box) is effectively empty.
 * @param {string} htmlContent The content to check.
 * @returns {boolean} True if the content is empty.
 */
function isContentEmpty(htmlContent) {
    if (!htmlContent) return true;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    return tempDiv.innerText.trim() === '';
}

/**
 * Calculates the completion progress for the "Vision" section of a plan.
 * @param {object} planData The data for the plan.
 * @returns {{completed: number, total: number}}
 */
function getVisionProgress(planData) {
    const requiredFields = templates.vision.requiredFields;
    const total = requiredFields.length;
    const completed = requiredFields.filter(field => !isContentEmpty(planData[field])).length;
    return { completed, total };
}

/**
 * Calculates the completion progress for a specific month within a plan.
 * @param {number} monthNum The month number (1, 2, or 3).
 * @param {object} planData The data for the plan.
 * @returns {{completed: number, total: number}}
 */
function getMonthProgress(monthNum, planData) {
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
    const completed = requiredFields.filter(field => !isContentEmpty(planData[field])).length;
    return { completed, total };
}

/**
 * Calculates the total completion percentage of a given plan.
 * @param {object} planData The data for a specific plan.
 * @returns {number} The completion percentage (0-100).
 */
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

/**
 * Formats a Firestore timestamp into a user-friendly string like "Today at 14:30".
 * @param {object} lastEditedDate A Firestore timestamp object.
 * @returns {string} The formatted date string.
 */
function formatLastEditedDate(lastEditedDate) {
    if (!lastEditedDate || !lastEditedDate.toDate) {
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

// --- Main Exported Functions ---

/**
 * Fetches plans from the database and renders them as cards on the dashboard.
 */
export async function renderDashboard() {
    if (!currentUser) return;

    const dashboardContent = document.getElementById('dashboard-content');
    const dashboardView = document.getElementById('dashboard-view');
    dashboardView.classList.remove('hidden'); // Show the dashboard
    
    let plans = [];
    try {
        const plansRef = db.collection('users').doc(currentUser.uid).collection('plans');
        const snapshot = await plansRef.orderBy('lastEdited', 'desc').get();
        plans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching user plans:", error);
    }

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
                            <div class="progress-circle" style="--progress: ${completion}">
                                <div class="progress-circle-inner">${completion}%</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
    });
    dashboardHTML += `<div class="plan-card new-plan-card" id="create-new-plan-btn"><i class="bi bi-plus-circle-dotted text-4xl"></i><p class="mt-2 font-semibold">Create New Plan</p></div></div>`;
    dashboardContent.innerHTML = dashboardHTML;
}


/**
 * Sets up all event listeners for the dashboard page.
 */
export function initializeDashboard(database, user, state, modalOpener, planSelector) {
    db = database;
    currentUser = user;
    appState = state;
    openModal = modalOpener;
    handleSelectPlan = planSelector;

    const dashboardContent = document.getElementById('dashboard-content');
    const dashboardLogoutBtn = document.getElementById('dashboard-logout-btn');
    const dashboardProfileBtn = document.getElementById('dashboard-profile-btn');

    dashboardLogoutBtn.addEventListener('click', () => {
        // This will call a logout function defined in main.js
        document.dispatchEvent(new CustomEvent('logout-request'));
    });
    
    dashboardProfileBtn.addEventListener('click', () => {
        window.location.href = '/profile.html';
    });
    
    dashboardContent.addEventListener('click', (e) => {
        const createBtn = e.target.closest('#create-new-plan-btn');
        const mainCard = e.target.closest('.plan-card-main');
        const editBtn = e.target.closest('.edit-plan-btn');
        const deleteBtn = e.target.closest('.delete-plan-btn');
        
        if (editBtn) {
            e.stopPropagation();
            openModal('edit', { planId: editBtn.dataset.planId, currentName: editBtn.dataset.planName });
        } else if (deleteBtn) {
            e.stopPropagation();
            openModal('delete', { planId: deleteBtn.dataset.planId, planName: deleteBtn.dataset.planName });
        } else if (createBtn) {
            openModal('create');
        } else if (mainCard) {
            handleSelectPlan(mainCard.dataset.planId);
        }
    });
}
