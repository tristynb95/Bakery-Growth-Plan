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

    const renderSummary = (formData) => {
        const e = (html) => {
            if (!html) return '...';
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            if (tempDiv.innerText.trim() === '') {
                return '...';
            }
            
            // This removes unwanted style attributes from every element
            tempDiv.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));

            // This removes useless span tags but keeps the text inside them
            tempDiv.querySelectorAll('span, font').forEach(el => {
                if (el.childNodes.length > 0) {
                    el.replaceWith(...el.childNodes);
                } else {
                    el.remove();
                }
            });

            // Intelligently convert block elements to line breaks
            let finalHtml = tempDiv.innerHTML
                .replace(/<p(.*?)>/gi, '') // Remove opening <p> tags
                .replace(/<\/p>/gi, '<br>') // Replace closing </p> with a line break
                .replace(/<div(.*?)>/gi, '') // Remove opening <div> tags
                .replace(/<\/div>/gi, '<br>'); // Replace closing </div> with a line break
            
            // Clean up multiple, leading, and trailing line breaks for a neat finish
            finalHtml = finalHtml.replace(/(<br\s*\/?>\s*){2,}/gi, '<br><br>');
            finalHtml = finalHtml.trim().replace(/^(<br\s*\/?>\s*)+|(<br\s*\/?>\s*)+$/gi, '');

            return finalHtml;
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
                // ... (logic to get status, win, etc.)
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
                        checkinContent += `<p class="text-sm text-gray-600 mb-2"><strong>Win/Learning:</strong><br>${e(win)}</p>`;
                    }
                    if (!isContentEmpty(spotlight)) {
                        checkinContent += `<p class="text-sm text-gray-600 mb-2"><strong>Breadhead Spotlight:</strong><br>${e(spotlight)}</p>`;
                    }
                    if (!isContentEmpty(shine)) {
                        checkinContent += `<p class="text-sm text-gray-600"><strong>SHINE Focus:</strong><br>${e(shine)}</p>`;
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

            return `
                <div class="content-card p-0 overflow-hidden mt-8">
                    <h2 class="text-2xl font-bold font-poppins p-6 bg-gray-50 border-b">Month ${monthNum} Plan</h2>
                    <div class="summary-grid">
                        <div class="p-6">
                            ${pillarHTML}
                            <div class="summary-section">
                                <h3 class="summary-heading">Must-Win Battle</h3>
                                <div class="summary-content text-sm">${e(formData[`m${monthNum}s1_battle`])}</div>
                            </div>
                            <div class="summary-section">
                                <h3 class="summary-heading">Key Actions</h3>
                                <div class="summary-content text-sm">${e(formData[`m${monthNum}s2_levers`])}</div>
                            </div>
                            <div class="summary-section">
                                <h3 class="summary-heading">Developing Our Breadheads</h3>
                                <div class="summary-content text-sm">${e(formData[`m${monthNum}s3_people`])}</div>
                            </div>
                            <div class="summary-section">
                                <h3 class="summary-heading">Upholding Pillars</h3>
                                <ul class="space-y-3 mt-2">
                                    <li class="flex items-start text-sm"><i class="bi bi-people-fill w-5 text-center mr-3 text-gray-400"></i><span class="flex-1">${e(formData[`m${monthNum}s4_people`])}</span></li>
                                    <li class="flex items-start text-sm"><i class="bi bi-cup-hot-fill w-5 text-center mr-3 text-gray-400"></i><span class="flex-1">${e(formData[`m${monthNum}s4_product`])}</span></li>
                                    <li class="flex items-start text-sm"><i class="bi bi-heart-fill w-5 text-center mr-3 text-gray-400"></i><span class="flex-1">${e(formData[`m${monthNum}s4_customer`])}</span></li>
                                    <li class="flex items-start text-sm"><i class="bi bi-shop w-5 text-center mr-3 text-gray-400"></i><span class="flex-1">${e(formData[`m${monthNum}s4_place`])}</span></li>
                                </ul>
                            </div>
                        </div>
                        <div class="p-6 bg-gray-50/70 border-l">
                            <div class="summary-section">
                                <h3 class="summary-heading">Weekly Momentum</h3>
                                ${weeklyCheckinHTML}
                            </div>
                        </div>
                    </div>
                    <div class="p-6 bg-red-50 border-t border-gray-200">
                        <h3 class="summary-heading !text-red-800">End of Month Review</h3>
                        <ul class="space-y-3 mt-2">
                            <li class="flex items-start text-sm"><i class="bi bi-trophy-fill w-5 text-center mr-3 text-red-400"></i><span class="flex-1"><strong class="font-semibold text-gray-700">Biggest Win:</strong> ${e(formData[`m${monthNum}s6_win`])}</span></li>
                            <li class="flex items-start text-sm"><i class="bi bi-lightbulb-fill w-5 text-center mr-3 text-red-400"></i><span class="flex-1"><strong class="font-semibold text-gray-700">Toughest Challenge & Learning:</strong> ${e(formData[`m${monthNum}s6_challenge`])}</span></li>
                            <li class="flex items-start text-sm"><i class="bi bi-rocket-takeoff-fill w-5 text-center mr-3 text-red-400"></i><span class="flex-1"><strong class="font-semibold text-gray-700">Focus for Next Month:</strong> ${e(formData[`m${monthNum}s6_next`])}</span></li>
                        </ul>
                    </div>
                </div>`;
        };
        

        DOMElements.headerTitle.textContent = formData.planName || 'Growth Plan Summary';
        DOMElements.headerSubtitle.textContent = `A read-only summary for ${formData.bakeryLocation || 'the bakery'}.`;

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
                        <div><strong class="font-semibold text-gray-600 block">Month 1 Goal:</strong><div class="text-gray-800 mt-1 prose prose-sm">${e(formData.month1Goal)}</div></div>
                        <div><strong class="font-semibold text-gray-600 block">Month 2 Goal:</strong><div class="text-gray-800 mt-1 prose prose-sm">${e(formData.month2Goal)}</div></div>
                        <div><strong class="font-semibold text-gray-600 block">Month 3 Goal:</strong><div class="text-gray-800 mt-1 prose prose-sm">${e(formData.month3Goal)}</div></div>
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
