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

        const getWeeksForMonth = (monthNum) => {
            const weekPattern = new RegExp(`^m${monthNum}s5_w(\\d+)_(status|win|spotlight|shine)$`);
            const detectedWeeks = Object.keys(formData)
                .map((key) => { const match = key.match(weekPattern); return match ? parseInt(match[1], 10) : null; })
                .filter((weekNum) => Number.isInteger(weekNum));
            if (detectedWeeks.length > 0) return Array.from(new Set(detectedWeeks)).sort((a, b) => a - b).slice(0, 5);
            return [1, 2, 3, 4, 5];
        };

        const monthColors = { 1: '#D10A11', 2: '#B45309', 3: '#065F46' };

        const renderMonthSummary = (monthNum) => {
            const planTitle = planTitleMap[monthNum] || `Month ${monthNum} Plan`;
            const weeksToRender = getWeeksForMonth(monthNum);
            let loggedCount = 0;
            let weekRows = '';

            weeksToRender.forEach((w) => {
                const status = formData[`m${monthNum}s5_w${w}_status`];
                const win = formData[`m${monthNum}s5_w${w}_win`];
                const spotlight = formData[`m${monthNum}s5_w${w}_spotlight`];
                const shine = formData[`m${monthNum}s5_w${w}_shine`];
                if (status) {
                    loggedCount++;
                    const statusText = status.replace('-', ' ').toUpperCase();
                    const statusBadgeHTML = `<span class="summary-status-badge status-${status}">${statusText}</span>`;
                    let details = '';
                    if (!isContentEmpty(win)) details += `<div class="summary-week-detail"><i class="bi bi-trophy text-amber-500"></i><div><strong>Win/Learning</strong><div class="prose prose-sm">${e(win)}</div></div></div>`;
                    if (!isContentEmpty(spotlight)) details += `<div class="summary-week-detail"><i class="bi bi-star text-purple-500"></i><div><strong>Breadhead Spotlight</strong><div class="prose prose-sm">${e(spotlight)}</div></div></div>`;
                    if (!isContentEmpty(shine)) details += `<div class="summary-week-detail"><i class="bi bi-brightness-high text-amber-500"></i><div><strong>SHINE Focus</strong><div class="prose prose-sm">${e(shine)}</div></div></div>`;
                    if (!details) details = '<p class="text-sm text-gray-400 italic ml-1">No details logged for this week.</p>';
                    weekRows += `<div class="summary-week-row"><div class="summary-week-header"><span class="font-semibold text-gray-700 text-sm">Week ${w}</span>${statusBadgeHTML}</div><div class="summary-week-details">${details}</div></div>`;
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

            return `
                <div class="summary-month-card" id="summary-month-${monthNum}">
                    <div class="summary-month-header" style="border-left-color: ${accentColor}">
                        <div class="summary-month-title-row">
                            <div>
                                <h2 class="text-2xl font-bold font-poppins">${planTitle}</h2>
                                ${pillarBadgesHTML ? `<div class="flex items-center gap-2 mt-2 flex-wrap">${pillarBadgesHTML}</div>` : ''}
                            </div>
                            <div class="summary-momentum-indicator">
                                <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Weekly Momentum</span>
                                <span class="text-lg font-bold" style="color: ${accentColor}">${loggedCount}/${weeksToRender.length}</span>
                            </div>
                        </div>
                    </div>
                    <div class="summary-month-body">
                        <div class="summary-strategy-section">
                            <div class="summary-strategy-card summary-strategy-card--battle"><div class="summary-strategy-icon"><i class="bi bi-crosshair"></i></div><div><h3 class="summary-strategy-label">Must-Win Battle</h3><div class="summary-strategy-content prose prose-sm">${e(formData[`m${monthNum}s1_battle`])}</div></div></div>
                            <div class="summary-strategy-card"><div class="summary-strategy-icon"><i class="bi bi-lightning-charge-fill"></i></div><div><h3 class="summary-strategy-label">Key Actions</h3><div class="summary-strategy-content prose prose-sm">${e(formData[`m${monthNum}s2_levers`])}</div></div></div>
                            <div class="summary-strategy-card"><div class="summary-strategy-icon"><i class="bi bi-people-fill"></i></div><div><h3 class="summary-strategy-label">Developing Our Breadheads</h3><div class="summary-strategy-content prose prose-sm">${e(formData[`m${monthNum}s3_people`])}</div></div></div>
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
                        ${weekRows ? `<div class="summary-weekly-section"><h3 class="summary-section-title"><i class="bi bi-graph-up-arrow"></i> Weekly Momentum</h3><div class="summary-weeks-list">${weekRows}</div></div>`
                            : `<div class="summary-weekly-section"><h3 class="summary-section-title"><i class="bi bi-graph-up-arrow"></i> Weekly Momentum</h3><p class="text-sm text-gray-400 italic">No weekly check-ins have been logged for this month.</p></div>`}
                        <div class="summary-review-section">
                            <h3 class="summary-section-title"><i class="bi bi-journal-check"></i> End of Month Review</h3>
                            ${hasReview ? `<div class="summary-review-items">
                                <div class="summary-review-item"><div class="summary-review-icon summary-review-icon--win"><i class="bi bi-trophy-fill"></i></div><div><h4 class="font-semibold text-sm text-gray-700">Biggest Win</h4><div class="text-sm text-gray-600 prose prose-sm">${e(formData[`m${monthNum}s6_win`])}</div></div></div>
                                <div class="summary-review-item"><div class="summary-review-icon summary-review-icon--challenge"><i class="bi bi-lightbulb-fill"></i></div><div><h4 class="font-semibold text-sm text-gray-700">Toughest Challenge & Learning</h4><div class="text-sm text-gray-600 prose prose-sm">${e(formData[`m${monthNum}s6_challenge`])}</div></div></div>
                                <div class="summary-review-item"><div class="summary-review-icon summary-review-icon--next"><i class="bi bi-rocket-takeoff-fill"></i></div><div><h4 class="font-semibold text-sm text-gray-700">Focus for Next Month</h4><div class="text-sm text-gray-600 prose prose-sm">${e(formData[`m${monthNum}s6_next`])}</div></div></div>
                            </div>` : '<p class="text-sm text-gray-400 italic">End of month review has not been completed yet.</p>'}
                        </div>
                    </div>
                </div>`;
        };

        DOMElements.headerTitle.textContent = formData.planName || 'Growth Plan Summary';
        DOMElements.headerSubtitle.textContent = `A read-only summary for ${formData.bakeryLocation || 'the bakery'}.`;

        DOMElements.contentArea.innerHTML = `
            <div class="summary-redesigned">
                <div class="summary-hero-card content-card">
                    <div class="summary-hero-meta">
                        <div class="summary-meta-item"><i class="bi bi-person-fill summary-meta-icon"></i><div><span class="summary-meta-label">Manager</span><span class="summary-meta-value">${formData.managerName || '...'}</span></div></div>
                        <div class="summary-meta-item"><i class="bi bi-shop summary-meta-icon"></i><div><span class="summary-meta-label">Bakery</span><span class="summary-meta-value">${formData.bakeryLocation || '...'}</span></div></div>
                        <div class="summary-meta-item"><i class="bi bi-calendar3 summary-meta-icon"></i><div><span class="summary-meta-label">Quarter</span><span class="summary-meta-value">${formData.quarter || '...'}</span></div></div>
                    </div>
                    <div class="summary-vision-block">
                        <h3 class="summary-vision-label"><i class="bi bi-binoculars-fill"></i> Quarterly Vision</h3>
                        <div class="summary-vision-text prose prose-sm">${e(formData.quarterlyTheme)}</div>
                    </div>
                    <div class="summary-objectives">
                        <h3 class="summary-objectives-title">Key Monthly Objectives</h3>
                        <div class="summary-objectives-grid">
                            <div class="summary-objective-card"><span class="summary-objective-num" style="background-color: #D10A11">1</span><div><span class="summary-objective-label">Month 1</span><div class="summary-objective-text prose prose-sm">${e(formData.month1Goal)}</div></div></div>
                            <div class="summary-objective-card"><span class="summary-objective-num" style="background-color: #B45309">2</span><div><span class="summary-objective-label">Month 2</span><div class="summary-objective-text prose prose-sm">${e(formData.month2Goal)}</div></div></div>
                            <div class="summary-objective-card"><span class="summary-objective-num" style="background-color: #065F46">3</span><div><span class="summary-objective-label">Month 3</span><div class="summary-objective-text prose prose-sm">${e(formData.month3Goal)}</div></div></div>
                        </div>
                    </div>
                </div>
                <div id="monthly-sections">
                    ${renderMonthSummary(1)}
                    ${renderMonthSummary(2)}
                    ${renderMonthSummary(3)}
                </div>
                <div class="summary-quarterly-reflection content-card">
                    <div class="summary-reflection-header"><i class="bi bi-mortarboard-fill"></i><h2 class="text-2xl font-bold font-poppins">Final Quarterly Reflection</h2></div>
                    <div class="summary-reflection-grid">
                        <div class="summary-reflection-item"><div class="summary-reflection-icon" style="background-color: #D1FAE5; color: #065F46;"><i class="bi bi-award-fill"></i></div><h3 class="font-bold text-base text-gray-800">Biggest Achievements</h3><div class="text-gray-600 prose prose-sm">${e(formData.m3s7_achievements)}</div></div>
                        <div class="summary-reflection-item"><div class="summary-reflection-icon" style="background-color: #FEF3C7; color: #92400E;"><i class="bi bi-bar-chart-line-fill"></i></div><h3 class="font-bold text-base text-gray-800">Biggest Challenges & Learnings</h3><div class="text-gray-600 prose prose-sm">${e(formData.m3s7_challenges)}</div></div>
                        <div class="summary-reflection-item"><div class="summary-reflection-icon" style="background-color: #EFF6FF; color: #1E40AF;"><i class="bi bi-bullseye"></i></div><h3 class="font-bold text-base text-gray-800">Performance vs Narrative</h3><div class="text-gray-600 prose prose-sm">${e(formData.m3s7_narrative)}</div></div>
                        <div class="summary-reflection-item"><div class="summary-reflection-icon" style="background-color: #FFF1F2; color: #D10A11;"><i class="bi bi-forward-fill"></i></div><h3 class="font-bold text-base text-gray-800">Focus For Next Quarter</h3><div class="text-gray-600 prose prose-sm">${e(formData.m3s7_next_quarter)}</div></div>
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
