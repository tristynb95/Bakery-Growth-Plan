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

    const DOMElements = {
        // Core Profile fields
        profileName: document.getElementById('profile-name'),
        profileBakery: document.getElementById('profile-bakery'),
        profileEmail: document.getElementById('profile-email'),
        saveProfileBtn: document.getElementById('save-profile-btn'),

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

    // Check for setup mode from URL parameter
    const params = new URLSearchParams(window.location.search);
    if (params.get('setup') === 'true') {
        isSetupMode = true;
    }

    // --- Custom Modal Functions ---
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


    // --- Profile Name/Bakery Save Function ---
    async function saveProfile() {
        if (!currentUser) return;

        const name = DOMElements.profileName.value.trim();
        const bakery = DOMElements.profileBakery.value.trim();

        // --- FIX FOR VALIDATION BUG ---
        // This check now runs for both new and existing users.
        if (!name || !bakery) {
            openModal('warning', 'Incomplete Profile', 'Please enter your full name and bakery location to save.');
            return;
        }
        // --- END FIX ---

        const userRef = db.collection('users').doc(currentUser.uid);
        const dataToSave = {
            name: name,
            bakery: bakery,
            email: currentUser.email
        };

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

    // --- Load User Profile Function ---
    function loadUserProfile(user) {
        DOMElements.profileEmail.value = user.email;
        const userRef = db.collection('users').doc(user.uid);

        userRef.get().then((doc) => {
            if (doc.exists && !isSetupMode) {
                DOMElements.headerTitle.textContent = 'Your Profile';
                DOMElements.headerSubtitle.textContent = 'Manage your account details.';
                DOMElements.saveProfileBtn.textContent = 'Save Changes';
                DOMElements.backToDashboardBtn.classList.remove('hidden');

                const data = doc.data();
                DOMElements.profileName.value = data.name || '';
                DOMElements.profileBakery.value = data.bakery || '';

                if (data.photoURL) {
                    DOMElements.photoPreview.src = data.photoURL;
                    DOMElements.removePhotoBtn.classList.remove('hidden');
                } else {
                    DOMElements.photoPreview.src = defaultPhotoURL;
                    DOMElements.removePhotoBtn.classList.add('hidden');
                }
            } else {
                DOMElements.headerTitle.textContent = 'Welcome! Let\'s Set Up Your Profile.';
                DOMElements.headerSubtitle.textContent = 'Please provide your details to get started.';
                DOMElements.saveProfileBtn.textContent = 'Save and Continue';
                isSetupMode = true;
            }
        }).catch(error => {
            console.error("Error fetching user data:", error);
        });
    }

    // --- Photo Management Functions ---
    function handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            openModal('warning', 'File Too Large', 'Please select an image file smaller than 5MB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            DOMElements.photoPreview.src = event.target.result;
            DOMElements.savePhotoBtn.classList.remove('hidden');
            DOMElements.removePhotoBtn.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
        selectedFile = file;
    }

    async function savePhoto() {
        if (!selectedFile || !currentUser) return;
        const uploadPath = `profile_photos/${currentUser.uid}/${selectedFile.name}`;
        const fileRef = storage.ref(uploadPath);
        try {
            DOMElements.savePhotoBtn.disabled = true;
            DOMElements.savePhotoBtn.innerHTML = '<i class="bi bi-arrow-repeat animate-spin"></i><span>Saving...</span>';
            const snapshot = await fileRef.put(selectedFile);
            const photoURL = await snapshot.ref.getDownloadURL();
            await db.collection('users').doc(currentUser.uid).set({ photoURL: photoURL }, { merge: true });
            DOMElements.savePhotoBtn.classList.add('hidden');
            DOMElements.photoPreview.src = photoURL;
            selectedFile = null;
            openModal('success', 'Photo Updated', 'Your new profile photo has been saved.');
        } catch (error) {
            console.error("Error uploading photo:", error);
            openModal('warning', 'Upload Error', 'There was an error uploading your photo. Please try again.');
        } finally {
            DOMElements.savePhotoBtn.disabled = false;
            DOMElements.savePhotoBtn.innerHTML = '<i class="bi bi-save-fill"></i><span>Save Photo</span>';
        }
    }

    async function removePhoto() {
        if (!currentUser) return;
        if (!confirm("Are you sure you want to remove your profile photo?")) return;
        const userRef = db.collection('users').doc(currentUser.uid);
        try {
            await userRef.update({ photoURL: firebase.firestore.FieldValue.delete() });
            try {
                const photoRef = storage.refFromURL(DOMElements.photoPreview.src);
                await photoRef.delete();
            } catch (storageError) {
                console.warn("Could not delete photo from storage:", storageError.message);
            }
            DOMElements.photoPreview.src = defaultPhotoURL;
            DOMElements.removePhotoBtn.classList.add('hidden');
            DOMElements.savePhotoBtn.classList.add('hidden');
            selectedFile = null;
            openModal('success', 'Photo Removed', 'Your profile photo has been removed successfully.');
        } catch (error) {
            console.error("Error removing photo:", error);
            openModal('warning', 'Error', 'There was an error removing your photo.');
        }
    }

    // --- Auth Observer and Event Listeners ---
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            loadUserProfile(user);
        } else {
            window.location.href = '/index.html';
        }
    });

    DOMElements.saveProfileBtn.addEventListener('click', saveProfile);
    DOMElements.backToDashboardBtn.addEventListener('click', () => { window.location.href = '/index.html'; });
    DOMElements.photoUploadInput.addEventListener('change', handleFileSelect);
    DOMElements.savePhotoBtn.addEventListener('click', savePhoto);
    DOMElements.removePhotoBtn.addEventListener('click', removePhoto);

    // Modal listeners
    DOMElements.modalCloseBtn.addEventListener('click', closeModal);
    DOMElements.modalActionBtn.addEventListener('click', closeModal);
    DOMElements.modalOverlay.addEventListener('mousedown', (e) => {
        if (e.target === DOMElements.modalOverlay) {
            closeModal();
        }
    });
}

document.addEventListener('DOMContentLoaded', initializeFirebase);
