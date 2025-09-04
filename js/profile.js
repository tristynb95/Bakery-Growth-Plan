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
        profileName: document.getElementById('profile-name'),
        profileEmail: document.getElementById('profile-email'),
        headerSaveBtn: document.getElementById('header-save-btn'),
        headerBackBtn: document.getElementById('header-back-btn'),
        bakeryDropdown: document.getElementById('bakery-dropdown'),
        bakerySearchInput: document.getElementById('bakery-search-input'),
        bakeryHiddenInput: document.getElementById('profile-bakery-hidden'),
        headerTitle: document.getElementById('header-title'),
        headerSubtitle: document.getElementById('header-subtitle'),
        photoPreview: document.getElementById('profile-photo-preview'),
        photoUploadInput: document.getElementById('photo-upload-input'),
        savePhotoBtn: document.getElementById('save-photo-btn'),
        removePhotoBtn: document.getElementById('remove-photo-btn'),
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
    let originalProfileData = { name: '', bakery: '' };

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

    function checkFormValidity() {
        const currentName = DOMElements.profileName.value.trim();
        const currentBakery = DOMElements.bakeryHiddenInput.value.trim();

        const isFilled = currentName && currentBakery;
        const hasChanged = currentName !== originalProfileData.name || currentBakery !== originalProfileData.bakery;

        if (isSetupMode) {
            DOMElements.headerSaveBtn.disabled = !isFilled;
        } else {
            DOMElements.headerSaveBtn.disabled = !isFilled || !hasChanged;
        }
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
            DOMElements.headerSaveBtn.disabled = true;
            DOMElements.headerSaveBtn.innerHTML = '<i class="bi bi-arrow-repeat animate-spin"></i> Saving...';
            await userRef.set(dataToSave, { merge: true });

            if (isSetupMode) {
                window.location.href = '/index.html';
            } else {
                openModal('success', 'Profile Updated', 'Your changes have been saved successfully.');
                originalProfileData.name = name;
                originalProfileData.bakery = bakery;
                DOMElements.headerSaveBtn.innerHTML = '<i class="bi bi-check-lg"></i> Save Changes';
                checkFormValidity();
            }
        } catch (error) {
            console.error("Error saving profile:", error);
            openModal('warning', 'Save Error', 'Could not save your profile. Please try again.');
            DOMElements.headerSaveBtn.innerHTML = '<i class="bi bi-check-lg"></i> Save Changes';
            checkFormValidity();
        }
    }
    
    function compressImage(file, maxSize = 512) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;
                    if (width > height) {
                        if (width > maxSize) { height *= maxSize / width; width = maxSize; }
                    } else {
                        if (height > maxSize) { width *= maxSize / height; height = maxSize; }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                        resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                    }, 'image/jpeg', 0.9);
                };
                img.onerror = reject;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
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
                
                originalProfileData = { name: data.name || '', bakery: data.bakery || '' };

                if (data.photoURL) {
                    DOMElements.photoPreview.src = data.photoURL;
                    DOMElements.removePhotoBtn.classList.remove('hidden');
                }
                DOMElements.headerBackBtn.classList.remove('hidden');
                checkFormValidity();
            } else {
                DOMElements.headerTitle.textContent = 'Welcome! Let\'s Set Up Your Profile.';
                DOMElements.headerSubtitle.textContent = 'Please provide your details to get started.';
                DOMElements.headerSaveBtn.textContent = 'Save and Continue';
                isSetupMode = true;
                checkFormValidity();
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
            checkFormValidity();
        }

        searchInput.addEventListener('focus', () => {
            DOMElements.bakeryDropdown.classList.add('open');
            filterOptions();
        });

        searchInput.addEventListener('blur', () => {
            setTimeout(() => {
                if (!bakeryList.includes(searchInput.value)) {
                    searchInput.value = '';
                    hiddenInput.value = '';
                    checkFormValidity();
                }
            }, 200);
        });

        document.addEventListener('click', (e) => {
            if (!DOMElements.bakeryDropdown.contains(e.target)) {
                DOMElements.bakeryDropdown.classList.remove('open');
            }
        });
        
        selectedDisplay.addEventListener('click', (e) => {
            if (e.target !== searchInput) { searchInput.focus(); }
        });

        searchInput.addEventListener('input', () => {
            filterOptions();
            if (!bakeryList.includes(searchInput.value)) {
                hiddenInput.value = '';
            }
            checkFormValidity();
        });

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
    
    DOMElements.photoUploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const allowedTypes = ['image/jpeg', 'image/png'];
        const maxSizeInMB = 2;
        if (!allowedTypes.includes(file.type)) {
            openModal('warning', 'Invalid File Type', 'Please select a JPG or PNG image.');
            return;
        }
        if (file.size > maxSizeInMB * 1024 * 1024) {
            openModal('warning', 'File Too Large', `Please select an image smaller than ${maxSizeInMB}MB.`);
            return;
        }
        try {
            const compressedFile = await compressImage(file);
            selectedFile = compressedFile;
            const reader = new FileReader();
            reader.onload = (event) => { DOMElements.photoPreview.src = event.target.result; };
            reader.readAsDataURL(compressedFile);
            DOMElements.savePhotoBtn.classList.remove('hidden');
            DOMElements.removePhotoBtn.classList.remove('hidden');
        } catch (error) {
            console.error("Error compressing image:", error);
            openModal('warning', 'Image Error', 'Could not process the selected image.');
        }
    });

    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            loadUserProfile(user);
            setupBakeryDropdown();
        } else {
            window.location.href = '/index.html';
        }
    });

    DOMElements.profileName.addEventListener('input', checkFormValidity);
    DOMElements.headerSaveBtn.addEventListener('click', saveProfile);
    DOMElements.headerBackBtn.addEventListener('click', () => { window.location.href = '/index.html'; });
    DOMElements.modalCloseBtn.addEventListener('click', closeModal);
    DOMElements.modalActionBtn.addEventListener('click', closeModal);
    DOMElements.modalOverlay.addEventListener('mousedown', (e) => {
        if (e.target === DOMElements.modalOverlay) closeModal();
    });
}

document.addEventListener('DOMContentLoaded', initializeFirebase);

