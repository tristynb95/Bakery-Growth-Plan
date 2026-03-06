// js/admin.js

const OWNER_EMAIL = 'tristen_bayley@gailsbread.co.uk';
const ADMIN_ROLES_DOC = 'adminRoles';

const DEFAULT_BAKERIES = [
    'Beaconsfield', 'Berkhamsted', 'Gerrards Cross', 'Harpenden', 'Henley',
    'Marlow', 'Radlett', 'Ruislip', 'St Albans', 'Welwyn Garden City'
];

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

    // Bakery management elements
    const addBakeryBtn = document.getElementById('add-bakery-btn');
    const addBakeryForm = document.getElementById('add-bakery-form');
    const newBakeryInput = document.getElementById('new-bakery-input');
    const saveNewBakeryBtn = document.getElementById('save-new-bakery-btn');
    const cancelNewBakeryBtn = document.getElementById('cancel-new-bakery-btn');
    const addBakeryError = document.getElementById('add-bakery-error');
    const bakeryListEl = document.getElementById('bakery-list');

    // Modal elements
    const modalOverlay = document.getElementById('admin-modal-overlay');
    const modalTitle = document.getElementById('admin-modal-title');
    const modalContent = document.getElementById('admin-modal-content');
    const modalActionBtn = document.getElementById('admin-modal-action-btn');
    const modalCancelBtn = document.getElementById('admin-modal-cancel-btn');
    const modalCloseBtn = document.getElementById('admin-modal-close-btn');

    let allUsersData = [];
    let bakeries = [];
    let modalActionCallback = null;
    let adminRoles = null;
    let isCurrentUserOwner = false;

    // --- Modal helpers ---
    function openAdminModal(title, contentHTML, actionLabel, actionClass, onAction) {
        modalTitle.textContent = title;
        modalContent.innerHTML = contentHTML;
        modalActionBtn.textContent = actionLabel;
        modalActionBtn.className = `btn ${actionClass}`;
        modalActionCallback = onAction;
        modalOverlay.classList.remove('hidden');
    }

    function closeAdminModal() {
        modalOverlay.classList.add('hidden');
        modalActionCallback = null;
        modalActionBtn.disabled = false;
        modalActionBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    modalCloseBtn.addEventListener('click', closeAdminModal);
    modalCancelBtn.addEventListener('click', closeAdminModal);
    modalOverlay.addEventListener('mousedown', (e) => {
        if (e.target === modalOverlay) closeAdminModal();
    });
    modalActionBtn.addEventListener('click', () => {
        if (modalActionCallback) modalActionCallback();
    });

    logoutBtn.addEventListener('click', () => {
        auth.signOut();
    });

    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            loadingView.classList.add('hidden');
            adminView.classList.add('hidden');
            window.location.href = '/index.html';
            return;
        }

        try {
            adminRoles = await loadAdminRoles();
            const signedInEmail = normalizeEmail(user.email);
            const canAccessAdminPortal = adminRoles.admins.includes(signedInEmail);

            if (!canAccessAdminPortal) {
                loadingView.classList.add('hidden');
                adminView.classList.add('hidden');
                accessDeniedView.classList.remove('hidden');
                return;
            }

            isCurrentUserOwner = signedInEmail === adminRoles.ownerEmail;

            bakeries = await loadBakeries(db);
            allUsersData = await fetchAllUsers(db);
            renderBakeries();
            populateBakeryFilter();
            renderUsers(allUsersData);
            updateStats(allUsersData);

            loadingView.classList.add('hidden');
            accessDeniedView.classList.add('hidden');
            adminView.classList.remove('hidden');
        } catch (error) {
            console.error('Error loading admin data:', error);
            loadingView.classList.add('hidden');
            accessDeniedView.classList.remove('hidden');
        }
    });

    searchInput.addEventListener('input', () => filterAndRender());
    bakeryFilter.addEventListener('change', () => filterAndRender());

    // --- Delete user from admin ---
    usersList.addEventListener('click', (e) => {
        const promoteBtn = e.target.closest('.promote-admin-btn');
        if (promoteBtn) {
            handlePromoteToAdmin(promoteBtn.dataset.email);
            return;
        }

        const demoteBtn = e.target.closest('.demote-admin-btn');
        if (demoteBtn) {
            handleDemoteAdmin(demoteBtn.dataset.email);
            return;
        }

        const deleteBtn = e.target.closest('.delete-user-btn');
        if (deleteBtn) {
            handleDeleteUser(deleteBtn.dataset.uid, deleteBtn.dataset.name, deleteBtn.dataset.email);
        }
    });

    async function handlePromoteToAdmin(email) {
        if (!isCurrentUserOwner) return;

        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail) return;
        if (normalizedEmail === adminRoles.ownerEmail || adminRoles.admins.includes(normalizedEmail)) return;

        adminRoles.admins = [...new Set([...adminRoles.admins, normalizedEmail])];
        await saveAdminRoles();
        filterAndRender();
    }

    async function handleDemoteAdmin(email) {
        if (!isCurrentUserOwner) return;

        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail || normalizedEmail === adminRoles.ownerEmail) return;

        adminRoles.admins = adminRoles.admins.filter(adminEmail => adminEmail !== normalizedEmail);
        await saveAdminRoles();
        filterAndRender();
    }

    function handleDeleteUser(uid, name, email) {
        const normalizedEmail = normalizeEmail(email);
        if (normalizedEmail === adminRoles.ownerEmail) {
            openAdminModal('Action Not Allowed', '<p>The owner account cannot be deleted from the admin portal.</p>', 'OK', 'btn-primary', closeAdminModal);
            return;
        }

        const expectedPhrase = `delete ${name}`;
        let confirmMsg = `<p>This will permanently delete <strong>${name}</strong> and all their data (profile, plans, and files). This action <strong>cannot be undone</strong>.</p>`;
        confirmMsg += `<div class="mt-3"><label class="block text-sm font-medium text-gray-700 mb-1">Type <strong class="text-red-600">${expectedPhrase}</strong> to confirm:</label><input type="text" id="delete-user-confirm-input" class="form-input w-full !py-2" placeholder="${expectedPhrase}" autocomplete="off"></div>`;

        openAdminModal('Delete User', confirmMsg, 'Delete User', 'btn-danger', async () => {
            const input = document.getElementById('delete-user-confirm-input');
            if (input.value.trim() !== expectedPhrase) return;

            modalActionBtn.disabled = true;
            modalActionBtn.innerHTML = '<i class="bi bi-arrow-repeat animate-spin"></i> Deleting...';

            try {
                const idToken = await auth.currentUser.getIdToken();
                const response = await fetch('/.netlify/functions/admin-delete-user', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${idToken}`
                    },
                    body: JSON.stringify({ uid })
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error || 'Server error');
                }

                // Remove from local data and re-render
                allUsersData = allUsersData.filter(u => u.uid !== uid);
                filterAndRender();
                updateStats(allUsersData);
                renderBakeries();
                closeAdminModal();
            } catch (error) {
                console.error('Error deleting user:', error);
                closeAdminModal();
                openAdminModal('Error', '<p>Could not delete the user. Please try again.</p>', 'OK', 'btn-primary', closeAdminModal);
            }
        });

        // Disable delete button until correct phrase is typed
        requestAnimationFrame(() => {
            const input = document.getElementById('delete-user-confirm-input');
            if (!input) return;
            modalActionBtn.disabled = true;
            modalActionBtn.classList.add('opacity-50', 'cursor-not-allowed');
            input.addEventListener('input', () => {
                const match = input.value.trim() === expectedPhrase;
                modalActionBtn.disabled = !match;
                modalActionBtn.classList.toggle('opacity-50', !match);
                modalActionBtn.classList.toggle('cursor-not-allowed', !match);
            });
        });
    }

    // --- Bakery management ---

    async function loadBakeries(db) {
        const doc = await db.collection('settings').doc('bakeries').get();
        if (doc.exists && Array.isArray(doc.data().list)) {
            return doc.data().list.sort();
        }
        // Seed with defaults on first load
        await db.collection('settings').doc('bakeries').set({ list: DEFAULT_BAKERIES });
        return [...DEFAULT_BAKERIES].sort();
    }

    async function saveBakeries(db) {
        await db.collection('settings').doc('bakeries').set({ list: bakeries });
    }

    function normalizeEmail(email) {
        return (email || '').trim().toLowerCase();
    }

    async function loadAdminRoles() {
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

        if (!doc.exists || !Array.isArray((doc.data() || {}).admins) || (doc.data() || {}).ownerEmail !== resolvedOwner || admins.length !== ((doc.data() || {}).admins || []).length) {
            await docRef.set({ ownerEmail: resolvedOwner, admins }, { merge: true });
        }

        return { ownerEmail: resolvedOwner, admins };
    }

    async function saveAdminRoles() {
        await db.collection('settings').doc(ADMIN_ROLES_DOC).set({
            ownerEmail: adminRoles.ownerEmail,
            admins: adminRoles.admins
        }, { merge: true });
    }

    function getRoleForEmail(email) {
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail) return 'user';
        if (normalizedEmail === adminRoles.ownerEmail) return 'owner';
        if (adminRoles.admins.includes(normalizedEmail)) return 'admin';
        return 'user';
    }

    addBakeryBtn.addEventListener('click', () => {
        addBakeryForm.classList.remove('hidden');
        addBakeryError.classList.add('hidden');
        newBakeryInput.value = '';
        newBakeryInput.focus();
    });

    cancelNewBakeryBtn.addEventListener('click', () => {
        addBakeryForm.classList.add('hidden');
        addBakeryError.classList.add('hidden');
    });

    newBakeryInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') saveNewBakeryBtn.click();
        if (e.key === 'Escape') cancelNewBakeryBtn.click();
    });

    saveNewBakeryBtn.addEventListener('click', async () => {
        const name = newBakeryInput.value.trim();
        if (!name) {
            showBakeryError('Please enter a bakery name.');
            return;
        }
        if (bakeries.some(b => b.toLowerCase() === name.toLowerCase())) {
            showBakeryError('A bakery with this name already exists.');
            return;
        }
        saveNewBakeryBtn.disabled = true;
        saveNewBakeryBtn.innerHTML = '<i class="bi bi-arrow-repeat animate-spin"></i> Saving...';
        bakeries.push(name);
        bakeries.sort();
        await saveBakeries(db);
        addBakeryForm.classList.add('hidden');
        saveNewBakeryBtn.disabled = false;
        saveNewBakeryBtn.innerHTML = '<i class="bi bi-check-lg"></i> Save';
        renderBakeries();
        populateBakeryFilter();
        updateStats(allUsersData);
    });

    function showBakeryError(msg) {
        addBakeryError.textContent = msg;
        addBakeryError.classList.remove('hidden');
    }

    bakeryListEl.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-bakery-btn');
        const deleteBtn = e.target.closest('.delete-bakery-btn');
        const saveEditBtn = e.target.closest('.save-edit-bakery-btn');
        const cancelEditBtn = e.target.closest('.cancel-edit-bakery-btn');

        if (editBtn) {
            const row = editBtn.closest('.bakery-row');
            row.querySelector('.bakery-display').classList.add('hidden');
            row.querySelector('.bakery-edit').classList.remove('hidden');
            row.querySelector('.bakery-edit-input').focus();
        }

        if (cancelEditBtn) {
            const row = cancelEditBtn.closest('.bakery-row');
            row.querySelector('.bakery-display').classList.remove('hidden');
            row.querySelector('.bakery-edit').classList.add('hidden');
        }

        if (saveEditBtn) {
            handleRenameBakery(saveEditBtn);
        }

        if (deleteBtn) {
            handleDeleteBakery(deleteBtn.dataset.bakery);
        }
    });

    bakeryListEl.addEventListener('keyup', (e) => {
        if (e.target.classList.contains('bakery-edit-input')) {
            if (e.key === 'Enter') {
                const row = e.target.closest('.bakery-row');
                row.querySelector('.save-edit-bakery-btn').click();
            }
            if (e.key === 'Escape') {
                const row = e.target.closest('.bakery-row');
                row.querySelector('.cancel-edit-bakery-btn').click();
            }
        }
    });

    async function handleRenameBakery(saveBtn) {
        const row = saveBtn.closest('.bakery-row');
        const oldName = saveBtn.dataset.bakery;
        const newName = row.querySelector('.bakery-edit-input').value.trim();

        if (!newName) return;
        if (newName === oldName) {
            row.querySelector('.bakery-display').classList.remove('hidden');
            row.querySelector('.bakery-edit').classList.add('hidden');
            return;
        }
        if (bakeries.some(b => b.toLowerCase() === newName.toLowerCase() && b !== oldName)) {
            openAdminModal('Name Conflict', '<p>A bakery with this name already exists.</p>', 'OK', 'btn-primary', closeAdminModal);
            return;
        }

        const affectedUsers = allUsersData.filter(u => u.bakery === oldName);
        const confirmMsg = affectedUsers.length > 0
            ? `<p>Renaming <strong>${oldName}</strong> to <strong>${newName}</strong> will update <strong>${affectedUsers.length} user${affectedUsers.length !== 1 ? 's' : ''}</strong>.</p><p class="mt-2 text-sm text-gray-500">This action cannot be undone.</p>`
            : `<p>Rename <strong>${oldName}</strong> to <strong>${newName}</strong>?</p>`;

        openAdminModal('Rename Bakery', confirmMsg, 'Rename', 'btn-primary', async () => {
            closeAdminModal();

            // Update bakery list
            const idx = bakeries.indexOf(oldName);
            if (idx !== -1) bakeries[idx] = newName;
            bakeries.sort();
            await saveBakeries(db);

            // Update affected users in Firestore
            const batch = db.batch();
            for (const user of affectedUsers) {
                batch.update(db.collection('users').doc(user.uid), { bakery: newName });
                user.bakery = newName;
            }
            if (affectedUsers.length > 0) await batch.commit();

            renderBakeries();
            populateBakeryFilter();
            filterAndRender();
            updateStats(allUsersData);
        });
    }

    function handleDeleteBakery(bakeryName) {
        const affectedUsers = allUsersData.filter(u => u.bakery === bakeryName);
        const expectedPhrase = `delete ${bakeryName}`;
        let confirmMsg = `<p>Are you sure you want to delete <strong>${bakeryName}</strong>?</p>`;
        if (affectedUsers.length > 0) {
            confirmMsg += `<div class="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg"><p class="text-sm font-semibold text-yellow-800"><i class="bi bi-exclamation-triangle-fill mr-1"></i> ${affectedUsers.length} user${affectedUsers.length !== 1 ? 's' : ''} will be set to "No Bakery":</p><ul class="mt-2 text-sm text-yellow-700 space-y-1">`;
            affectedUsers.forEach(u => {
                confirmMsg += `<li>&bull; ${u.name} (${u.email})</li>`;
            });
            confirmMsg += '</ul></div>';
        }
        confirmMsg += `<div class="mt-3"><label class="block text-sm font-medium text-gray-700 mb-1">Type <strong class="text-red-600">delete ${bakeryName}</strong> to confirm:</label><input type="text" id="delete-confirm-input" class="form-input w-full !py-2" placeholder="delete ${bakeryName}" autocomplete="off"></div>`;

        openAdminModal('Delete Bakery', confirmMsg, 'Delete', 'btn-danger', async () => {
            const input = document.getElementById('delete-confirm-input');
            if (input.value.trim().toLowerCase() !== expectedPhrase.toLowerCase()) return;

            closeAdminModal();

            // Remove from bakery list
            bakeries = bakeries.filter(b => b !== bakeryName);
            await saveBakeries(db);

            // Update affected users in Firestore
            const batch = db.batch();
            for (const user of affectedUsers) {
                batch.update(db.collection('users').doc(user.uid), { bakery: '' });
                user.bakery = 'No Bakery';
            }
            if (affectedUsers.length > 0) await batch.commit();

            renderBakeries();
            populateBakeryFilter();
            filterAndRender();
            updateStats(allUsersData);
        });

        // Disable delete button until correct phrase is typed
        requestAnimationFrame(() => {
            const input = document.getElementById('delete-confirm-input');
            if (!input) return;
            modalActionBtn.disabled = true;
            modalActionBtn.classList.add('opacity-50', 'cursor-not-allowed');
            input.addEventListener('input', () => {
                const match = input.value.trim().toLowerCase() === expectedPhrase.toLowerCase();
                modalActionBtn.disabled = !match;
                modalActionBtn.classList.toggle('opacity-50', !match);
                modalActionBtn.classList.toggle('cursor-not-allowed', !match);
            });
        });
    }

    function renderBakeries() {
        if (bakeries.length === 0) {
            bakeryListEl.innerHTML = '<div class="p-6 text-center text-gray-500"><p>No bakeries configured.</p></div>';
            return;
        }

        bakeryListEl.innerHTML = bakeries.map(bakery => {
            const userCount = allUsersData.filter(u => u.bakery === bakery).length;
            return `
                <div class="bakery-row p-4 hover:bg-gray-50 transition-colors">
                    <div class="bakery-display flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <i class="bi bi-shop text-gray-400"></i>
                            <span class="font-semibold text-gray-800">${bakery}</span>
                            <span class="text-xs text-gray-500">${userCount} user${userCount !== 1 ? 's' : ''}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <button class="edit-bakery-btn btn btn-secondary !py-1 !px-2.5 text-sm" data-bakery="${bakery}"><i class="bi bi-pencil"></i> Rename</button>
                            <button class="delete-bakery-btn btn btn-secondary !py-1 !px-2.5 text-sm text-red-600 hover:text-red-700" data-bakery="${bakery}"><i class="bi bi-trash3"></i> Delete</button>
                        </div>
                    </div>
                    <div class="bakery-edit hidden flex items-center gap-3">
                        <input type="text" class="bakery-edit-input form-input !py-2 flex-grow" value="${bakery}">
                        <button class="save-edit-bakery-btn btn btn-primary !py-1 !px-2.5 text-sm" data-bakery="${bakery}"><i class="bi bi-check-lg"></i> Save</button>
                        <button class="cancel-edit-bakery-btn btn btn-secondary !py-1 !px-2.5 text-sm"><i class="bi bi-x-lg"></i> Cancel</button>
                    </div>
                </div>`;
        }).join('');
    }

    // --- User list (unchanged logic) ---

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
                bakery: userData.bakery || 'No Bakery',
                photoURL: userData.photoURL || null,
                plans: plans,
                planCount: plans.length
            });
        }

        usersData.sort((a, b) => a.name.localeCompare(b.name));
        return usersData;
    }

    function populateBakeryFilter() {
        const allBakeries = [...new Set([...bakeries, ...allUsersData.map(u => u.bakery)].filter(b => b && b !== 'No Bakery'))].sort();
        bakeryFilter.innerHTML = '<option value="">All Bakeries</option>';
        allBakeries.forEach(bakery => {
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
        const uniqueBakeries = new Set(users.map(u => u.bakery).filter(b => b && b !== 'No Bakery'));
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

    function getAdminPreviewUrl(uid, planId) {
        const params = new URLSearchParams({
            mode: 'admin',
            uid,
            planId
        });
        return `/view.html?${params.toString()}`;
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
                                <a href="${getAdminPreviewUrl(user.uid, plan.id)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors" title="Preview this plan as an admin">
                                    <i class="bi bi-eye-fill"></i>
                                    Preview
                                </a>
                                <div class="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div class="h-full rounded-full ${completion >= 75 ? 'bg-green-500' : completion >= 40 ? 'bg-yellow-500' : 'bg-red-400'}" style="width: ${completion}%"></div>
                                </div>
                                <span class="text-xs font-semibold text-gray-600 w-10 text-right">${completion}%</span>
                            </div>
                        </div>`;
                }).join('')
                : '<p class="text-sm text-gray-400 italic px-3">No plans created yet</p>';

            const bakeryBadgeClass = user.bakery === 'No Bakery' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700';
            const userRole = getRoleForEmail(user.email);
            const roleBadge = userRole === 'owner'
                ? '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700"><i class="bi bi-gem"></i> Owner</span>'
                : userRole === 'admin'
                    ? '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700"><i class="bi bi-shield-lock"></i> Admin</span>'
                    : '';
            const canDeleteUser = userRole !== 'owner';
            const deleteUserBtn = canDeleteUser
                ? `<button class="delete-user-btn inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-600 hover:bg-red-200 transition-colors" data-uid="${user.uid}" data-name="${user.name}" data-email="${user.email}"><i class="bi bi-trash3"></i> Delete</button>`
                : '';
            const roleActionBtn = !isCurrentUserOwner
                ? ''
                : userRole === 'owner'
                    ? '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-600"><i class="bi bi-lock-fill"></i> Protected</span>'
                    : userRole === 'admin'
                        ? `<button class="demote-admin-btn inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors" data-email="${user.email}"><i class="bi bi-person-dash-fill"></i> Demote Admin</button>`
                        : `<button class="promote-admin-btn inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors" data-email="${user.email}"><i class="bi bi-person-up"></i> Make Admin</button>`;

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
                                <div class="flex items-center gap-2 flex-wrap sm:justify-end">
                                    ${roleBadge}
                                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${bakeryBadgeClass}"><i class="bi bi-shop"></i> ${user.bakery}</span>
                                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600"><i class="bi bi-journal-text"></i> ${user.planCount} plan${user.planCount !== 1 ? 's' : ''}</span>
                                    ${roleActionBtn}
                                    ${deleteUserBtn}
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
