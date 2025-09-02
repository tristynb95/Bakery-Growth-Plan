// js/utils.js

// A minimal version of the templates object, containing only what's needed for progress calculations.
const templates = {
    vision: {
        requiredFields: ['managerName', 'bakeryLocation', 'quarter', 'quarterlyTheme', 'month1Goal', 'month2Goal', 'month3Goal']
    }
};

/**
 * Checks if a piece of content (like from a text box) is effectively empty.
 * Handles null, undefined, and empty HTML tags.
 * @param {string} htmlContent The content to check.
 * @returns {boolean} True if the content is empty.
 */
export function isContentEmpty(htmlContent) {
    if (!htmlContent) return true;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    return tempDiv.innerText.trim() === '';
}

/**
 * Calculates the completion progress for the "Vision" section of a plan.
 * @param {object} planData The data for the plan.
 * @returns {{completed: number, total: number}} An object with completed and total field counts.
 */
export function getVisionProgress(planData) {
    const requiredFields = templates.vision.requiredFields;
    const total = requiredFields.length;
    const completed = requiredFields.filter(field => !isContentEmpty(planData[field])).length;
    return { completed, total };
}

/**
 * Checks if all required fields for a specific week in a month are completed.
 * @param {number} monthNum The month number (1, 2, or 3).
 * @param {number} weekNum The week number (1-4).
 * @param {object} planData The data for the plan.
 * @returns {boolean} True if the week's check-in is complete.
 */
export function isWeekComplete(monthNum, weekNum, planData) {
    const status = planData[`m${monthNum}s5_w${weekNum}_status`];
    const win = planData[`m${monthNum}s5_w${weekNum}_win`];
    const spotlight = planData[`m${monthNum}s5_w${weekNum}_spotlight`];
    const shine = planData[`m${monthNum}s5_w${weekNum}_shine`];
    return !!status && !isContentEmpty(win) && !isContentEmpty(spotlight) && !isContentEmpty(shine);
}


/**
 * Calculates the completion progress for a specific month within a plan.
 * @param {number} monthNum The month number (1, 2, or 3).
 * @param {object} planData The data for the plan.
 * @returns {{completed: number, total: number}} An object with completed and total field counts.
 */
export function getMonthProgress(monthNum, planData) {
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
    const completed = requiredFields.filter(field => !isContentEmpty(planData[field])).length;
    return { completed, total };
}

/**
 * Calculates the total completion percentage of a given plan by aggregating all sections.
 * @param {object} planData The data for a specific plan.
 * @returns {number} The completion percentage (0-100).
 */
export function calculatePlanCompletion(planData) {
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
