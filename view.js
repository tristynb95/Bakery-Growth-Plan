// This ensures we don't run any code until the whole page is ready.
document.addEventListener('DOMContentLoaded', () => {

    const DOMElements = {
        loadingView: document.getElementById('loading-view'),
        appView: document.getElementById('app-view'),
        errorView: document.getElementById('error-view'),
        headerTitle: document.getElementById('header-title'),
        headerSubtitle: document.getElementById('header-subtitle'),
        contentArea: document.getElementById('content-area'),
    };

    async function initializeFirebaseAndLoadPlan() {
        try {
            // Fetch Firebase config from the Netlify function
            const response = await fetch('/.netlify/functions/config');
            if (!response.ok) throw new Error('Could not fetch Firebase configuration.');
            const firebaseConfig = await response.json();

            // This is our diagnostic line to see which project is being used.
            console.log("Connecting to Firebase project:", firebaseConfig.projectId);

            // A more robust way to initialize Firebase
            let app;
            if (!firebase.apps.length) {
                app = firebase.initializeApp(firebaseConfig);
            } else {
                app = firebase.app(); // Get the default app if it already exists
            }

            const db = firebase.firestore(app); // Explicitly use the initialized app
            
            // Get plan ID from URL
            const urlParams = new URLSearchParams(window.location.search);
            const planId = urlParams.get('id');
            
            if (!planId) {
                showError();
                return;
            }
            
            // Fetch plan data from the 'sharedPlans' collection
            const docRef = db.collection("sharedPlans").doc(planId);
            const docSnap = await docRef.get();

            if (docSnap.exists()) {
                const planData = docSnap.data();
                renderSummary(planData);
                DOMElements.loadingView.classList.add('hidden');
                DOMElements.appView.classList.remove('hidden');
            } else {
                // This is triggered if the document ID isn't found in the database.
                showError();
            }

        } catch (error) {
            console.error("Failed to load shared plan:", error);
            showError();
        }
    }
    
    function showError() {
        DOMElements.loadingView.classList.add('hidden');
        DOMElements.errorView.classList.remove('hidden');
    }

    function renderSummary(formData) {
        DOMElements.headerTitle.textContent = formData.planName || 'Bakery Growth Plan';
        const e = (text) => (text || '...').replace(/\n/g, '<br>');

        const renderMonthSummary = (monthNum) => {
            let weeklyCheckinHTML = '';
            for (let w = 1; w <= 4; w++) {
                const statusKey = `m${monthNum}s5_w${w}_status`;
                const status = formData[statusKey] || 'N/A';
                const statusColors = { 'on-track': 'bg-green-100 text-green-800', 'issues': 'bg-yellow-100 text-yellow-800', 'off-track': 'bg-red-100 text-red-800', 'N/A': 'bg-gray-100 text-gray-800'};
                const statusBadge = `<span class="text-xs font-semibold ml-2 px-2 py-0.5 rounded-full capitalize ${statusColors[status] || statusColors['N/A']}">${status.replace('-', ' ')}</span>`;
                weeklyCheckinHTML += `<div class="border-t pt-3 mt-3"><h5 class="font-bold text-sm">Week ${w}${statusBadge}</h5><div class="text-sm mt-2"><strong class="text-gray-600">Win/Learning:</strong> <span class="text-gray-800">${e(formData[`m${monthNum}s5_w${w}_win`])}</span></div><div class="text-sm mt-1"><strong class="text-gray-600">Spotlight:</strong> <span class="text-gray-800">${e(formData[`m${monthNum}s5_w${w}_spotlight`])}</span></div></div>`;
            }

            return `<div class="content-card p-6 mt-8">
                <h2 class="text-2xl font-bold gails-red-text mb-4">Month ${monthNum} Sprint</h2>
                <div class="space-y-6">
                    <div><h3 class="font-bold border-b pb-2 mb-2">Must-Win Battle</h3><p class="text-gray-700 whitespace-pre-wrap">${e(formData[`m${monthNum}s1_battle`])}</p></div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                        <div><h4 class="font-semibold text-gray-800">Key Levers</h4><p class="text-sm text-gray-700 whitespace-pre-wrap mt-1">${e(formData[`m${monthNum}s2_levers`])}</p></div>
                        <div><h4 class="font-semibold text-gray-800">People Growth</h4><p class="text-sm text-gray-700 whitespace-pre-wrap mt-1">${e(formData[`m${monthNum}s3_people`])}</p></div>
                        <div class="col-span-1"><h4 class="font-semibold text-gray-800">Team Power-Up Question</h4><p class="text-sm text-gray-700 whitespace-pre-wrap mt-1">${e(formData[`m${monthNum}s2_powerup_q`])}</p></div>
                        <div class="col-span-1"><h4 class="font-semibold text-gray-800">Team's Winning Idea</h4><p class="text-sm text-gray-700 whitespace-pre-wrap mt-1">${e(formData[`m${monthNum}s2_powerup_a`])}</p></div>
                    </div>
                    <div><h3 class="font-bold border-b pb-2 mb-2">Protect the Core Behaviours</h3><div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                        <div><strong class="text-gray-600 block">👥 People</strong><span class="text-gray-800">${e(formData[`m${monthNum}s4_people`])}</span></div>
                        <div><strong class="text-gray-600 block">🥐 Product</strong><span class="text-gray-800">${e(formData[`m${monthNum}s4_product`])}</span></div>
                        <div><strong class="text-gray-600 block">❤️ Customer</strong><span class="text-gray-800">${e(formData[`m${monthNum}s4_customer`])}</span></div>
                        <div><strong class="text-gray-600 block">🏡 Place</strong><span class="text-gray-800">${e(formData[`m${monthNum}s4_place`])}</span></div>
                    </div></div>
                    <div><h3 class="font-bold border-b pb-2 mb-2">Weekly Momentum Check</h3>${weeklyCheckinHTML}</div>
                    <div><h3 class="font-bold border-b pb-2 mb-2">End of Month Review</h3><div class="text-sm mt-2 space-y-2">
                        <p><strong class="font-medium text-gray-600">Biggest Win 🎉:</strong> <span class="text-gray-800">${e(formData[`m${monthNum}s6_win`])}</span></p>
                        <p><strong class="font-medium text-gray-600">Toughest Challenge 🤔:</strong> <span class="text-gray-800">${e(formData[`m${monthNum}s6_challenge`])}</span></p>
                        <p><strong class="font-medium text-gray-600">What's Next 🚀:</strong> <span class="text-gray-800">${e(formData[`m${monthNum}s6_next`])}</span></p>
                    </div></div>
                </div></div>`;
        };

        DOMElements.contentArea.innerHTML = `
            <div class="space-y-8 summary-content">
                <div class="content-card p-6">
                    <h2 class="text-2xl font-bold gails-red-text mb-4">Quarterly Vision & Sprints</h2>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-4 mb-4">
                        <div><h4 class="font-semibold text-sm text-gray-500">Manager</h4><p class="text-gray-800 font-medium">${e(formData.managerName)}</p></div>
                        <div><h4 class="font-semibold text-sm text-gray-500">Bakery</h4><p class="text-gray-800 font-medium">${e(formData.bakeryLocation)}</p></div>
                        <div><h4 class="font-semibold text-sm text-gray-500">Quarter</h4><p class="text-gray-800 font-medium">${e(formData.quarter)}</p></div>
                    </div>
                    <div class="mb-6"><h4 class="font-semibold text-sm text-gray-500">Quarterly Theme</h4><p class="text-gray-800 whitespace-pre-wrap">${e(formData.quarterlyTheme)}</p></div>
                    <div><h3 class="text-lg font-bold border-b pb-2 mb-3">Proposed Monthly Sprints</h3><div class="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                        <div><strong class="font-semibold text-gray-600 block">Month 1 Goal:</strong><p class="text-gray-800 mt-1 whitespace-pre-wrap">${e(formData.month1Goal)}</p></div>
                        <div><strong class="font-semibold text-gray-600 block">Month 2 Goal:</strong><p class="text-gray-800 mt-1 whitespace-pre-wrap">${e(formData.month2Goal)}</p></div>
                        <div><strong class="font-semibold text-gray-600 block">Month 3 Goal:</strong><p class="text-gray-800 mt-1 whitespace-pre-wrap">${e(formData.month3Goal)}</p></div>
                    </div></div>
                </div>
                ${renderMonthSummary(1)}
                ${renderMonthSummary(2)}
                ${renderMonthSummary(3)}
                <div class="content-card p-6 mt-8" style="background-color: var(--review-blue-bg); border-color: var(--review-blue-border);">
                    <h2 class="text-2xl font-bold mb-4" style="color: var(--review-blue-text);">Final Quarterly Reflection</h2>
                    <div class="space-y-4">
                        <div><h3 class="font-bold text-lg" style="color: var(--review-blue-text);">🏆 Biggest Achievements</h3><p class="text-gray-700 whitespace-pre-wrap mt-1">${e(formData.m3s7_achievements)}</p></div>
                        <div><h3 class="font-bold text-lg" style="color: var(--review-blue-text);">🧗 Biggest Challenges & Learnings</h3><p class="text-gray-700 whitespace-pre-wrap mt-1">${e(formData.m3s7_challenges)}</p></div>
                        <div><h3 class="font-bold text-lg" style="color: var(--review-blue-text);">🎯 Performance vs Narrative</h3><p class="text-gray-700 whitespace-pre-wrap mt-1">${e(formData.m3s7_narrative)}</p></div>
                        <div><h3 class="font-bold text-lg" style="color: var(--review-blue-text);">🚀 Focus For Next Quarter</h3><p class="text-gray-700 whitespace-pre-wrap mt-1">${e(formData.m3s7_next_quarter)}</p></div>
                    </div>
                </div>
            </div>`;
    }

    // This starts the entire process for the view page.
    initializeFirebaseAndLoadPlan();

});
