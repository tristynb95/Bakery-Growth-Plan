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
        const e = (text) => (text || '...').replace(/\n/g, '<br>');
        
        const renderMonthSummary = (monthNum) => {
            let weeklyCheckinHTML = '';
            for (let w = 1; w <= 4; w++) {
                const statusKey = `m${monthNum}s5_w${w}_status`;
                const status = formData[statusKey] || 'N/A';
                const statusColors = { 'on-track': 'bg-green-100 text-green-800', 'issues': 'bg-yellow-100 text-yellow-800', 'off-track': 'bg-red-100 text-red-800', 'N/A': 'bg-gray-100 text-gray-800' };
                const statusBadge = `<span class="text-xs font-semibold ml-2 px-2 py-0.5 rounded-full capitalize ${statusColors[status] || statusColors['N/A']}">${status.replace('-', ' ')}</span>`;
                weeklyCheckinHTML += `<div class="border-t pt-3 mt-3"><h5 class="font-bold text-sm">Week ${w}${statusBadge}</h5><div class="text-sm mt-2"><strong class="text-gray-600">Win/Learning:</strong> <span class="text-gray-800">${e(formData[`m${monthNum}s5_w${w}_win`])}</span></div><div class="text-sm mt-1"><strong class="text-gray-600">Spotlight:</strong> <span class="text-gray-800">${e(formData[`m${monthNum}s5_w${w}_spotlight`])}</span></div></div>`;
            }
    
            const pillar = formData[`m${monthNum}s1_pillar`];
            const pillarIcons = { 'people': '<i class="bi bi-people-fill"></i>', 'product': '<i class="bi bi-cup-hot-fill"></i>', 'customer': '<i class="bi bi-heart-fill"></i>', 'place': '<i class="bi bi-shop"></i>' };
            let pillarHTML = '';
            if (pillar) {
                const pillarIcon = pillarIcons[pillar] || '';
                const pillarText = pillar.charAt(0).toUpperCase() + pillar.slice(1);
                pillarHTML = `<div class="flex items-center gap-2 mb-3"><span class="font-semibold text-sm text-gray-500">Focus Pillar:</span><span class="pillar-badge">${pillarIcon} ${pillarText}</span></div>`;
            }
    
            return `<div class="content-card p-6 mt-8">
                        <h2 class="text-2xl font-bold font-poppins mb-4">Month ${monthNum} Sprint</h2>
                        <div class="space-y-6">
                            <div><h3 class="font-bold border-b pb-2 mb-2 gails-red-text">Must-Win Battle</h3>${pillarHTML} <p class="text-gray-700 whitespace-pre-wrap">${e(formData[`m${monthNum}s1_battle`])}</p></div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                <div><h4 class="font-semibold text-gray-800">Key Levers</h4><p class="text-sm text-gray-700 whitespace-pre-wrap mt-1">${e(formData[`m${monthNum}s2_levers`])}</p></div>
                                <div><h4 class="font-semibold text-gray-800">People Growth</h4><p class="text-sm text-gray-700 whitespace-pre-wrap mt-1">${e(formData[`m${monthNum}s3_people`])}</p></div>
                                <div class="col-span-1"><h4 class="font-semibold text-gray-800">Team Power-Up Question</h4><p class="text-sm text-gray-700 whitespace-pre-wrap mt-1">${e(formData[`m${monthNum}s2_powerup_q`])}</p></div>
                                <div class="col-span-1"><h4 class="font-semibold text-gray-800">Team's Winning Idea</h4><p class="text-sm text-gray-700 whitespace-pre-wrap mt-1">${e(formData[`m${monthNum}s2_powerup_a`])}</p></div>
                            </div>
                            <div><h3 class="font-bold border-b pb-2 mb-2">Protect the Core Behaviours</h3><div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                                <div><strong class="text-gray-600 block"><i class="bi bi-people-fill"></i> People</strong><span class="text-gray-800">${e(formData[`m${monthNum}s4_people`])}</span></div>
                                <div><strong class="text-gray-600 block"><i class="bi bi-cup-hot-fill"></i> Product</strong><span class="text-gray-800">${e(formData[`m${monthNum}s4_product`])}</span></div>
                                <div><strong class="text-gray-600 block"><i class="bi bi-heart-fill"></i> Customer</strong><span class="text-gray-800">${e(formData[`m${monthNum}s4_customer`])}</span></div>
                                <div><strong class="text-gray-600 block"><i class="bi bi-shop"></i> Place</strong><span class="text-gray-800">${e(formData[`m${monthNum}s4_place`])}</span></div>
                            </div></div>
                            <div><h3 class="font-bold border-b pb-2 mb-2">Weekly Momentum Check</h3>${weeklyCheckinHTML}</div>
                            <div><h3 class="font-bold border-b pb-2 mb-2">End of Month Review</h3><div class="text-sm mt-2 space-y-2">
                                <p><strong class="text-gray-600">Biggest Win:</strong> <span class="text-gray-800">${e(formData[`m${monthNum}s6_win`])}</span></p>
                                <p><strong class="text-gray-600">Toughest Challenge:</strong> <span class="text-gray-800">${e(formData[`m${monthNum}s6_challenge`])}</span></p>
                                <p><strong class="text-gray-600">What's Next:</strong> <span class="text-gray-800">${e(formData[`m${monthNum}s6_next`])}</span></p>
                            </div></div>
                        </div>
                    </div>`;
        };
        
        DOMElements.headerTitle.textContent = formData.planName || 'Growth Plan Summary';
        DOMElements.headerSubtitle.textContent = `A read-only summary for ${formData.bakeryLocation || 'the bakery'}.`;

        DOMElements.contentArea.innerHTML = `
            <div class="space-y-8 summary-content">
                <div class="content-card p-6"><h2 class="text-2xl font-bold font-poppins mb-4">Quarterly Vision & Sprints</h2><div class="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-4 mb-4"><div><h4 class="font-semibold text-sm text-gray-500">Manager</h4><p class="text-gray-800 font-medium">${e(formData.managerName)}</p></div><div><h4 class="font-semibold text-sm text-gray-500">Bakery</h4><p class="text-gray-800 font-medium">${e(formData.bakeryLocation)}</p></div><div><h4 class="font-semibold text-sm text-gray-500">Quarter</h4><p class="text-gray-800 font-medium">${e(formData.quarter)}</p></div></div><div class="mb-6"><h4 class="font-semibold text-sm text-gray-500">Quarterly Theme</h4><p class="text-gray-800 whitespace-pre-wrap">${e(formData.quarterlyTheme)}</p></div><div><h3 class="text-lg font-bold border-b pb-2 mb-3">Proposed Monthly Sprints</h3><div class="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3 text-sm"><div><strong class="font-semibold text-gray-600 block">Month 1 Goal:</strong><p class="text-gray-800 mt-1 whitespace-pre-wrap">${e(formData.month1Goal)}</p></div><div><strong class="font-semibold text-gray-600 block">Month 2 Goal:</strong><p class="text-gray-800 mt-1 whitespace-pre-wrap">${e(formData.month2Goal)}</p></div><div><strong class="font-semibold text-gray-600 block">Month 3 Goal:</strong><p class="text-gray-800 mt-1 whitespace-pre-wrap">${e(formData.month3Goal)}</p></div></div></div></div>
                ${renderMonthSummary(1)}
                ${renderMonthSummary(2)}
                ${renderMonthSummary(3)}
                <div class="content-card p-6 mt-8" style="background-color: var(--review-blue-bg); border-color: var(--review-blue-border);"><h2 class="text-2xl font-bold mb-4" style="color: var(--review-blue-text);">Final Quarterly Reflection</h2><div class="space-y-4"><div><h3 class="font-bold text-lg" style="color: var(--review-blue-text);">Biggest Achievements</h3><p class="text-gray-700 whitespace-pre-wrap mt-1">${e(formData.m3s7_achievements)}</p></div><div><h3 class="font-bold text-lg" style="color: var(--review-blue-text);">Biggest Challenges & Learnings</h3><p class="text-gray-700 whitespace-pre-wrap mt-1">${e(formData.m3s7_challenges)}</p></div><div><h3 class="font-bold text-lg" style="color: var(--review-blue-text);">Performance vs Narrative</h3><p class="text-gray-700 whitespace-pre-wrap mt-1">${e(formData.m3s7_narrative)}</p></div><div><h3 class="font-bold text-lg" style="color: var(--review-blue-text);">Focus For Next Quarter</h3><p class="text-gray-700 whitespace-pre-wrap mt-1">${e(formData.m3s7_next_quarter)}</p></div></div></div>
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
            DOMElements.headerTitle.textContent = '\nPlan Not Found';
            
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
