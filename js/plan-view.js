// js/plan-view.js

import {
    calculatePlanCompletion,
    getVisionProgress,
    getMonthProgress,
    isWeekComplete,
    isContentEmpty,
    getQuarterMonthDetails,
    getPlanMonthWeeks
} from './utils.js';
import { openChat } from './chat.js';
import { renderFilesView } from './files.js'; // <-- ADD THIS LINE


// Dependencies passed from main.js
let db, appState, openModal, initializeCharCounters, handleAIActionPlan, handleShare;

// --- PERFORMANCE OPTIMISATION: Cache for DOM elements ---
let cachedFormElements = [];

// --- DOM Element References ---
const DOMElements = {
    appView: document.getElementById('app-view'),
    contentArea: document.getElementById('content-area'),
    mainContent: document.querySelector('#app-view main'),
    mainNav: document.getElementById('main-nav'),
    navMonth1Text: document.querySelector('#nav-month-1 .nav-text'),
    navMonth2Text: document.querySelector('#nav-month-2 .nav-text'),
    navMonth3Text: document.querySelector('#nav-month-3 .nav-text'),
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

const MONTH_PLAN_LABELS = ['30 Day Plan', '60 Day Plan', '90 Day Plan'];
const DEFAULT_MONTH_TITLES = ['Month 1 Plan', 'Month 2 Plan', 'Month 3 Plan'];
const MONTH_STAGE_LABELS = ['Launch', 'Build', 'Embed'];

// --- HTML Templates for Views ---
const templates = {
    vision: {
        html: `<div class="plan-section-flow">
                    <div class="plan-mission-banner">
                        <div class="plan-mission-icon"><i class="bi bi-flower1"></i></div>
                        <div>
                            <span class="plan-mission-label">Our Mission</span>
                            <p class="plan-mission-text">"To make world-class, craft baking a part of every neighbourhood."</p>
                        </div>
                    </div>
                    <div class="content-card plan-card-elevated plan-vision-card">
                        <div class="plan-card-header">
                            <div class="plan-card-header-icon"><i class="bi bi-binoculars-fill"></i></div>
                            <div>
                                <h2 class="plan-card-title">Quarterly Vision</h2>
                                <p class="plan-card-description">The big, overarching mission for the next 90 days.</p>
                            </div>
                        </div>
                        <div class="plan-vision-meta">
                            <span class="plan-meta-pill"><i class="bi bi-calendar3"></i> 90-Day Horizon</span>
                            <span class="plan-meta-pill"><i class="bi bi-diagram-3"></i> People · Product · Customer · Place</span>
                            <span class="plan-meta-pill"><i class="bi bi-graph-up-arrow"></i> Review Weekly Momentum</span>
                        </div>
                        <div id="quarterlyTheme" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="e.g., Become the undisputed neighbourhood favourite by mastering our availability." data-maxlength="400"></div>
                    </div>
                    <div class="content-card plan-card-elevated plan-objectives-card">
                        <div class="plan-card-header">
                            <div class="plan-card-header-icon"><i class="bi bi-flag-fill"></i></div>
                            <div>
                                <h2 class="plan-card-title">Key Monthly Objectives</h2>
                                <p class="plan-card-description">Set a high-level goal for each 30-day sprint.</p>
                            </div>
                        </div>
                        <div class="plan-objectives-grid">
                            <div class="plan-objective-item plan-objective-month-1">
                                <div class="plan-objective-indicator" style="background-color: #D10A11;"></div>
                                <div class="plan-objective-content">
                                    <label for="month1Goal" class="plan-objective-label"><span>Month 1 · 30 Days</span> <i class="bi bi-info-circle info-icon" title="High-level goal for the first 30-day sprint."></i></label>
                                    <div id="month1Goal" class="form-input text-sm is-placeholder-showing" contenteditable="true" data-placeholder="e.g., PRODUCT: Master afternoon availability and reduce waste." data-maxlength="300"></div>
                                </div>
                            </div>
                            <div class="plan-objective-item plan-objective-month-2">
                                <div class="plan-objective-indicator" style="background-color: #B45309;"></div>
                                <div class="plan-objective-content">
                                    <label for="month2Goal" class="plan-objective-label"><span>Month 2 · 60 Days</span> <i class="bi bi-info-circle info-icon" title="High-level goal for the second 30-day sprint."></i></label>
                                    <div id="month2Goal" class="form-input text-sm is-placeholder-showing" contenteditable="true" data-placeholder="e.g., PLACE: Embed new production processes and daily checks." data-maxlength="300"></div>
                                </div>
                            </div>
                            <div class="plan-objective-item plan-objective-month-3">
                                <div class="plan-objective-indicator" style="background-color: #065F46;"></div>
                                <div class="plan-objective-content">
                                    <label for="month3Goal" class="plan-objective-label"><span>Month 3 · 90 Days</span> <i class="bi bi-info-circle info-icon" title="High-level goal for the third 30-day sprint."></i></label>
                                    <div id="month3Goal" class="form-input text-sm is-placeholder-showing" contenteditable="true" data-placeholder="e.g., PEOPLE: Develop team skills for consistent execution." data-maxlength="300"></div>
                                </div>
                            </div>
                        </div>
                    </div>
               </div>`,
        requiredFields: ['quarterlyTheme', 'month1Goal', 'month2Goal', 'month3Goal']
    },
    month: (monthNum, weekConfig = {}) => {
        const { weeks = [], activeWeekIndex = 0 } = weekConfig;
        const hasWeeks = Array.isArray(weeks) && weeks.length > 0;
        const tabsHtml = hasWeeks
            ? weeks.map((week, idx) => `
                <a href="#" class="weekly-tab ${idx === activeWeekIndex ? 'active' : ''} flex items-center" data-week-index="${week.index}" data-week-label="${week.label}">
                    <span>${week.label}</span>
                    <i class="bi bi-check-circle-fill week-complete-icon ml-2 hidden"></i>
                </a>
            `).join('')
            : '<span class="text-sm text-gray-500 py-2">Weekly ranges will appear once the month is set.</span>';
        const panelsHtml = hasWeeks
            ? weeks.map((week, idx) => `
                <div class="weekly-tab-panel ${idx !== activeWeekIndex ? 'hidden' : ''}" data-week-panel="${week.index}" data-week-label="${week.label}">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                        <div class="md:col-span-2">
                            <label id="weekly-progress-label-${week.index}" class="font-semibold block mb-3 text-gray-700" data-week-index="${week.index}" data-week-label="${week.label}">
                                Week ${week.index} Progress (${week.label}):
                            </label>
                            <div class="flex items-center space-x-2 status-buttons" data-week-index="${week.index}">
                                <button class="status-button" data-status="on-track">ON TRACK</button>
                                <button class="status-button" data-status="issues">ISSUES</button>
                                <button class="status-button" data-status="off-track">OFF TRACK</button>
                            </div>
                        </div>
                        <div>
                            <label for="m${monthNum}s5_w${week.index}_win" class="font-semibold block mb-2 text-gray-700">A Win or Learning:</label>
                            <div id="m${monthNum}s5_w${week.index}_win" class="form-input text-sm is-placeholder-showing weekly-check-in-input" contenteditable="true" data-placeholder="e.g., The team hit 80% availability on Thursday!" data-maxlength="400"></div>
                        </div>
                        <div>
                            <label for="m${monthNum}s5_w${week.index}_spotlight" class="font-semibold block mb-2 text-gray-700">Breadhead Spotlight:</label>
                            <div id="m${monthNum}s5_w${week.index}_spotlight" class="form-input text-sm is-placeholder-showing weekly-check-in-input" contenteditable="true" data-placeholder="e.g., Sarah, for making a customer's day by remembering their name and usual order—a perfect example of our SHINE values." data-maxlength="400"></div>
                        </div>
                        <div class="md:col-span-2">
                            <label for="m${monthNum}s5_w${week.index}_shine" class="font-semibold block mb-2 text-gray-700">This Week's SHINE Focus:</label>
                            <div id="m${monthNum}s5_w${week.index}_shine" class="form-input text-sm is-placeholder-showing weekly-check-in-input" contenteditable="true" data-placeholder="e.g., Ensuring every customer is greeted within 30 seconds." data-maxlength="400"></div>
                        </div>
                    </div>
                </div>
            `).join('')
            : '<p class="text-sm text-gray-500">Weekly check-ins will appear once the month is configured.</p>';

        const monthColorMap = { 1: '#D10A11', 2: '#B45309', 3: '#065F46' };
        const monthAccent = monthColorMap[monthNum] || '#D10A11';
        const monthPlanLabel = MONTH_PLAN_LABELS[monthNum - 1] || `Month ${monthNum} Plan`;
        const monthStageLabel = MONTH_STAGE_LABELS[monthNum - 1] || 'Execute';

        return `
            <div class="plan-section-flow">
                <div class="content-card plan-card-elevated plan-foundation-card">
                    <div class="plan-section-accent" style="background-color: ${monthAccent};"></div>
                    <div class="plan-card-inner">
                        <div class="plan-month-kicker" style="color: ${monthAccent};">${monthPlanLabel} · ${monthStageLabel} Phase</div>
                        <div class="plan-card-header">
                            <div class="plan-card-header-icon" style="background-color: ${monthAccent}1A; color: ${monthAccent};"><i class="bi bi-crosshair"></i></div>
                            <div>
                                <h2 class="plan-card-title">Your Foundation</h2>
                                <p class="plan-card-description">Complete these sections at the start of your month to set a clear direction.</p>
                            </div>
                        </div>
                        <div class="plan-stage-rail">
                            <span class="plan-stage-chip" style="border-color: ${monthAccent}33; color: ${monthAccent};"><i class="bi bi-bullseye"></i> Define the must-win battle</span>
                            <span class="plan-stage-chip" style="border-color: ${monthAccent}33; color: ${monthAccent};"><i class="bi bi-lightning-charge-fill"></i> Align actions with the team</span>
                            <span class="plan-stage-chip" style="border-color: ${monthAccent}33; color: ${monthAccent};"><i class="bi bi-columns-gap"></i> Keep all four pillars strong</span>
                        </div>

                        <div class="plan-form-section">
                            <div class="plan-form-section-header">
                                <i class="bi bi-crosshair plan-form-section-icon" style="color: ${monthAccent};"></i>
                                <label class="plan-form-section-title">Must-Win Battle</label>
                            </div>
                            <div id="m${monthNum}s1_battle" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="Example: 'Achieve >80% availability by implementing the production matrix correctly...'" data-maxlength="500"></div>
                            <div class="mt-4">
                                <label class="plan-form-inline-label">Pillar Focus:</label>
                                <div class="plan-pillar-grid pillar-buttons" data-step-key="m${monthNum}s1">
                                    <button class="btn pillar-button" data-pillar="people"><i class="bi bi-people-fill"></i> People</button>
                                    <button class="btn pillar-button" data-pillar="product"><i class="bi bi-cup-hot-fill"></i> Product</button>
                                    <button class="btn pillar-button" data-pillar="customer"><i class="bi bi-heart-fill"></i> Customer</button>
                                    <button class="btn pillar-button" data-pillar="place"><i class="bi bi-shop"></i> Place</button>
                                </div>
                            </div>
                        </div>

                        <div class="plan-form-divider"></div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="flex flex-col">
                                <div class="plan-form-section-header">
                                    <i class="bi bi-lightning-charge-fill plan-form-section-icon" style="color: ${monthAccent};"></i>
                                    <label for="m${monthNum}s2_levers" class="plan-form-section-title">My Key Actions</label>
                                </div>
                                <div id="m${monthNum}s2_levers" class="form-input is-placeholder-showing flex-grow key-levers-input" contenteditable="true" data-placeholder="1. Review Availability & Freshness report daily and adjust baking plans proactively.&#10;2. Lead a 'Coffee Dial-In' session in the management meeting.&#10;3. Coach one team member daily on a specific SHINE principle." data-maxlength="600"></div>
                            </div>
                            <div class="space-y-4">
                                <div>
                                    <div class="plan-form-section-header">
                                        <i class="bi bi-chat-square-quote-fill plan-form-section-icon" style="color: ${monthAccent};"></i>
                                        <label for="m${monthNum}s2_powerup_q" class="plan-form-section-title">Team Power-Up Question</label>
                                    </div>
                                    <div id="m${monthNum}s2_powerup_q" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="What's one small change we could make this week to make our customers smile?" data-maxlength="300"></div>
                                </div>
                                <div>
                                    <div class="plan-form-section-header">
                                        <i class="bi bi-lightbulb-fill plan-form-section-icon" style="color: ${monthAccent};"></i>
                                        <label for="m${monthNum}s2_powerup_a" class="plan-form-section-title">Our Team's Winning Idea</label>
                                    </div>
                                    <div id="m${monthNum}s2_powerup_a" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="Creating a 'regular's board' to remember our most frequent customers' orders." data-maxlength="300"></div>
                                </div>
                            </div>
                        </div>

                        <div class="plan-form-divider"></div>

                        <div class="plan-form-section">
                            <div class="plan-form-section-header">
                                <i class="bi bi-people-fill plan-form-section-icon" style="color: ${monthAccent};"></i>
                                <label class="plan-form-section-title">Developing Our Breadheads</label>
                            </div>
                            <div id="m${monthNum}s3_people" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="Example: 'Sarah: Coach on the production matrix to build her confidence.'" data-maxlength="600"></div>
                        </div>

                        <div class="plan-form-divider"></div>

                        <div class="plan-form-section">
                            <div class="plan-form-section-header">
                                <i class="bi bi-columns-gap plan-form-section-icon" style="color: ${monthAccent};"></i>
                                <div>
                                    <label class="plan-form-section-title">Upholding Our Pillars</label>
                                    <p class="plan-card-description mt-0">One key behaviour for each pillar to ensure standards don't slip.</p>
                                </div>
                            </div>
                            <div class="plan-pillars-form-grid">
                                <div class="plan-pillar-form-item">
                                    <label for="m${monthNum}s4_people" class="plan-pillar-form-label"><i class="bi bi-people-fill"></i> People</label>
                                    <div id="m${monthNum}s4_people" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="e.g., Meaningful 1-2-1s with my two keyholders." data-maxlength="300"></div>
                                </div>
                                <div class="plan-pillar-form-item">
                                    <label for="m${monthNum}s4_product" class="plan-pillar-form-label"><i class="bi bi-cup-hot-fill"></i> Product</label>
                                    <div id="m${monthNum}s4_product" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="e.g., Daily quality checks of the first bake." data-maxlength="300"></div>
                                </div>
                                <div class="plan-pillar-form-item">
                                    <label for="m${monthNum}s4_customer" class="plan-pillar-form-label"><i class="bi bi-heart-fill"></i> Customer</label>
                                    <div id="m${monthNum}s4_customer" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="e.g., Action all customer feedback within 24 hours." data-maxlength="300"></div>
                                </div>
                                <div class="plan-pillar-form-item">
                                    <label for="m${monthNum}s4_place" class="plan-pillar-form-label"><i class="bi bi-shop"></i> Place</label>
                                    <div id="m${monthNum}s4_place" class="form-input is-placeholder-showing" contenteditable="true" data-placeholder="e.g., Complete a bakery travel path twice a day." data-maxlength="300"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="content-card plan-card-elevated">
                    <div class="plan-card-header">
                        <div class="plan-card-header-icon" style="background-color: ${monthAccent}1A; color: ${monthAccent};"><i class="bi bi-graph-up-arrow"></i></div>
                        <div>
                            <h2 class="plan-card-title">Weekly Momentum</h2>
                            <p class="plan-card-description">Return here each week to log your progress, celebrate wins, and spotlight your team.</p>
                        </div>
                    </div>
                    <div class="plan-weekly-tabs-wrapper">
                        <nav id="weekly-tabs" class="plan-weekly-tabs" aria-label="Tabs">
                            ${tabsHtml}
                        </nav>
                    </div>
                    <div id="weekly-tab-content">
                        ${panelsHtml}
                    </div>
                </div>

                <div class="content-card plan-card-elevated plan-review-card">
                    <div class="plan-card-header">
                        <div class="plan-card-header-icon plan-card-header-icon--review"><i class="bi bi-journal-check"></i></div>
                        <div>
                            <h2 class="plan-card-title">End of Month Review</h2>
                            <p class="plan-card-description">At the end of the month, reflect on your performance to prepare for your line manager conversation.</p>
                        </div>
                    </div>
                    <div class="plan-review-fields">
                        <div class="plan-review-field">
                            <div class="plan-review-field-icon plan-review-field-icon--win"><i class="bi bi-trophy-fill"></i></div>
                            <div class="plan-review-field-content">
                                <label for="m${monthNum}s6_win" class="plan-review-field-label">Biggest Win</label>
                                <div id="m${monthNum}s6_win" class="form-input is-placeholder-showing" contenteditable="true" data-maxlength="500"></div>
                            </div>
                        </div>
                        <div class="plan-review-field">
                            <div class="plan-review-field-icon plan-review-field-icon--challenge"><i class="bi bi-lightbulb-fill"></i></div>
                            <div class="plan-review-field-content">
                                <label for="m${monthNum}s6_challenge" class="plan-review-field-label">Toughest Challenge & What I Learned</label>
                                <div id="m${monthNum}s6_challenge" class="form-input is-placeholder-showing" contenteditable="true" data-maxlength="500"></div>
                            </div>
                        </div>
                        <div class="plan-review-field">
                            <div class="plan-review-field-icon plan-review-field-icon--next"><i class="bi bi-rocket-takeoff-fill"></i></div>
                            <div class="plan-review-field-content">
                                <label for="m${monthNum}s6_next" class="plan-review-field-label">Focus for Next Month</label>
                                <div id="m${monthNum}s6_next" class="form-input is-placeholder-showing" contenteditable="true" data-maxlength="500"></div>
                            </div>
                        </div>
                    </div>
                </div>

                ${monthNum == 3 ? `
                <div class="content-card plan-card-elevated plan-quarterly-card">
                    <div class="plan-card-header">
                        <div class="plan-card-header-icon plan-card-header-icon--quarterly"><i class="bi bi-mortarboard-fill"></i></div>
                        <div>
                            <h2 class="plan-card-title" style="color: var(--review-blue-text);">Final Quarterly Reflection</h2>
                            <p class="plan-card-description">A deep dive into the quarter's performance for your review.</p>
                        </div>
                    </div>
                    <div class="plan-review-fields">
                        <div class="plan-review-field">
                            <div class="plan-review-field-icon" style="background-color: #D1FAE5; color: #065F46;"><i class="bi bi-award-fill"></i></div>
                            <div class="plan-review-field-content">
                                <label for="m3s7_achievements" class="plan-review-field-label">Quarter's Biggest Achievements</label>
                                <div id="m3s7_achievements" class="form-input is-placeholder-showing" contenteditable="true" data-maxlength="800"></div>
                            </div>
                        </div>
                        <div class="plan-review-field">
                            <div class="plan-review-field-icon" style="background-color: #FEF3C7; color: #92400E;"><i class="bi bi-bar-chart-line-fill"></i></div>
                            <div class="plan-review-field-content">
                                <label for="m3s7_challenges" class="plan-review-field-label">Biggest Challenges & Learnings</label>
                                <div id="m3s7_challenges" class="form-input is-placeholder-showing" contenteditable="true" data-maxlength="800"></div>
                            </div>
                        </div>
                        <div class="plan-review-field">
                            <div class="plan-review-field-icon" style="background-color: #EFF6FF; color: #1E40AF;"><i class="bi bi-bullseye"></i></div>
                            <div class="plan-review-field-content">
                                <label for="m3s7_narrative" class="plan-review-field-label">Performance vs Quarterly Narrative</label>
                                <div id="m3s7_narrative" class="form-input is-placeholder-showing" contenteditable="true" data-maxlength="800"></div>
                            </div>
                        </div>
                        <div class="plan-review-field">
                            <div class="plan-review-field-icon" style="background-color: #FFF1F2; color: #D10A11;"><i class="bi bi-forward-fill"></i></div>
                            <div class="plan-review-field-content">
                                <label for="m3s7_next_quarter" class="plan-review-field-label">Primary Focus for Next Quarter</label>
                                <div id="m3s7_next_quarter" class="form-input is-placeholder-showing" contenteditable="true" data-maxlength="800"></div>
                            </div>
                        </div>
                    </div>
                </div>` : ''}
            </div>
        `;
    },
};

function normalizeToStartOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatWeekRange(startDate, endDate) {
    const options = { day: '2-digit', month: 'short' };
    const start = normalizeToStartOfDay(startDate instanceof Date ? startDate : new Date(startDate));
    const end = normalizeToStartOfDay(endDate instanceof Date ? endDate : new Date(endDate));
    const startLabel = start.toLocaleDateString('en-GB', options);
    const endLabel = end.toLocaleDateString('en-GB', options);
    return `${startLabel} - ${endLabel}`;
}

function getFormattedWeeks(monthNum, planData) {
    const weeks = getPlanMonthWeeks(monthNum, planData);
    return weeks.map((week) => ({
        index: week.index,
        startDate: week.startDate,
        endDate: week.endDate,
        label: formatWeekRange(week.startDate, week.endDate)
    }));
}

function getActiveWeekIndex(weeks) {
    if (!Array.isArray(weeks) || weeks.length === 0) return 0;
    const today = normalizeToStartOfDay(new Date());
    const foundIndex = weeks.findIndex((week) => {
        const start = normalizeToStartOfDay(week.startDate instanceof Date ? week.startDate : new Date(week.startDate));
        const end = normalizeToStartOfDay(week.endDate instanceof Date ? week.endDate : new Date(week.endDate));
        return today >= start && today <= end;
    });
    return foundIndex === -1 ? 0 : foundIndex;
}

// --- Helper Functions ---

function getViewTitleConfig(viewId) {
    const planData = (appState && appState.planData) ? appState.planData : {};
    const planName = planData.planName || '';
    const quarterLabel = planData.quarter || '';
    const monthDetails = getQuarterMonthDetails(quarterLabel);
    const monthTitles = Array.isArray(monthDetails) && monthDetails.length === 3
        ? monthDetails.map((detail, index) => `${detail.display} (${MONTH_PLAN_LABELS[index]})`)
        : DEFAULT_MONTH_TITLES;

    const monthSubtitles = [
        planName || 'Lay the foundations for success.',
        planName || 'Build momentum and embed processes.',
        planName || 'Refine execution and review the quarter.'
    ];

    const configs = {
        vision: { title: `Bakery Growth Plan - ${quarterLabel}`, subtitle: planName || 'Your 90-Day Sprint to a Better Bakery.' },
        'month-1': { title: monthTitles[0], subtitle: monthSubtitles[0] },
        'month-2': { title: monthTitles[1], subtitle: monthSubtitles[1] },
        'month-3': { title: monthTitles[2], subtitle: monthSubtitles[2] },
        summary: { title: `Plan Summary - ${quarterLabel}`, subtitle: planName || 'A complete overview of your quarterly plan.' },
        files: { title: 'My Files', subtitle: "Manage documents for your plan, like P&L statements and KPIs." }
    };

    return configs[viewId] || { title: 'Growth Plan', subtitle: '' };
}

export function summarizePlanForActionPlan(planData) {
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
        
        const pillars = planData[`m${m}s1_pillar`];
        if (Array.isArray(pillars) && pillars.length > 0) {
            summary += `PILLAR FOCUS: ${pillars.join(', ')}\n`;
        }

        summary += `MUST-WIN BATTLE: ${e(planData[`m${m}s1_battle`])}\n`;
        summary += `KEY ACTIONS: ${e(planData[`m${m}s2_levers`])}\n`;
        summary += `DEVELOPING OUR BREADHEADS: ${e(planData[`m${m}s3_people`])}\n`;
        summary += `UPHOLDING PILLARS (PEOPLE): ${e(planData[`m${m}s4_people`])}\n`;
        summary += `UPHOLDING PILLARS (PRODUCT): ${e(planData[`m${m}s4_product`])}\n`;
        summary += `UPHOLDING PILLARS (CUSTOMER): ${e(planData[`m${m}s4_customer`])}\n`;
        summary += `UPHOLDING PILLARS (PLACE): ${e(planData[`m${m}s4_place`])}\n\n`;
    }
    return summary;
}

function cacheFormElements() {
    cachedFormElements = Array.from(document.querySelectorAll('#app-view input, #app-view [contenteditable="true"]'));
}

// --- Data Handling & Saving ---

export function saveData(forceImmediate = false, directPayload = null) {
    if (!appState.currentUser || !appState.currentPlanId) return Promise.resolve();

    if (directPayload) {
        appState.planData = { ...appState.planData, ...directPayload };
    }
    
    if (appState.isSaving) return Promise.resolve();

    clearTimeout(appState.saveTimeout);

    const saveToFirestore = async () => {
        appState.isSaving = true;
        const docRef = db.collection("users").doc(appState.currentUser.uid).collection("plans").doc(appState.currentPlanId);
        
        const dataToSave = { ...appState.planData };
        delete dataToSave.isSaving;

        await docRef.set({
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
    cachedFormElements.forEach(el => {
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
            const week = group.dataset.weekIndex;
            const key = `m${monthNum}s5_w${week}_status`;
            const status = appState.planData[key];
            group.querySelectorAll('.selected').forEach(s => s.classList.remove('selected'));
            if (status) {
                const buttonToSelect = group.querySelector(`[data-status="${status}"]`);
                if (buttonToSelect) buttonToSelect.classList.add('selected');
            }
        });
    }
    document.querySelectorAll('#app-view [contenteditable="true"]').forEach(el => {
        if (el.innerText.trim() === '') {
            el.classList.add('is-placeholder-showing');
        } else {
            el.classList.remove('is-placeholder-showing');
        }
    });
    if (appState.currentView.startsWith('month-')) {
        resetWeeklyProgressLabels();
    }
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
    cachedFormElements.forEach(el => {
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
            const week = group.dataset.weekIndex;
            const key = `m${monthNum}s5_w${week}_status`;
            const status = remoteData[key];
            group.querySelectorAll('.selected').forEach(s => s.classList.remove('selected'));
            if (status) {
                const buttonToSelect = group.querySelector(`[data-status="${status}"]`);
                if (buttonToSelect) buttonToSelect.classList.add('selected');
            }
        });
        resetWeeklyProgressLabels();
    }
}

function resetWeeklyProgressLabels() {
    document.querySelectorAll('[id^="weekly-progress-label-"]').forEach((label) => {
        const parts = label.id.split('-');
        const labelWeek = parts[parts.length - 1];
        label.textContent = `Week ${labelWeek} Progress:`;
    });
}

function updateWeeklyTabCompletion(monthNum, planData) {
    const weeks = getPlanMonthWeeks(monthNum, planData);
    weeks.forEach((week) => {
        const isComplete = isWeekComplete(monthNum, week.index, planData);
        const tab = document.querySelector(`.weekly-tab[data-week-index="${week.index}"]`);
        if (tab) {
            const tickIcon = tab.querySelector('.week-complete-icon');
            if (tickIcon) {
                tickIcon.classList.toggle('hidden', !isComplete);
            }
        }
    });
}

function updateSidebarMonthLabels() {
    const monthDetails = getQuarterMonthDetails(appState.planData.quarter);
    const navTextElements = [
        DOMElements.navMonth1Text,
        DOMElements.navMonth2Text,
        DOMElements.navMonth3Text
    ];

    navTextElements.forEach((element, index) => {
        if (!element) return;
        const detail = Array.isArray(monthDetails) ? monthDetails[index] : null;
        element.textContent = detail ? detail.display : MONTH_PLAN_LABELS[index];
    });
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
    updateNavItem('#nav-vision', getVisionProgress(appState.planData));
    for (let m = 1; m <= 3; m++) {
        updateNavItem(`#nav-month-${m}`, getMonthProgress(m, appState.planData));
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
    updateSidebarMonthLabels();
         // Add this line to update the sidebar context
     const sidebarContext = document.getElementById('sidebar-plan-context');
     if (sidebarContext) {
         sidebarContext.textContent = `${appState.planData.quarter || 'Your'} Plan`;
     }

    if (appState.currentView) {
        updateHeaderForView(appState.currentView);
    }

}

function renderSummary() {
    const formData = appState.planData;
    const e = (html) => {
        if (!html) return '<span class="text-gray-400 italic">Not yet completed</span>';
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        if (tempDiv.innerText.trim() === '') { return '<span class="text-gray-400 italic">Not yet completed</span>'; }
        tempDiv.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
        tempDiv.querySelectorAll('span, font').forEach(el => {
            if (el.childNodes.length > 0) { el.replaceWith(...el.childNodes); } else { el.remove(); }
        });
        return tempDiv.innerHTML;
    };

    const isContentEmpty = (htmlContent) => {
        if (!htmlContent) return true;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        return tempDiv.innerText.trim() === '';
    };

    const monthLabels = { 1: '30 Day Plan', 2: '60 Day Plan', 3: '90 Day Plan' };
    const monthColors = { 1: '#D10A11', 2: '#B45309', 3: '#065F46' };

    const renderMonthSummary = (monthNum) => {
        const weeks = getFormattedWeeks(monthNum, formData);
        let loggedCount = 0;
        let totalWeeks = weeks.length;
        let weekRows = '';
        const colorNames = { 1: 'red', 2: 'amber', 3: 'green' };
        const dotClasses = { 'on-track': 'dot-on-track', 'issues': 'dot-issues', 'off-track': 'dot-off-track' };

        weeks.forEach((week) => {
            const status = formData[`m${monthNum}s5_w${week.index}_status`];
            const win = formData[`m${monthNum}s5_w${week.index}_win`];
            const spotlight = formData[`m${monthNum}s5_w${week.index}_spotlight`];
            const shine = formData[`m${monthNum}s5_w${week.index}_shine`];

            if (status) {
                loggedCount++;
                const statusText = status.replace('-', ' ').toUpperCase();
                const statusBadgeHTML = `<span class="summary-status-badge status-${status}">${statusText}</span>`;
                const dotClass = dotClasses[status] || 'dot-on-track';
                let details = '';
                if (!isContentEmpty(win)) details += `<div class="summary-week-detail"><i class="bi bi-trophy text-amber-500"></i><div><strong>Win/Learning</strong><div class="prose prose-sm">${e(win)}</div></div></div>`;
                if (!isContentEmpty(spotlight)) details += `<div class="summary-week-detail"><i class="bi bi-star text-purple-500"></i><div><strong>Breadhead Spotlight</strong><div class="prose prose-sm">${e(spotlight)}</div></div></div>`;
                if (!isContentEmpty(shine)) details += `<div class="summary-week-detail"><i class="bi bi-brightness-high text-amber-500"></i><div><strong>SHINE Focus</strong><div class="prose prose-sm">${e(shine)}</div></div></div>`;
                if (!details) details = '<p class="text-sm text-gray-400 italic">No details logged.</p>';

                weekRows += `
                    <div class="summary-week-row">
                        <div class="summary-week-dot ${dotClass}"><span>${week.index}</span></div>
                        <div class="summary-week-content">
                            <div class="summary-week-header">
                                <span class="font-semibold text-gray-700 text-sm">${week.label}</span>
                                ${statusBadgeHTML}
                            </div>
                            <div class="summary-week-details">${details}</div>
                        </div>
                    </div>`;
            }
        });

        const pillars = formData[`m${monthNum}s1_pillar`];
        const pillarIcons = { 'people': 'bi-people-fill', 'product': 'bi-cup-hot-fill', 'customer': 'bi-heart-fill', 'place': 'bi-shop' };
        let pillarBadgesHTML = '';
        if (Array.isArray(pillars) && pillars.length > 0) {
            pillarBadgesHTML = pillars.map(p => `<span class="pillar-badge"><i class="bi ${pillarIcons[p]}"></i> ${p.charAt(0).toUpperCase() + p.slice(1)}</span>`).join('');
        }

        const hasReview = !isContentEmpty(formData[`m${monthNum}s6_win`]) || !isContentEmpty(formData[`m${monthNum}s6_challenge`]) || !isContentEmpty(formData[`m${monthNum}s6_next`]);
        const accentColor = monthColors[monthNum];

        // Progress ring calculations
        const pct = totalWeeks > 0 ? loggedCount / totalWeeks : 0;
        const r = 14;
        const circ = 2 * Math.PI * r;
        const dashoffset = circ * (1 - pct);

        return `
            <div class="summary-month-card" id="summary-month-${monthNum}">
                <div class="summary-month-header" data-color="${colorNames[monthNum]}">
                    <div class="summary-month-title-row">
                        <div class="summary-month-title-group">
                            <div class="summary-month-num" style="background-color: ${accentColor}">${monthNum}</div>
                            <div class="summary-month-info">
                                <h2>${monthLabels[monthNum]}</h2>
                                ${pillarBadgesHTML ? `<div class="summary-month-pillars">${pillarBadgesHTML}</div>` : ''}
                            </div>
                        </div>
                        <div class="summary-momentum-indicator">
                            <div class="summary-momentum-ring">
                                <svg viewBox="0 0 36 36">
                                    <circle class="ring-bg" cx="18" cy="18" r="${r}"/>
                                    <circle class="ring-fill" cx="18" cy="18" r="${r}" stroke="${accentColor}" stroke-dasharray="${circ}" stroke-dashoffset="${dashoffset}"/>
                                </svg>
                            </div>
                            <div class="summary-momentum-text">
                                <span class="summary-momentum-label">Momentum</span>
                                <span class="summary-momentum-value" style="color: ${accentColor}">${loggedCount}/${totalWeeks}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="summary-month-body">
                    <div class="summary-strategy-section">
                        <div class="summary-strategy-card summary-strategy-card--battle">
                            <div class="summary-strategy-icon"><i class="bi bi-crosshair"></i></div>
                            <div class="min-w-0">
                                <h3 class="summary-strategy-label">Must-Win Battle</h3>
                                <div class="summary-strategy-content prose prose-sm">${e(formData[`m${monthNum}s1_battle`])}</div>
                            </div>
                        </div>
                        <div class="summary-strategy-card">
                            <div class="summary-strategy-icon"><i class="bi bi-lightning-charge-fill"></i></div>
                            <div class="min-w-0">
                                <h3 class="summary-strategy-label">Key Actions</h3>
                                <div class="summary-strategy-content prose prose-sm">${e(formData[`m${monthNum}s2_levers`])}</div>
                            </div>
                        </div>
                        <div class="summary-strategy-card">
                            <div class="summary-strategy-icon"><i class="bi bi-people-fill"></i></div>
                            <div class="min-w-0">
                                <h3 class="summary-strategy-label">Developing Our Breadheads</h3>
                                <div class="summary-strategy-content prose prose-sm">${e(formData[`m${monthNum}s3_people`])}</div>
                            </div>
                        </div>
                    </div>

                    <div class="summary-pillars-grid">
                        <h3 class="summary-pillars-title"><i class="bi bi-columns-gap"></i> Upholding Pillars</h3>
                        <div class="summary-pillars-items">
                            <div class="summary-pillar-item"><div class="summary-pillar-icon"><i class="bi bi-people-fill"></i></div><div><h4 class="summary-pillar-label">People</h4><div class="prose prose-sm">${e(formData[`m${monthNum}s4_people`])}</div></div></div>
                            <div class="summary-pillar-item"><div class="summary-pillar-icon"><i class="bi bi-cup-hot-fill"></i></div><div><h4 class="summary-pillar-label">Product</h4><div class="prose prose-sm">${e(formData[`m${monthNum}s4_product`])}</div></div></div>
                            <div class="summary-pillar-item"><div class="summary-pillar-icon"><i class="bi bi-heart-fill"></i></div><div><h4 class="summary-pillar-label">Customer</h4><div class="prose prose-sm">${e(formData[`m${monthNum}s4_customer`])}</div></div></div>
                            <div class="summary-pillar-item"><div class="summary-pillar-icon"><i class="bi bi-shop"></i></div><div><h4 class="summary-pillar-label">Place</h4><div class="prose prose-sm">${e(formData[`m${monthNum}s4_place`])}</div></div></div>
                        </div>
                    </div>

                    ${weekRows ? `
                    <div class="summary-weekly-section">
                        <h3 class="summary-section-title"><i class="bi bi-graph-up-arrow"></i> Weekly Momentum</h3>
                        <div class="summary-weeks-list">${weekRows}</div>
                    </div>` : `
                    <div class="summary-weekly-section">
                        <h3 class="summary-section-title"><i class="bi bi-graph-up-arrow"></i> Weekly Momentum</h3>
                        <p class="text-sm text-gray-400 italic">No weekly check-ins have been logged for this month.</p>
                    </div>`}

                    <div class="summary-review-section">
                        <h3 class="summary-section-title"><i class="bi bi-journal-check"></i> End of Month Review</h3>
                        ${hasReview ? `
                        <div class="summary-review-items">
                            <div class="summary-review-item">
                                <div class="summary-review-icon summary-review-icon--win"><i class="bi bi-trophy-fill"></i></div>
                                <h4 class="summary-review-label">Biggest Win</h4>
                                <div class="summary-review-text prose prose-sm">${e(formData[`m${monthNum}s6_win`])}</div>
                            </div>
                            <div class="summary-review-item">
                                <div class="summary-review-icon summary-review-icon--challenge"><i class="bi bi-lightbulb-fill"></i></div>
                                <h4 class="summary-review-label">Challenge & Learning</h4>
                                <div class="summary-review-text prose prose-sm">${e(formData[`m${monthNum}s6_challenge`])}</div>
                            </div>
                            <div class="summary-review-item">
                                <div class="summary-review-icon summary-review-icon--next"><i class="bi bi-rocket-takeoff-fill"></i></div>
                                <h4 class="summary-review-label">Next Month Focus</h4>
                                <div class="summary-review-text prose prose-sm">${e(formData[`m${monthNum}s6_next`])}</div>
                            </div>
                        </div>` : '<p class="text-sm text-gray-400 italic">End of month review has not been completed yet.</p>'}
                    </div>
                </div>
            </div>`;
    };

    DOMElements.contentArea.innerHTML = `<div class="summary-redesigned">
        <div class="summary-hero-card">
            <div class="summary-hero-banner">
                <div class="summary-hero-plan-name">${formData.planName || 'Growth Plan'}</div>
                <div class="summary-hero-plan-sub">${formData.quarter || 'Quarterly'} Overview</div>
            </div>
            <div class="summary-hero-meta">
                <div class="summary-meta-item">
                    <div class="summary-meta-icon"><i class="bi bi-person-fill"></i></div>
                    <div>
                        <span class="summary-meta-label">Manager</span>
                        <span class="summary-meta-value">${formData.managerName || '...'}</span>
                    </div>
                </div>
                <div class="summary-meta-item">
                    <div class="summary-meta-icon"><i class="bi bi-shop"></i></div>
                    <div>
                        <span class="summary-meta-label">Bakery</span>
                        <span class="summary-meta-value">${formData.bakeryLocation || '...'}</span>
                    </div>
                </div>
                <div class="summary-meta-item">
                    <div class="summary-meta-icon"><i class="bi bi-calendar3"></i></div>
                    <div>
                        <span class="summary-meta-label">Quarter</span>
                        <span class="summary-meta-value">${formData.quarter || '...'}</span>
                    </div>
                </div>
            </div>

            <div class="summary-vision-block">
                <h3 class="summary-vision-label"><i class="bi bi-binoculars-fill"></i> Quarterly Vision</h3>
                <div class="summary-vision-text prose prose-sm">${e(formData.quarterlyTheme)}</div>
            </div>

            <div class="summary-objectives">
                <h3 class="summary-objectives-title">Key Monthly Objectives</h3>
                <div class="summary-objectives-grid">
                    <div class="summary-objective-card">
                        <div class="summary-objective-header">
                            <span class="summary-objective-num" style="background-color: ${monthColors[1]}">1</span>
                            <span class="summary-objective-label">Month 1</span>
                        </div>
                        <div class="summary-objective-text prose prose-sm">${e(formData.month1Goal)}</div>
                    </div>
                    <div class="summary-objective-card">
                        <div class="summary-objective-header">
                            <span class="summary-objective-num" style="background-color: ${monthColors[2]}">2</span>
                            <span class="summary-objective-label">Month 2</span>
                        </div>
                        <div class="summary-objective-text prose prose-sm">${e(formData.month2Goal)}</div>
                    </div>
                    <div class="summary-objective-card">
                        <div class="summary-objective-header">
                            <span class="summary-objective-num" style="background-color: ${monthColors[3]}">3</span>
                            <span class="summary-objective-label">Month 3</span>
                        </div>
                        <div class="summary-objective-text prose prose-sm">${e(formData.month3Goal)}</div>
                    </div>
                </div>
            </div>
        </div>

        <div id="monthly-sections">
            ${renderMonthSummary(1)}
            ${renderMonthSummary(2)}
            ${renderMonthSummary(3)}
        </div>

        <div class="summary-quarterly-reflection content-card">
            <div class="summary-reflection-header">
                <i class="bi bi-mortarboard-fill"></i>
                <h2 class="text-2xl font-bold font-poppins">Final Quarterly Reflection</h2>
            </div>
            <div class="summary-reflection-grid">
                <div class="summary-reflection-item">
                    <div class="summary-reflection-icon" style="background-color: #D1FAE5; color: #065F46;"><i class="bi bi-award-fill"></i></div>
                    <h3 class="font-bold text-base text-gray-800">Biggest Achievements</h3>
                    <div class="text-gray-600 prose prose-sm">${e(formData.m3s7_achievements)}</div>
                </div>
                <div class="summary-reflection-item">
                    <div class="summary-reflection-icon" style="background-color: #FEF3C7; color: #92400E;"><i class="bi bi-bar-chart-line-fill"></i></div>
                    <h3 class="font-bold text-base text-gray-800">Challenges & Learnings</h3>
                    <div class="text-gray-600 prose prose-sm">${e(formData.m3s7_challenges)}</div>
                </div>
                <div class="summary-reflection-item">
                    <div class="summary-reflection-icon" style="background-color: #EFF6FF; color: #1E40AF;"><i class="bi bi-bullseye"></i></div>
                    <h3 class="font-bold text-base text-gray-800">Performance vs Narrative</h3>
                    <div class="text-gray-600 prose prose-sm">${e(formData.m3s7_narrative)}</div>
                </div>
                <div class="summary-reflection-item">
                    <div class="summary-reflection-icon" style="background-color: #FFF1F2; color: #D10A11;"><i class="bi bi-forward-fill"></i></div>
                    <h3 class="font-bold text-base text-gray-800">Focus For Next Quarter</h3>
                    <div class="text-gray-600 prose prose-sm">${e(formData.m3s7_next_quarter)}</div>
                </div>
            </div>
        </div>
    </div>`;
}

function updateHeaderForView(viewId) {
    const config = getViewTitleConfig(viewId);
    if (!config) return;
    if (DOMElements.headerTitle) {
        DOMElements.headerTitle.textContent = config.title || 'Growth Plan';
    }
    if (DOMElements.headerSubtitle) {
        DOMElements.headerSubtitle.textContent = config.subtitle || '';
    }
}

function switchView(viewId) {
    DOMElements.mainContent.scrollTop = 0;
    appState.currentView = viewId;
    sessionStorage.setItem('lastPlanId', appState.currentPlanId);
    sessionStorage.setItem('lastViewId', viewId);

    updateHeaderForView(viewId);

    const isSummaryView = viewId === 'summary';
    const isFilesView = viewId === 'files'; 

    DOMElements.desktopHeaderButtons.classList.toggle('hidden', !isSummaryView);

    if (isSummaryView) {
        renderSummary();
    } else if (isFilesView) {
        renderFilesView(DOMElements.contentArea);
    } else {
        const monthNumStr = viewId.startsWith('month-') ? viewId.split('-')[1] : null;
        const monthNum = monthNumStr ? parseInt(monthNumStr, 10) : null;
        if (monthNum) {
            const weeks = getFormattedWeeks(monthNum, appState.planData);
            const activeWeekIndex = getActiveWeekIndex(weeks);
            DOMElements.contentArea.innerHTML = templates.month(monthNum, { weeks, activeWeekIndex });
        } else {
            DOMElements.contentArea.innerHTML = templates.vision.html;
        }

        cacheFormElements();
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
            if (JSON.stringify(remoteData) !== JSON.stringify(appState.planData)) {
                appState.planData = remoteData;
                updateViewWithRemoteData(remoteData);
                updateUI();
            }
        } else {
            console.error("Plan document not found! Returning to dashboard.");
            document.dispatchEvent(new CustomEvent('back-to-dashboard'));
        }
    }, (error) => {
        console.error("Error listening to plan changes:", error);
        document.dispatchEvent(new CustomEvent('back-to-dashboard'));
    });

    planDocRef.get().then(doc => {
        if (doc.exists) {
            appState.planData = doc.data();
            updateUI();
            const lastViewId = sessionStorage.getItem('lastViewId') || 'vision';
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
    state.forceSave = () => saveData(true);
    
    if (!DOMElements.mainNav) {
        return;
    }

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
            
            const payload = {};
            payload[dataKey] = selectedPillars.length > 0 ? selectedPillars : firebase.firestore.FieldValue.delete();
            appState.planData[dataKey] = selectedPillars.length > 0 ? selectedPillars : undefined;
            if (selectedPillars.length === 0) delete appState.planData[dataKey];
            
            const docRef = db.collection("users").doc(appState.currentUser.uid).collection("plans").doc(appState.currentPlanId);
            docRef.update({
                ...payload,
                lastEdited: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(error => console.error("Error updating pillar:", error));
            return;
        }

        const statusButton = e.target.closest('.status-button');
        if (statusButton) {
            const alreadySelected = statusButton.classList.contains('selected');
            const parent = statusButton.parentElement;
            parent.querySelectorAll('.status-button').forEach(btn => btn.classList.remove('selected'));

            const monthNum = appState.currentView.split('-')[1];
            const week = parent.dataset.weekIndex;
            const key = `m${monthNum}s5_w${week}_status`;
            const payload = {};

            if (!alreadySelected) {
                statusButton.classList.add('selected');
                const newStatus = statusButton.dataset.status;
                payload[key] = newStatus;
                appState.planData[key] = newStatus;
            } else {
                payload[key] = firebase.firestore.FieldValue.delete();
                delete appState.planData[key];
            }

            const docRef = db.collection("users").doc(appState.currentUser.uid).collection("plans").doc(appState.currentPlanId);
            docRef.update({
                ...payload,
                lastEdited: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(error => console.error("Error updating status:", error));
        }
        const tab = e.target.closest('.weekly-tab');
        if (tab) {
            e.preventDefault();
            const weekIndex = tab.dataset.weekIndex;
            const weekLabel = tab.dataset.weekLabel;
            document.querySelectorAll('.weekly-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.weekly-tab-panel').forEach(p => {
                p.classList.toggle('hidden', p.dataset.weekPanel !== weekIndex);
            });
            document.querySelectorAll('[id^="weekly-progress-label-"]').forEach((label) => {
                const labelWeek = label.dataset.weekIndex || label.id.split('-').pop();
                const labelText = label.dataset.weekLabel || weekLabel;
                if (!label.dataset.weekLabel && weekLabel) {
                    label.dataset.weekLabel = weekLabel;
                }
                label.textContent = labelText
                    ? `Week ${labelWeek} Progress (${labelText}):`
                    : `Week ${labelWeek} Progress:`;
            });
            resetWeeklyProgressLabels();
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
        const planSummary = summarizePlanForActionPlan(appState.planData);
        handleAIActionPlan(appState, saveData, planSummary);
    });

    const actionPlanButton = document.getElementById('radial-action-plan');
    if (actionPlanButton) {
        actionPlanButton.addEventListener('click', () => {
            const planSummary = summarizePlanForActionPlan(appState.planData);
            handleAIActionPlan(appState, saveData, planSummary);
            document.getElementById('radial-menu-container').classList.remove('open');
        });
    }

    const sidebarLogoLink = document.getElementById('sidebar-logo-link');
     if (sidebarLogoLink) {
         sidebarLogoLink.addEventListener('click', (e) => {
             e.preventDefault();
             document.dispatchEvent(new CustomEvent('back-to-dashboard'));
         });
     }

    const geminiButton = document.getElementById('radial-action-gemini');
    if (geminiButton) {
        geminiButton.addEventListener('click', () => {
            openChat();
            document.getElementById('radial-menu-container').classList.remove('open');
        });
    }
}
