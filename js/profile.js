// js/profile.js

async function initializeFirebase() {
    try {
        const response = await fetch('/.netlify/functions/config');
        if (!response.ok) throw new Error('Could not fetch Firebase configuration.');
        const firebaseConfig = await response.json();
        const app = firebase.initializeApp(firebaseConfig);
        runProfileScript(app);
    } catch (error) {
        console.error("Failed to initialize Firebase:", error);
        document.getElementById('header-title').textContent = 'Error';
        document.getElementById('header-subtitle').textContent = 'Could not load application configuration.';
    }
}

function runProfileScript(app) {
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();

    const DOMElements = {
        headerTitle: document.getElementById('header-title'),
        headerSubtitle: document.getElementById('header-subtitle'),
        profileName: document.getElementById('profile-name'),
        profileBakery: document.getElementById('profile-bakery'),
        profileEmail: document.getElementById('profile-email'),
        backToDashboardBtn: document.getElementById('back-to-dashboard-btn'),
        saveProfileBtn: document.getElementById('save-profile-btn'),
        photoPreview: document.getElementById('profile-photo-preview'),
        photoUploadInput: document.getElementById('photo-upload-input'),
        savePhotoBtn: document.getElementById('save-photo-btn'),
        removePhotoBtn: document.getElementById('remove-photo-btn'),
        modalOverlay: document.getElementById('modal-overlay'),
        modalMessage: document.getElementById('modal-message'),
    };

    let currentUser = null;
    let selectedFile = null;
    const defaultPhotoURL = 'https://ssl.gstatic.com/images/branding/product/1x/avatar_circle_blue_512dp.png';

    function showSpinnerModal(message) {
        DOMElements.modalMessage.textContent = message;
        DOMElements.modalOverlay.classList.remove('hidden');
    }

    function hideSpinnerModal() {
        DOMElements.modalOverlay.classList.add('hidden');
    }

    async function saveProfile() {
        const name = DOMElements.profileName.value.trim();
        const bakery = DOMElements.profileBakery.value.trim();

        if (!name || !bakery) {
            alert('Please enter your full name and bakery location.');
            return;
        }

        try {
            showSpinnerModal('Saving your profile...');
            const userDocRef = db.collection('users').doc(currentUser.uid);
            await userDocRef.set({
                name: name,
                bakery: bakery,
                email: currentUser.email
            }, { merge: true });

            const params = new URLSearchParams(window.location.search);
            if (params.get('setup') === 'true') {
                setTimeout(() => {
                    window.location.href = '/index.html';
                }, 1500);
            } else {
                 setTimeout(() => {
                    hideSpinnerModal();
                    alert('Profile updated successfully!');
                }, 1000);
            }
        } catch (error) {
            console.error("Error saving profile:", error);
            hideSpinnerModal();
            alert('Could not save your profile. Please try again.');
        }
    }

    function handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            alert('File is too large. Please select a file smaller than 5MB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            DOMElements.photoPreview.src = event.target.result;
            DOMElements.savePhotoBtn.classList.remove('hidden');
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
            DOMElements.savePhotoBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i><span>Saving...</span>';
            const snapshot = await fileRef.put(selectedFile);
            const photoURL = await snapshot.ref.getDownloadURL();
            await db.collection('users').doc(currentUser.uid).set({ photoURL }, { merge: true });
            DOMElements.savePhotoBtn.classList.add('hidden');
            DOMElements.removePhotoBtn.classList.remove('hidden');
            selectedFile = null;
            alert('Profile photo updated!');
        } catch (error) {
            console.error("Error uploading photo:", error);
            alert('Error uploading photo. Please try again.');
        } finally {
            DOMElements.savePhotoBtn.disabled = false;
            DOMElements.savePhotoBtn.innerHTML = '<i class="bi bi-save-fill"></i><span>Save Photo</span>';
        }
    }

    async function removePhoto() {
        if (!currentUser || !confirm("Are you sure you want to remove your profile photo?")) return;
        try {
            const userRef = db.collection('users').doc(currentUser.uid);
            const currentPhotoUrl = DOMElements.photoPreview.src;

            await userRef.update({ photoURL: firebase.firestore.FieldValue.delete() });
            
            if (currentPhotoUrl !== defaultPhotoURL) {
                 try {
                    const photoRef = storage.refFromURL(currentPhotoUrl);
                    await photoRef.delete();
                } catch (storageError) {
                    console.warn("Could not delete photo from storage (it may have already been deleted):", storageError.message);
                }
            }
            
            DOMElements.photoPreview.src = defaultPhotoURL;
            DOMElements.removePhotoBtn.classList.add('hidden');
            DOMElements.savePhotoBtn.classList.add('hidden');
            selectedFile = null;
            alert('Profile photo removed.');
        } catch (error) {
            console.error("Error removing photo:", error);
            alert('There was an error removing your photo.');
        }
    }

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            const userDocRef = db.collection('users').doc(user.uid);
            const userDoc = await userDocRef.get();
            const params = new URLSearchParams(window.location.search);
            const isSetupMode = params.get('setup') === 'true' && !userDoc.exists();

            DOMElements.profileEmail.value = user.email;

            if (isSetupMode) {
                DOMElements.headerTitle.textContent = 'Welcome to GAIL\'s!';
                DOMElements.headerSubtitle.textContent = 'Let\'s set up your profile to get started.';
                DOMElements.saveProfileBtn.textContent = 'Save and Continue';
                DOMElements.backToDashboardBtn.classList.add('hidden');
            } else {
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    DOMElements.profileName.value = data.name || '';
                    DOMElements.profileBakery.value = data.bakery || '';
                    if (data.photoURL) {
                        DOMElements.photoPreview.src = data.photoURL;
                        DOMElements.removePhotoBtn.classList.remove('hidden');
                    }
                }
                DOMElements.saveProfileBtn.textContent = 'Save Changes';
                DOMElements.backToDashboardBtn.classList.remove('hidden');
            }
        } else {
            window.location.href = '/index.html';
        }
    });

    DOMElements.backToDashboardBtn.addEventListener('click', () => {
        window.location.href = '/index.html';
    });
    DOMElements.saveProfileBtn.addEventListener('click', saveProfile);
    DOMElements.photoUploadInput.addEventListener('change', handleFileSelect);
    DOMElements.savePhotoBtn.addEventListener('click', savePhoto);
    DOMElements.removePhotoBtn.addEventListener('click', removePhoto);
}

document.addEventListener('DOMContentLoaded', initializeFirebase);
