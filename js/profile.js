// js/profile.js

async function initializeFirebase() {
    try {
        const response = await fetch('/.netlify/functions/config');
        if (!response.ok) {
            throw new Error('Could not fetch Firebase configuration.');
        }
        const firebaseConfig = await response.json();
        const app = firebase.initializeApp(firebaseConfig);
        runProfileScript(app);
    } catch (error) {
        console.error("Failed to initialize Firebase:", error);
        document.getElementById('header-title').textContent = 'Error';
        document.getElementById('header-subtitle').textContent = 'Could not load application configuration. Please contact support.';
    }
}

function runProfileScript(app) {
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();

    const bakeryList = [
        'Beaconsfield', 'Berkhamsted', 'Gerrards Cross', 'Harpenden', 'Henley',
        'Marlow', 'Radlett', 'Ruislip', 'St Albans', 'Welwyn Garden City'
    ].sort();

    const DOMElements = {
        // Core Profile fields
        profileName: document.getElementById('profile-name'),
        profileEmail: document.getElementById('profile-email'),
        saveProfileBtn: document.getElementById('save-profile-btn'),

        // Bakery Dropdown fields
        bakeryDropdown: document.getElementById('bakery-dropdown'),
        bakerySearchInput: document.getElementById('bakery-search-input'),
        bakeryHiddenInput: document.getElementById('profile-bakery-hidden'),

        // Header and navigation
        headerTitle: document.getElementById('header-title'),
        headerSubtitle: document.getElementById('header-subtitle'),
        backToDashboardBtn: document.getElementById('back-to-dashboard-btn'),

        // Photo fields
        photoPreview: document.getElementById('profile-photo-preview'),
        photoUploadInput: document.getElementById('photo-upload-input'),
        savePhotoBtn: document.getElementById('save-photo-btn'),
        removePhotoBtn: document.getElementById('remove-photo-btn'),

        // Modal fields
        modalOverlay: document.getElementById('modal-overlay'),
        modalBox: document.getElementById('modal-box'),
        modalTitle: document.getElementById('modal-title'),
        modalContent: document.getElementById('modal-content'),
        modalActionBtn: document.getElementById('modal-action-btn'),
        modalCloseBtn: document.getElementById('modal-close-btn'),
    };

    let currentUser = null;
    let selectedFile = null;
    let isSetupMode = false;
    const defaultPhotoURL = 'https://ssl.gstatic.com/images/branding/product/1x/avatar_circle_blue_512dp.png';

    const params = new URLSearchParams(window.location.search);
    if (params.get('setup') === 'true') {
        isSetupMode = true;
    }

    function openModal(type, title, message) {
        DOMElements.modalTitle.textContent = title;
        DOMElements.modalContent.innerHTML = `<p>${message}</p>`;
        if (type === 'success') {
            DOMElements.modalTitle.innerHTML = `<i class="bi bi-check-circle-fill text-green-500 mr-2"></i> ${title}`;
        } else if (type === 'warning') {
            DOMElements.modalTitle.innerHTML = `<i class="bi bi-exclamation-triangle-fill text-yellow-500 mr-2"></i> ${title}`;
        }
        DOMElements.modalOverlay.classList.remove('hidden');
    }

    function closeModal() {
        DOMElements.modalOverlay.classList.add('hidden');
    }

    async function saveProfile() {
        if (!currentUser) return;
        const name = DOMElements.profileName.value.trim();
        const bakery = DOMElements.bakeryHiddenInput.value.trim();

        if (!name || !bakery) {
            openModal('warning', 'Incomplete Profile', 'Please enter your full name and select your bakery to save.');
            return;
        }

        const userRef = db.collection('users').doc(currentUser.uid);
        const dataToSave = { name, bakery, email: currentUser.email };

        try {
            DOMElements.saveProfileBtn.disabled = true;
            DOMElements.saveProfileBtn.innerHTML = '<i class="bi bi-arrow-repeat animate-spin"></i> Saving...';
            await userRef.set(dataToSave, { merge: true });
            if (isSetupMode) {
                window.location.href = '/index.html';
            } else {
                openModal('success', 'Profile Updated', 'Your changes have been saved successfully.');
                DOMElements.saveProfileBtn.disabled = false;
                DOMElements.saveProfileBtn.textContent = 'Save Changes';
            }
        } catch (error) {
            console.error("Error saving profile:", error);
            openModal('warning', 'Save Error', 'Could not save your profile. Please try again.');
            DOMElements.saveProfileBtn.disabled = false;
            DOMElements.saveProfileBtn.textContent = 'Save Changes';
        }
    }

    function loadUserProfile(user) {
        DOMElements.profileEmail.value = user.email;
        const userRef = db.collection('users').doc(user.uid);
        userRef.get().then((doc) => {
            if (doc.exists && !isSetupMode) {
                const data = doc.data();
                DOMElements.profileName.value = data.name || '';
                DOMElements.bakerySearchInput.value = data.bakery || '';
                DOMElements.bakeryHiddenInput.value = data.bakery || '';
                if (data.photoURL) {
                    DOMElements.photoPreview.src = data.photoURL;
                    DOMElements.removePhotoBtn.classList.remove('hidden');
                }
            } else {
                DOMElements.headerTitle.textContent = 'Welcome! Let\'s Set Up Your Profile.';
                DOMElements.headerSubtitle.textContent = 'Please provide your details to get started.';
                DOMElements.saveProfileBtn.textContent = 'Save and Continue';
                isSetupMode = true;
            }
        });
    }

    function setupBakeryDropdown() {
        const optionsContainer = DOMElements.bakeryDropdown.querySelector('.dropdown-options');
        const searchInput = DOMElements.bakerySearchInput;
        const hiddenInput = DOMElements.bakeryHiddenInput;
        const selectedDisplay = DOMElements.bakeryDropdown.querySelector('.dropdown-selected');

        function filterOptions() {
            const searchTerm = searchInput.value.toLowerCase();
            optionsContainer.innerHTML = '';
            const filteredBakeries = bakeryList.filter(b => b.toLowerCase().includes(searchTerm));

            if (filteredBakeries.length === 0) {
                optionsContainer.innerHTML = `<div class="dropdown-option no-results">No bakeries found</div>`;
                return;
            }

            filteredBakeries.forEach(bakery => {
                const option = document.createElement('div');
                option.className = 'dropdown-option';
                option.textContent = bakery;
                option.dataset.value = bakery;
                optionsContainer.appendChild(option);
            });
        }

        function selectOption(option) {
            const value = option.dataset.value;
            searchInput.value = value;
            hiddenInput.value = value;
            DOMElements.bakeryDropdown.classList.remove('open');
        }

        searchInput.addEventListener('focus', () => {
            DOMElements.bakeryDropdown.classList.add('open');
            filterOptions();
        });

        document.addEventListener('click', (e) => {
            if (!DOMElements.bakeryDropdown.contains(e.target)) {
                DOMElements.bakeryDropdown.classList.remove('open');
            }
        });
        
        selectedDisplay.addEventListener('click', (e) => {
            if (e.target !== searchInput) {
                searchInput.focus();
            }
        });

        searchInput.addEventListener('input', filterOptions);

        optionsContainer.addEventListener('click', (e) => {
            const option = e.target.closest('.dropdown-option:not(.no-results)');
            if (option) selectOption(option);
        });

        searchInput.addEventListener('keydown', (e) => {
            const isOpen = DOMElements.bakeryDropdown.classList.contains('open');
            if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                DOMElements.bakeryDropdown.classList.add('open');
                filterOptions();
            }

            const options = Array.from(optionsContainer.querySelectorAll('.dropdown-option:not(.no-results)'));
            if (options.length === 0) return;
            let currentIndex = options.findIndex(opt => opt.classList.contains('is-highlighted'));

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    if (currentIndex >= 0) options[currentIndex].classList.remove('is-highlighted');
                    const nextIndex = (currentIndex + 1) % options.length;
                    options[nextIndex].classList.add('is-highlighted');
                    options[nextIndex].scrollIntoView({ block: 'nearest' });
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (currentIndex >= 0) options[currentIndex].classList.remove('is-highlighted');
                    const prevIndex = (currentIndex - 1 + options.length) % options.length;
                    options[prevIndex].classList.add('is-highlighted');
                    options[prevIndex].scrollIntoView({ block: 'nearest' });
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (currentIndex >= 0) selectOption(options[currentIndex]);
                    break;
                case 'Escape':
                    DOMElements.bakeryDropdown.classList.remove('open');
                    break;
            }
        });
    }

    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            loadUserProfile(user);
            setupBakeryDropdown();
        } else {
            window.location.href = '/index.html';
        }
    });

    DOMElements.saveProfileBtn.addEventListener('click', saveProfile);
    DOMElements.backToDashboardBtn.addEventListener('click', () => { window.location.href = '/index.html'; });
    DOMElements.modalCloseBtn.addEventListener('click', closeModal);
    DOMElements.modalActionBtn.addEventListener('click', closeModal);
    DOMElements.modalOverlay.addEventListener('mousedown', (e) => {
        if (e.target === DOMElements.modalOverlay) closeModal();
    });
}

document.addEventListener('DOMContentLoaded', initializeFirebase);

