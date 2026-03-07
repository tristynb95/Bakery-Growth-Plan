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
    const auth = firebase.auth();

    // Combined Conflict Resolution: Using the dynamic Admin Roles logic
    const OWNER_EMAIL = 'tristen_bayley@gailsbread.co.uk';
    const ADMIN_ROLES_DOC = 'adminRoles';

    const DOMElements = {
        headerTitle: document.getElementById('header-title'),
        headerSubtitle: document.getElementById('header-subtitle'),
        contentArea: document.getElementById('content-area'),
    };

    const normalizeEmail = (email) => (email || '').trim().toLowerCase();

    const loadAdminRoles = async () => {
        const ownerEmail = normalizeEmail(OWNER_EMAIL);
        const docRef = db.collection('settings').doc(ADMIN_ROLES_DOC);
        const doc = await docRef.get();

        let resolvedOwner = ownerEmail;
        let admins = [ownerEmail];

        if (doc.exists) {
            const data = doc.data() || {};
            const configuredOwner = normalizeEmail(data.ownerEmail);
            const configuredAdmins = Array.isArray(data.admins)
                ? data.admins.map(normalizeEmail).filter(Boolean)
                : [];

            if (configuredOwner) {
                resolvedOwner = configuredOwner;
            }

            admins = [...new Set([...configuredAdmins, resolvedOwner])];
        }

        if (!doc.exists) {
            await docRef.set({ ownerEmail: resolvedOwner, admins }, { merge: true });
        }

        return { ownerEmail: resolvedOwner, admins };
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

        const getMonthMetadata = (monthNum) => {
            const quarterString = formData.quarter;
            if (quarterString) {
                const match = quarterString.match(/Q([1-4])\s*FY\s*(\d{2,4})/i);
                if (match) {
                    const quarter = parseInt(match[1], 10);
                    let fiscalYear = parseInt(match[2], 10);
                    if (match[2].length === 2) fiscalYear += 2000;
                    const fiscalYearStart = fiscalYear - 1;
                    const startIndex = (quarter - 1) * 3;
                    const index = Number(monthNum) - 1;
                    if (startIndex >= 0 && startIndex + index < FISCAL_YEAR_MONTHS.length) {
                        const monthInfo = FISCAL_YEAR_MONTHS[startIndex + index];
                        return { month: monthInfo.month, year: fiscalYearStart + monthInfo.yearOffset };
                    }
                }
            }
            const baseDate = new Date();
            baseDate.setDate(1);
            baseDate.setMonth(baseDate.getMonth() + (Number(monthNum) - 1));
            return { month: baseDate.getMonth() + 1, year: baseDate.getFullYear() };
        };

        const generateWeeksForMonth = (month, year) => {
            const targetMonth = month - 1;
            const firstDay = new Date(year, targetMonth, 1);
            const lastDay = new Date(year, targetMonth + 1, 0);
            const weeks = [];
            const start = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate());
            const day = start.getDay();
            const diff = day === 0 ? -6 : 1 - day;
            start.setDate(start.getDate() + diff);
            while (start <= lastDay) {
                const weekStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
                const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
                let daysInMonth = 0;
                for (let i = 0; i < 7; i++) {
                    const dayDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
                    if (dayDate.getMonth() === targetMonth) daysInMonth++;
                }
                if (daysInMonth >= 4) weeks.push({ startDate: weekStart, endDate: weekEnd });
                start.setDate(start.getDate() + 7);
            }
            return weeks;
        };

        const getWeeksForMonth = (monthNum) => {
            const metadata = getMonthMetadata(monthNum);
            if (metadata && metadata.month && metadata.year) {
                const weeks = generateWeeksForMonth(metadata.month, metadata.year);
                return weeks.map((_, idx) => idx + 1);
            }
            return [1, 2, 3, 4];
        };

        const monthColors = { 1: '#D10A11', 2: '#B45309', 3: '#065F46' };
        const colorNames = { 1: 'red', 2: 'amber', 3: 'green' };
        const dotClasses = { 'on-track': 'dot-on-track', 'issues': 'dot-issues', 'off-track': 'dot-off-track' };

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
                    const dotClass = dotClasses[status] || 'dot-on-track';
                    let details = '';
                    if (!isContentEmpty(win)) details += `<div class="summary-week-detail"><i class="bi bi-trophy text-amber-500"></i><div><strong>Win/Learning</strong><div class="prose prose-sm">${e(win)}</div></div></div>`;
                    if (!isContentEmpty(spotlight)) details += `<div class="summary-week-detail"><i class="bi bi-star text-purple-500"></i><div><strong>Breadhead Spotlight</strong><div class="prose prose-sm">${e(spotlight)}</div></div></div>`;
                    if (!isContentEmpty(shine)) details += `<div class="summary-week-detail"><i class="bi bi-brightness-high text-amber-500"></i><div><strong>SHINE Focus</strong><div class="prose prose-sm">${e(shine)}</div></div></div>`;
                    if (!details) details = '<p class="text-sm text-gray-400 italic">No details logged.</p>';
                    weekRows += `<div class="summary-week-row"><div class="summary-week-dot ${dotClass}"><span>${w}</span></div><div class="summary-week-content"><div class="summary-week-header"><span class="font-semibold text-gray-700 text-sm">Week ${w}</span>${statusBadgeHTML}</div><div class="summary-week-details">${details}</div></div></div>`;
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
            const totalWeeks = weeksToRender.length;
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
                                    <h2>${planTitle}</h2>
                                    ${pillarBadgesHTML ? `<div class="summary-month-pillars">${pillarBadgesHTML}</div>` : ''}
                                </div>
                            </div>
                            <div class="summary-momentum-indicator">
                                <div class="summary-momentum-ring"><svg viewBox="0 0 36 36"><circle class="ring-bg" cx="18" cy="18" r="${r}"/><circle class="ring-fill" cx="18" cy="18" r="${r}" stroke="${accentColor}" stroke-dasharray="${circ}" stroke-dashoffset="${dashoffset}"/></svg></div>
                                <div class="summary-momentum-text"><span class="summary-momentum-label">Momentum</span><span class="summary-momentum-value" style="color: ${accentColor}">${loggedCount}/${totalWeeks}</span></div>
                            </div>
                        </div>
                    </div>
                    <div class="summary-month-body">
                        <div class="summary-strategy-section">
                            <div class="summary-strategy-card summary-strategy-card--battle"><div class="summary-strategy-icon"><i class="bi bi-crosshair"></i></div><div class="min-w-0"><h3 class="summary-strategy-label">Must-Win Battle</h3><div class="summary-strategy-content prose prose-sm">${e(formData[`m${monthNum}s1_battle`])}</div></div></div>
                            <div class="summary-strategy-card"><div class="summary-strategy-icon"><i class="bi bi-lightning-charge-fill"></i></div><div class="min-w-0"><h3 class="summary-strategy-label">Key Actions</h3><div class="summary-strategy-content prose prose-sm">${e(formData[`m${monthNum}s2_levers`])}</div></div></div>
                            <div class="summary-strategy-card"><div class="summary-strategy-icon"><i class="bi bi-people-fill"></i></div><div class="min-w-0"><h3 class="summary-strategy-label">Developing Our Breadheads</h3><div class="summary-strategy-content prose prose-sm">${e(formData[`m${monthNum}s3_people`])}</div></div></div>
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
                                <div class="summary-review-item"><div class="summary-review-icon summary-review-icon--win"><i class="bi bi-trophy-fill"></i></div><h4 class="summary-review-label">Biggest Win</h4><div class="summary-review-text prose prose-sm">${e(formData[`m${monthNum}s6_win`])}</div></div>
                                <div class="summary-review-item"><div class="summary-review-icon summary-review-icon--challenge"><i class="bi bi-lightbulb-fill"></i></div><h4 class="summary-review-label">Challenge & Learning</h4><div class="summary-review-text prose prose-sm">${e(formData[`m${monthNum}s6_challenge`])}</div></div>
                                <div class="summary-review-item"><div class="summary-review-icon summary-review-icon--next"><i class="bi bi-rocket-takeoff-fill"></i></div><h4 class="summary-review-label">Next Month Focus</h4><div class="summary-review-text prose prose-sm">${e(formData[`m${monthNum}s6_next`])}</div></div>
                            </div>` : '<p class="text-sm text-gray-400 italic">End of month review has not been completed yet.</p>'}
                        </div>
                    </div>
                </div>`;
        };

        DOMElements.headerTitle.textContent = formData.planName || 'Growth Plan Summary';
        DOMElements.headerSubtitle.textContent = `A read-only summary for ${formData.bakeryLocation || 'the bakery'}.`;

        DOMElements.contentArea.innerHTML = `
            <div class="summary-redesigned">
                <div class="summary-hero-card">
                    <div class="summary-hero-banner">
                        <div class="summary-hero-plan-name">${formData.planName || 'Growth Plan'}</div>
                        <div class="summary-hero-plan-sub">${formData.quarter || 'Quarterly'} Overview</div>
                    </div>
                    <div class="summary-hero-meta">
                        <div class="summary-meta-item"><div class="summary-meta-icon"><i class="bi bi-person-fill"></i></div><div><span class="summary-meta-label">Manager</span><span class="summary-meta-value">${formData.managerName || '...'}</span></div></div>
                        <div class="summary-meta-item"><div class="summary-meta-icon"><i class="bi bi-shop"></i></div><div><span class="summary-meta-label">Bakery</span><span class="summary-meta-value">${formData.bakeryLocation || '...'}</span></div></div>
                        <div class="summary-meta-item"><div class="summary-meta-icon"><i class="bi bi-calendar3"></i></div><div><span class="summary-meta-label">Quarter</span><span class="summary-meta-value">${formData.quarter || '...'}</span></div></div>
                    </div>
                    <div class="summary-vision-block">
                        <h3 class="summary-vision-label"><i class="bi bi-stars"></i> Quarterly Vision</h3>
                        <div class="summary-vision-text prose prose-sm">${e(formData.quarterlyTheme)}</div>
                    </div>
                    <div class="summary-objectives">
                        <h3 class="summary-objectives-title">Key Monthly Objectives</h3>
                        <div class="summary-objectives-grid">
                            <div class="summary-objective-card"><div class="summary-objective-header"><span class="summary-objective-num" style="background-color: #D10A11">1</span><span class="summary-objective-label">Month 1</span></div><div class="summary-objective-text prose prose-sm">${e(formData.month1Goal)}</div></div>
                            <div class="summary-objective-card"><div class="summary-objective-header"><span class="summary-objective-num" style="background-color: #B45309">2</span><span class="summary-objective-label">Month 2</span></div><div class="summary-objective-text prose prose-sm">${e(formData.month2Goal)}</div></div>
                            <div class="summary-objective-card"><div class="summary-objective-header"><span class="summary-objective-num" style="background-color: #065F46">3</span><span class="summary-objective-label">Month 3</span></div><div class="summary-objective-text prose prose-sm">${e(formData.month3Goal)}</div></div>
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
                        <div class="summary-reflection-item"><div class="summary-reflection-icon" style="background-color: #FEF3C7; color: #92400E;"><i class="bi bi-bar-chart-line-fill"></i></div><h3 class="font-bold text-base text-gray-800">Challenges & Learnings</h3><div class="text-gray-600 prose prose-sm">${e(formData.m3s7_challenges)}</div></div>
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
            const pointerRef = db.collection('sharedPlans').doc(shareId);
            const pointerDoc = await pointerRef.get();

            if (!pointerDoc.exists) {
                throw new Error('This share link is invalid or has been deleted.');
            }

            const { originalUserId, originalPlanId } = pointerDoc.data();
            const planRef = db.collection('users').doc(originalUserId).collection('plans').doc(originalPlanId);
            const planDoc = await planRef.get();

            if (!planDoc.exists) {
                throw new Error('The original plan could not be found.');
            }
            
            renderSummary(planDoc.data());

        } catch (error) {
            console.error("Error loading shared plan:", error);
            DOMElements.headerTitle.textContent = 'Plan Not Found';
            
            if (error.code === 'permission-denied') {
                DOMElements.headerSubtitle.textContent = 'This growth plan may have been deleted or is no longer being shared.';
            } else {
                DOMElements.headerSubtitle.textContent = error.message;
            }
        }
    };

    const loadAdminPreview = async () => {
        const params = new URLSearchParams(window.location.search);
        const uid = params.get('uid');
        const planId = params.get('planId');

        if (!uid || !planId) {
            DOMElements.headerTitle.textContent = 'Invalid Preview Link';
            DOMElements.headerSubtitle.textContent = 'This admin preview link is missing required details.';
            return;
        }

        try {
            await new Promise((resolve, reject) => {
                const unsubscribe = auth.onAuthStateChanged((user) => {
                    unsubscribe();
                    if (!user) {
                        reject(new Error('admin-auth-required'));
                        return;
                    }
                    resolve(user);
                }, reject);
            });

            // Security check using normalized emails and dynamic roles
            const userEmail = normalizeEmail(auth.currentUser && auth.currentUser.email);
            const adminRoles = await loadAdminRoles();
            if (!adminRoles.admins.includes(userEmail)) {
                throw new Error('admin-auth-required');
            }

            const planRef = db.collection('users').doc(uid).collection('plans').doc(planId);
            const planDoc = await planRef.get();

            if (!planDoc.exists) {
                throw new Error('The selected plan no longer exists.');
            }

            renderSummary(planDoc.data());
        } catch (error) {
            console.error('Error loading admin preview:', error);
            DOMElements.headerTitle.textContent = 'Preview Not Available';
            if (error.message === 'admin-auth-required') {
                DOMElements.headerSubtitle.textContent = 'Only signed-in admins can preview plans from the admin portal.';
                return;
            }
            DOMElements.headerSubtitle.textContent = error.message || 'Could not load the selected plan.';
        }
    };

    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    if (mode === 'admin') {
        loadAdminPreview();
        return;
    }

    loadSharedPlan();
}

document.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();
});