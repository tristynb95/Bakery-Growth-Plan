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
        runViewScript(app);
    } catch (error) {
        console.error("Failed to initialize Firebase:", error);
        document.getElementById('header-title').textContent = 'Error';
        document.getElementById('header-subtitle').textContent = 'Could not load application configuration. Please contact support.';
    }
}

function runViewScript(app) {
    const db = firebase.firestore();
    const DOMElements = {
        headerTitle: document.getElementById('header-title'),
        headerSubtitle: document.getElementById('header-subtitle'),
        contentArea: document.getElementById('content-area'),
    };

    const planTitleMap = {
        1: '30 Day Plan',
        2: '60 Day Plan',
        3: '90 Day Plan'
    };

    const goalLabelMap = {
        1: '30 Day Goal',
        2: '60 Day Goal',
        3: '90 Day Goal'
    };

    const renderSummary = (formData) => {
        const e = (html) => {
            if (!html) return '...';
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            if (tempDiv.innerText.trim() === '') { return '...'; }

            // 1. Sanitize the content to remove unwanted inline styles and junk tags
            tempDiv.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
            tempDiv.querySelectorAll('span, font').forEach(el => {
                if (el.childNodes.length > 0) {
                    el.replaceWith(...el.childNodes);
                } else {
                    el.remove();
                }
            });
            
            return tempDiv.innerHTML;
        };
        
        const isContentEmpty = (htmlContent) => {
            if (!htmlContent) return true;
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;
            return tempDiv.innerText.trim() === '';
        };

        const getWeeksForMonth = (monthNum) => {
            const weekPattern = new RegExp(`^m${monthNum}s5_w(\d+)_(status|win|spotlight|shine)$`);
            const detectedWeeks = Object.keys(formData)
                .map((key) => {
                    const match = key.match(weekPattern);
                    return match ? parseInt(match[1], 10) : null;
                })
                .filter((weekNum) => Number.isInteger(weekNum));

            if (detectedWeeks.length > 0) {
                return Array.from(new Set(detectedWeeks))
                    .sort((a, b) => a - b)
                    .slice(0, 5);
            }

            return [1, 2, 3, 4, 5];
        };

        const renderMonthSummary = (monthNum) => {
            const planTitle = planTitleMap[monthNum] || `Month ${monthNum} Plan`;
            let weeklyCheckins = [];
            let hasLoggedWeeks = false;
            const weeksToRender = getWeeksForMonth(monthNum);
            weeksToRender.forEach((w) => {
                const status = formData[`m${monthNum}s5_w${w}_status`];
                const win = formData[`m${monthNum}s5_w${w}_win`];
                const spotlight = formData[`m${monthNum}s5_w${w}_spotlight`];
                const shine = formData[`m${monthNum}s5_w${w}_shine`];

                if (status) {
                    hasLoggedWeeks = true;
                    const statusText = status.replace('-', ' ').toUpperCase();
                    const statusBadgeHTML = `<span class="summary-status-badge status-${status}">${statusText}</span>`;

                    const detailBlocks = [];
                    if (!isContentEmpty(win)) {
                        detailBlocks.push(`
                            <div class="weekly-checkin__detail">
                                <span class="weekly-checkin__label">Win / Learning</span>
                                <div class="weekly-checkin__value">${e(win)}</div>
                            </div>`);
                    }
                    if (!isContentEmpty(spotlight)) {
                        detailBlocks.push(`
                            <div class="weekly-checkin__detail">
                                <span class="weekly-checkin__label">Breadhead Spotlight</span>
                                <div class="weekly-checkin__value">${e(spotlight)}</div>
                            </div>`);
                    }
                    if (!isContentEmpty(shine)) {
                        detailBlocks.push(`
                            <div class="weekly-checkin__detail">
                                <span class="weekly-checkin__label">SHINE Focus</span>
                                <div class="weekly-checkin__value">${e(shine)}</div>
                            </div>`);
                    }

                    const checkinContent = detailBlocks.length > 0
                        ? detailBlocks.join('')
                        : '<p class="text-sm text-gray-500 italic">No details logged for this week.</p>';

                    weeklyCheckins.push(`
                        <article class="weekly-checkin">
                            <div class="weekly-checkin__meta">
                                <span class="weekly-checkin__week">Week ${w}</span>
                                ${statusBadgeHTML}
                            </div>
                            <div class="weekly-checkin__body">
                                ${checkinContent}
                            </div>
                        </article>
                    `);
                }
            });

            if (!hasLoggedWeeks) {
                weeklyCheckins = ['<p class="text-sm text-gray-500 italic">No weekly check-ins have been logged for this month.</p>'];
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

            const powerUpQuestion = formData[`m${monthNum}s2_powerup_q`];
            const powerUpIdea = formData[`m${monthNum}s2_powerup_a`];

            let teamPowerUpHTML = '';
            if (!isContentEmpty(powerUpQuestion) || !isContentEmpty(powerUpIdea)) {
                teamPowerUpHTML = `
                    <section class="summary-panel">
                        <h3 class="summary-heading">Team Power-Up</h3>
                        <div class="team-powerup">
                            ${!isContentEmpty(powerUpQuestion) ? `
                                <div class="team-powerup__item">
                                    <span class="team-powerup__label">Question</span>
                                    <div class="team-powerup__value">${e(powerUpQuestion)}</div>
                                </div>
                            ` : ''}
                            ${!isContentEmpty(powerUpIdea) ? `
                                <div class="team-powerup__item">
                                    <span class="team-powerup__label">Winning Idea</span>
                                    <div class="team-powerup__value">${e(powerUpIdea)}</div>
                                </div>
                            ` : ''}
                        </div>
                    </section>`;
            }

            const pillarHTML = pillarBadgesHTML
                ? `<div class="monthly-summary__pillars"><span class="monthly-summary__pillars-label">Pillar Focus:</span>${pillarBadgesHTML}</div>`
                : '';

            return `
                <section class="content-card monthly-summary mt-8">
                    <header class="monthly-summary__header">
                        <div>
                            <p class="monthly-summary__eyebrow">${planTitle}</p>
                            <h2 class="monthly-summary__title">Focus & Momentum</h2>
                        </div>
                        ${pillarHTML}
                    </header>
                    <div class="monthly-summary__body">
                        <div class="monthly-summary__column monthly-summary__column--focus">
                            <section class="summary-panel">
                                <h3 class="summary-heading">Must-Win Battle</h3>
                                <div class="summary-content text-sm">${e(formData[`m${monthNum}s1_battle`])}</div>
                            </section>
                            <section class="summary-panel">
                                <h3 class="summary-heading">Key Actions</h3>
                                <div class="summary-content text-sm">${e(formData[`m${monthNum}s2_levers`])}</div>
                            </section>
                            ${teamPowerUpHTML}
                            <section class="summary-panel">
                                <h3 class="summary-heading">Developing Our Breadheads</h3>
                                <div class="summary-content text-sm">${e(formData[`m${monthNum}s3_people`])}</div>
                            </section>
                            <section class="summary-panel">
                                <h3 class="summary-heading">Upholding Our Pillars</h3>
                                <ul class="pillar-checklist">
                                    <li class="pillar-checklist__item"><i class="bi bi-people-fill"></i><span>${e(formData[`m${monthNum}s4_people`])}</span></li>
                                    <li class="pillar-checklist__item"><i class="bi bi-cup-hot-fill"></i><span>${e(formData[`m${monthNum}s4_product`])}</span></li>
                                    <li class="pillar-checklist__item"><i class="bi bi-heart-fill"></i><span>${e(formData[`m${monthNum}s4_customer`])}</span></li>
                                    <li class="pillar-checklist__item"><i class="bi bi-shop"></i><span>${e(formData[`m${monthNum}s4_place`])}</span></li>
                                </ul>
                            </section>
                        </div>
                        <div class="monthly-summary__column monthly-summary__column--weekly">
                            <section class="summary-panel">
                                <h3 class="summary-heading">Weekly Momentum</h3>
                                <div class="weekly-checkin-list">
                                    ${weeklyCheckins.join('')}
                                </div>
                            </section>
                        </div>
                    </div>
                    <footer class="monthly-summary__footer">
                        <h3 class="summary-heading">End of Month Review</h3>
                        <div class="monthly-review-grid">
                            <article class="monthly-review-card">
                                <div class="monthly-review-card__header">
                                    <i class="bi bi-trophy-fill"></i>
                                    <span>Biggest Win</span>
                                </div>
                                <div class="monthly-review-card__body">${e(formData[`m${monthNum}s6_win`])}</div>
                            </article>
                            <article class="monthly-review-card">
                                <div class="monthly-review-card__header">
                                    <i class="bi bi-lightbulb-fill"></i>
                                    <span>Toughest Challenge & Learning</span>
                                </div>
                                <div class="monthly-review-card__body">${e(formData[`m${monthNum}s6_challenge`])}</div>
                            </article>
                            <article class="monthly-review-card">
                                <div class="monthly-review-card__header">
                                    <i class="bi bi-rocket-takeoff-fill"></i>
                                    <span>Focus for Next Month</span>
                                </div>
                                <div class="monthly-review-card__body">${e(formData[`m${monthNum}s6_next`])}</div>
                            </article>
                        </div>
                    </footer>
                </section>`;
        };
        

        DOMElements.headerTitle.textContent = formData.planName || 'Growth Plan Summary';
        DOMElements.headerSubtitle.textContent = `A read-only summary for ${formData.bakeryLocation || 'the bakery'}.`;

        const monthlyGoalsHTML = [1, 2, 3]
            .map((monthNum) => {
                const goalLabel = goalLabelMap[monthNum] || `Month ${monthNum} Goal`;
                const goalContent = e(formData[`month${monthNum}Goal`]);
                return `<div><strong class="font-semibold text-gray-600 block">${goalLabel}:</strong><div class="text-gray-800 mt-1 prose prose-sm">${goalContent}</div></div>`;
            })
            .join('');

        DOMElements.contentArea.innerHTML = `
            <div class="space-y-8 summary-content">
                <div id="quarter-overview" class="content-card p-6">
                    <h2 class="text-2xl font-bold font-poppins mb-4">Quarterly Overview</h2>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-4 mb-4">
                        <div><h4 class="font-semibold text-sm text-gray-500">Manager</h4><p class="text-gray-800 font-medium">${formData.managerName || '...'}</p></div>
                        <div><h4 class="font-semibold text-sm text-gray-500">Bakery</h4><p class="text-gray-800 font-medium">${formData.bakeryLocation || '...'}</p></div>
                        <div><h4 class="font-semibold text-sm text-gray-500">Quarter</h4><p class="text-gray-800 font-medium">${formData.quarter || '...'}</p></div>
                    </div>
                    <div class="mb-6"><h4 class="font-semibold text-sm text-gray-500">Quarterly Theme</h4><div class="text-gray-800 prose prose-sm">${e(formData.quarterlyTheme)}</div></div>
                    <div><h3 class="text-lg font-bold border-b pb-2 mb-3">Key Monthly Objectives</h3><div class="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                        ${monthlyGoalsHTML}
                    </div></div>
                </div>
                <div id="monthly-sections">
                    ${renderMonthSummary(1)}
                    ${renderMonthSummary(2)}
                    ${renderMonthSummary(3)}
                    <div class="content-card p-6 mt-8" style="background-color: var(--review-blue-bg); border-color: var(--review-blue-border);">
                        <h2 class="text-2xl font-bold mb-4" style="color: var(--review-blue-text);">Final Quarterly Reflection</h2>
                        <div class="space-y-4">
                            <div><h3 class="font-bold text-lg flex items-center gap-2" style="color: var(--review-blue-text);"><i class="bi bi-award-fill"></i> Biggest Achievements</h3><div class="text-gray-700 mt-1 prose prose-sm">${e(formData.m3s7_achievements)}</div></div>
                            <div><h3 class="font-bold text-lg flex items-center gap-2" style="color: var(--review-blue-text);"><i class="bi bi-bar-chart-line-fill"></i> Biggest Challenges & Learnings</h3><div class="text-gray-700 mt-1 prose prose-sm">${e(formData.m3s7_challenges)}</div></div>
                            <div><h3 class="font-bold text-lg flex items-center gap-2" style="color: var(--review-blue-text);"><i class="bi bi-bullseye"></i> Performance vs Narrative</h3><div class="text-gray-700 mt-1 prose prose-sm">${e(formData.m3s7_narrative)}</div></div>
                            <div><h3 class="font-bold text-lg flex items-center gap-2" style="color: var(--review-blue-text);"><i class="bi bi-forward-fill"></i> Focus For Next Quarter</h3><div class="text-gray-700 mt-1 prose prose-sm">${e(formData.m3s7_next_quarter)}</div></div>
                        </div>
                    </div>
                </div>
            </div>`;
    };

    const loadSharedPlan = async () => {
        const params = new URLSearchParams(window.location.search);
        const shareId = params.get('id');

        if (!shareId) {
            DOMElements.headerTitle.textContent = 'Invalid Link';
            DOMElements.headerSubtitle.textContent = 'This share link is missing its ID.';
            return;
        }

        try {
            // 1. Get the pointer document from the 'sharedPlans' collection
            const pointerRef = db.collection('sharedPlans').doc(shareId);
            const pointerDoc = await pointerRef.get();

            if (!pointerDoc.exists) {
                throw new Error('This share link is invalid or has been deleted.');
            }

            const { originalUserId, originalPlanId } = pointerDoc.data();

            // 2. Use the pointer to get the actual plan document
            const planRef = db.collection('users').doc(originalUserId).collection('plans').doc(originalPlanId);
            const planDoc = await planRef.get();

            if (!planDoc.exists) {
                throw new Error('The original plan could not be found.');
            }
            
            // 3. Render the summary
            renderSummary(planDoc.data());

        } catch (error) {
            console.error("Error loading shared plan:", error);
            // This is the updated, user-friendly error handling
            DOMElements.headerTitle.textContent = 'Plan Not Found';
            
            if (error.code === 'permission-denied') {
                DOMElements.headerSubtitle.textContent = 'This growth plan may have been deleted or is no longer being shared.';
            } else {
                DOMElements.headerSubtitle.textContent = error.message;
            }
        }
    };

    loadSharedPlan();
}

document.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();
});
