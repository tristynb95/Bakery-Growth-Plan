// js/utils.js

// A minimal version of the templates object, containing only what's needed for progress calculations.
const templates = {
    vision: {
        requiredFields: ['managerName', 'bakeryLocation', 'quarter', 'quarterlyTheme', 'month1Goal', 'month2Goal', 'month3Goal']
    }
};

const FISCAL_YEAR_MONTHS = [
    { name: 'March', month: 3, yearOffset: 0 },
    { name: 'April', month: 4, yearOffset: 0 },
    { name: 'May', month: 5, yearOffset: 0 },
    { name: 'June', month: 6, yearOffset: 0 },
    { name: 'July', month: 7, yearOffset: 0 },
    { name: 'August', month: 8, yearOffset: 0 },
    { name: 'September', month: 9, yearOffset: 0 },
    { name: 'October', month: 10, yearOffset: 0 },
    { name: 'November', month: 11, yearOffset: 0 },
    { name: 'December', month: 12, yearOffset: 0 },
    { name: 'January', month: 1, yearOffset: 1 },
    { name: 'February', month: 2, yearOffset: 1 },
];

function getFallbackMonthMetadata(monthNum) {
    const clampedMonth = Math.max(1, Math.min(3, Number(monthNum)));
    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0);
    baseDate.setDate(1);
    baseDate.setMonth(baseDate.getMonth() + (clampedMonth - 1));

    return {
        name: baseDate.toLocaleString('default', { month: 'long' }),
        month: baseDate.getMonth() + 1,
        year: baseDate.getFullYear(),
        display: `${baseDate.toLocaleString('default', { month: 'long' })} ${baseDate.getFullYear()}`
    };
}

/**
 * Returns the month metadata for each month within a quarter label (e.g., "Q1 FY24").
 * @param {string} quarterString The quarter label provided by the user.
 * @returns {Array<{name: string, month: number, year: number, display: string}>|null}
 */
export function getQuarterMonthDetails(quarterString) {
    if (!quarterString) return null;
    const match = quarterString.match(/Q([1-4])\s*FY\s*(\d{2,4})/i);
    if (!match) return null;

    const quarter = parseInt(match[1], 10);
    let fiscalYear = parseInt(match[2], 10);
    if (Number.isNaN(quarter) || Number.isNaN(fiscalYear)) return null;

    if (match[2].length === 2) {
        fiscalYear += 2000;
    }

    const fiscalYearStart = fiscalYear - 1;
    const startIndex = (quarter - 1) * 3;
    if (startIndex < 0 || startIndex + 2 >= FISCAL_YEAR_MONTHS.length) return null;

    return [0, 1, 2].map((offset) => {
        const monthInfo = FISCAL_YEAR_MONTHS[startIndex + offset];
        const year = fiscalYearStart + monthInfo.yearOffset;
        return {
            name: monthInfo.name,
            month: monthInfo.month,
            year,
            display: `${monthInfo.name} ${year}`
        };
    });
}

/**
 * Gets metadata for a given month within the plan, falling back to the current calendar if unavailable.
 * @param {number|string} monthNum The month index within the plan (1-3).
 * @param {object} planData The plan data object.
 * @returns {{name: string, month: number, year: number, display: string}}
 */
export function getPlanMonthMetadata(monthNum, planData = {}) {
    const details = getQuarterMonthDetails(planData.quarter);
    const index = Number(monthNum) - 1;
    if (Array.isArray(details) && details[index]) {
        return details[index];
    }
    return getFallbackMonthMetadata(monthNum);
}

function normalizeDate(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Generates the week ranges for a specific calendar month and year using the "majority rule".
 * Weeks run Monday-Sunday and are included if four or more days fall within the month.
 * @param {number} month The calendar month (1-12).
 * @param {number} year The four-digit year.
 * @returns {Array<{startDate: Date, endDate: Date}>}
 */
export function generateWeeksForMonth(month, year) {
    if (!month || !year) return [];
    const targetMonth = month - 1;
    const firstDay = new Date(year, targetMonth, 1);
    const lastDay = new Date(year, targetMonth + 1, 0);

    const weeks = [];
    const start = normalizeDate(firstDay);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Adjust to Monday
    start.setDate(start.getDate() + diff);

    while (start <= lastDay) {
        const weekStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);

        let daysInMonth = 0;
        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
            if (dayDate.getMonth() === targetMonth) daysInMonth++;
        }

        if (daysInMonth >= 4) {
            weeks.push({ startDate: weekStart, endDate: weekEnd });
        }

        start.setDate(start.getDate() + 7);
    }

    return weeks;
}

/**
 * Returns the generated week objects for a given plan month.
 * @param {number|string} monthNum The plan month index (1-3).
 * @param {object} planData The plan data.
 * @returns {Array<{index: number, startDate: Date, endDate: Date}>}
 */
export function getPlanMonthWeeks(monthNum, planData = {}) {
    const metadata = getPlanMonthMetadata(monthNum, planData);
    if (!metadata || !metadata.month || !metadata.year) return [];
    const weeks = generateWeeksForMonth(metadata.month, metadata.year);
    return weeks.map((week, idx) => ({
        index: idx + 1,
        startDate: week.startDate,
        endDate: week.endDate
    }));
}

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
 * @param {number} weekNum The week number (1-n) for the generated weeks.
 * @param {object} planData The data for the plan.
 * @returns {boolean} True if the week's check-in is complete.
 */
export function isWeekComplete(monthNum, weekNum, planData) {
    const weeks = getPlanMonthWeeks(monthNum, planData);
    const numericWeek = Number(weekNum);
    if (!weeks.some(week => week.index === numericWeek)) return false;

    const status = planData[`m${monthNum}s5_w${numericWeek}_status`];
    const win = planData[`m${monthNum}s5_w${numericWeek}_win`];
    const spotlight = planData[`m${monthNum}s5_w${numericWeek}_spotlight`];
    const shine = planData[`m${monthNum}s5_w${numericWeek}_shine`];
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
    const weeks = getPlanMonthWeeks(monthNum, planData);
    weeks.forEach((week) => {
        requiredFields.push(
            `m${monthNum}s5_w${week.index}_status`,
            `m${monthNum}s5_w${week.index}_win`,
            `m${monthNum}s5_w${week.index}_spotlight`,
            `m${monthNum}s5_w${week.index}_shine`
        );
    });
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
