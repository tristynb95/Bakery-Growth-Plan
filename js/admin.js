// js/admin.js

const ADMIN_EMAIL = 'tristen_bayley@gailsbread.co.uk';

async function initializeFirebase() {
    try {
        const response = await fetch('/.netlify/functions/config');
        if (!response.ok) throw new Error('Could not fetch Firebase configuration.');
        const firebaseConfig = await response.json();
        const app = firebase.initializeApp(firebaseConfig);
        runAdminPortal(app);
    } catch (error) {
        console.error('Failed to initialize Firebase:', error);
        document.getElementById('admin-loading-view').classList.add('hidden');
        document.getElementById('access-denied-view').classList.remove('hidden');
    }
}

function runAdminPortal(app) {
    const auth = firebase.auth();
    const db = firebase.firestore();

    const loadingView = document.getElementById('admin-loading-view');
    const accessDeniedView = document.getElementById('access-denied-view');
    const adminView = document.getElementById('admin-view');
    const logoutBtn = document.getElementById('admin-logout-btn');
    const searchInput = document.getElementById('admin-search-input');
    const bakeryFilter = document.getElementById('admin-bakery-filter');
    const usersList = document.getElementById('admin-users-list');
    const emptyState = document.getElementById('admin-empty-state');

    let allUsersData = [];

    logoutBtn.addEventListener('click', () => {
        auth.signOut();
    });

    auth.onAuthStateChanged(async (user) => {
        if (!user || user.email !== ADMIN_EMAIL) {
            loadingView.classList.add('hidden');
            adminView.classList.add('hidden');
            if (user && user.email !== ADMIN_EMAIL) {
                accessDeniedView.classList.remove('hidden');
            } else {
                window.location.href = '/index.html';
            }
            return;
        }

        try {
            allUsersData = await fetchAllUsers(db);
            populateBakeryFilter(allUsersData);
            renderUsers(allUsersData);
            updateStats(allUsersData);

            loadingView.classList.add('hidden');
            adminView.classList.remove('hidden');
        } catch (error) {
            console.error('Error loading admin data:', error);
            loadingView.classList.add('hidden');
            accessDeniedView.classList.remove('hidden');
        }
    });

    searchInput.addEventListener('input', () => filterAndRender());
    bakeryFilter.addEventListener('change', () => filterAndRender());

    function filterAndRender() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const selectedBakery = bakeryFilter.value;

        let filtered = allUsersData;

        if (selectedBakery) {
            filtered = filtered.filter(u => u.bakery === selectedBakery);
        }

        if (searchTerm) {
            filtered = filtered.filter(u =>
                (u.name && u.name.toLowerCase().includes(searchTerm)) ||
                (u.email && u.email.toLowerCase().includes(searchTerm)) ||
                (u.bakery && u.bakery.toLowerCase().includes(searchTerm))
            );
        }

        renderUsers(filtered);
    }

    async function fetchAllUsers(db) {
        const usersSnapshot = await db.collection('users').get();
        const usersData = [];

        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            const plansSnapshot = await userDoc.ref.collection('plans').orderBy('lastEdited', 'desc').get();
            const plans = plansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            usersData.push({
                uid: userDoc.id,
                name: userData.name || 'No Name',
                email: userData.email || 'No Email',
                bakery: userData.bakery || 'Unassigned',
                photoURL: userData.photoURL || null,
                plans: plans,
                planCount: plans.length
            });
        }

        usersData.sort((a, b) => a.name.localeCompare(b.name));
        return usersData;
    }

    function populateBakeryFilter(users) {
        const bakeries = [...new Set(users.map(u => u.bakery).filter(b => b && b !== 'Unassigned'))].sort();
        bakeryFilter.innerHTML = '<option value="">All Bakeries</option>';
        bakeries.forEach(bakery => {
            const option = document.createElement('option');
            option.value = bakery;
            option.textContent = bakery;
            bakeryFilter.appendChild(option);
        });
    }

    function updateStats(users) {
        document.getElementById('stat-total-users').textContent = users.length;
        const totalPlans = users.reduce((sum, u) => sum + u.planCount, 0);
        document.getElementById('stat-total-plans').textContent = totalPlans;
        const uniqueBakeries = new Set(users.map(u => u.bakery).filter(b => b && b !== 'Unassigned'));
        document.getElementById('stat-total-bakeries').textContent = uniqueBakeries.size;
    }

    function formatDate(lastEdited) {
        if (!lastEdited || !lastEdited.toDate) return 'N/A';
        const date = lastEdited.toDate();
        const day = date.getDate();
        const month = date.toLocaleString('en-GB', { month: 'short' });
        const year = date.getFullYear();
        return `${day} ${month} ${year}`;
    }

    function getInitials(name) {
        if (!name || name === 'No Name') return '??';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }

    function calculateCompletion(planData) {
        const fields = [
            'managerName', 'bakeryLocation', 'quarter', 'quarterlyTheme',
            'month1Goal', 'month2Goal', 'month3Goal'
        ];
        const monthFields = (m) => [
            `m${m}s1_battle`, `m${m}s1_pillar`, `m${m}s2_levers`,
            `m${m}s2_powerup_q`, `m${m}s2_powerup_a`, `m${m}s3_people`,
            `m${m}s4_people`, `m${m}s4_product`, `m${m}s4_customer`, `m${m}s4_place`,
            `m${m}s6_win`, `m${m}s6_challenge`, `m${m}s6_next`
        ];
        const allFields = [...fields, ...monthFields(1), ...monthFields(2), ...monthFields(3)];
        const total = allFields.length;
        const completed = allFields.filter(f => {
            const val = planData[f];
            if (!val) return false;
            const div = document.createElement('div');
            div.innerHTML = val;
            return div.innerText.trim() !== '';
        }).length;
        return total > 0 ? Math.round((completed / total) * 100) : 0;
    }

    function renderUsers(users) {
        if (users.length === 0) {
            usersList.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');

        usersList.innerHTML = users.map(user => {
            const initials = getInitials(user.name);
            const photoHTML = user.photoURL
                ? `<img src="${user.photoURL}" alt="${user.name}" class="w-10 h-10 rounded-full object-cover">`
                : `<div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center font-bold gails-red-text text-sm">${initials}</div>`;

            const plansHTML = user.plans.length > 0
                ? user.plans.map(plan => {
                    const completion = calculateCompletion(plan);
                    const planName = plan.planName || 'Untitled Plan';
                    const quarter = plan.quarter || 'No quarter';
                    const edited = formatDate(plan.lastEdited);
                    return `
                        <div class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg text-sm">
                            <div class="flex items-center gap-3">
                                <i class="bi bi-file-earmark-text text-gray-400"></i>
                                <div>
                                    <p class="font-semibold text-gray-700">${planName}</p>
                                    <p class="text-xs text-gray-500">${quarter} &middot; Last edited: ${edited}</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <div class="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div class="h-full rounded-full ${completion >= 75 ? 'bg-green-500' : completion >= 40 ? 'bg-yellow-500' : 'bg-red-400'}" style="width: ${completion}%"></div>
                                </div>
                                <span class="text-xs font-semibold text-gray-600 w-10 text-right">${completion}%</span>
                            </div>
                        </div>`;
                }).join('')
                : '<p class="text-sm text-gray-400 italic px-3">No plans created yet</p>';

            return `
                <div class="admin-user-row p-4 sm:p-6 hover:bg-gray-50 transition-colors">
                    <div class="flex items-start gap-4">
                        ${photoHTML}
                        <div class="flex-grow min-w-0">
                            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                <div>
                                    <h3 class="font-bold text-gray-900">${user.name}</h3>
                                    <p class="text-sm text-gray-500">${user.email}</p>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700"><i class="bi bi-shop"></i> ${user.bakery}</span>
                                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600"><i class="bi bi-journal-text"></i> ${user.planCount} plan${user.planCount !== 1 ? 's' : ''}</span>
                                </div>
                            </div>
                            <div class="mt-3 space-y-2">
                                ${plansHTML}
                            </div>
                        </div>
                    </div>
                </div>`;
        }).join('');
    }
}

document.addEventListener('DOMContentLoaded', initializeFirebase);
