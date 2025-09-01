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
        profileName: document.getElementById('profile-name'),
        profileEmail: document.getElementById('profile-email'),
        backToDashboardBtn: document.getElementById('back-to-dashboard-btn'),
        photoPreview: document.getElementById('profile-photo-preview'),
        photoUploadInput: document.getElementById('photo-upload-input'),
        savePhotoBtn: document.getElementById('save-photo-btn'),
        removePhotoBtn: document.getElementById('remove-photo-btn'),
    };

    let currentUser = null;
    let selectedFile = null;
    const defaultPhotoURL = 'https://ssl.gstatic.com/images/branding/product/1x/avatar_circle_blue_512dp.png';

    // ====================================================================
    // PHOTO MANAGEMENT FUNCTIONS
    // ====================================================================

    function loadUserProfile(user) {
        DOMElements.profileEmail.value = user.email;
        const userRef = db.collection('users').doc(user.uid);

        userRef.get().then(async (doc) => {
            if (doc.exists) {
                const data = doc.data();
                // Load photo
                if (data.photoURL) {
                    DOMElements.photoPreview.src = data.photoURL;
                    DOMElements.removePhotoBtn.classList.remove('hidden');
                } else {
                    DOMElements.photoPreview.src = defaultPhotoURL;
                    DOMElements.removePhotoBtn.classList.add('hidden');
                }
                // Load name
                if (data.name) {
                    DOMElements.profileName.value = data.name;
                } else {
                    // Fallback to find name in plans
                    const plansRef = userRef.collection('plans');
                    const snapshot = await plansRef.orderBy('lastEdited', 'desc').limit(1).get();
                    if (!snapshot.empty) {
                        const planData = snapshot.docs[0].data();
                        DOMElements.profileName.value = planData.managerName || 'No name set';
                    } else {
                        DOMElements.profileName.value = 'No name set';
                    }
                }
            }
        }).catch(error => {
            console.error("Error fetching user data:", error);
        });
    }

    function handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Simple validation
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            alert('File is too large. Please select a file smaller than 5MB.');
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
            DOMElements.savePhotoBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i><span>Saving...</span>';

            const snapshot = await fileRef.put(selectedFile);
            const photoURL = await snapshot.ref.getDownloadURL();

            await db.collection('users').doc(currentUser.uid).set({ photoURL: photoURL }, { merge: true });

            DOMElements.savePhotoBtn.classList.add('hidden');
            DOMElements.photoPreview.src = photoURL;
            selectedFile = null;
            alert('Profile photo updated successfully!');

        } catch (error) {
            console.error("Error uploading photo:", error);
            alert('There was an error uploading your photo. Please try again.');
        } finally {
            DOMElements.savePhotoBtn.disabled = false;
            DOMElements.savePhotoBtn.innerHTML = '<i class="bi bi-save-fill"></i><span>Save</span>';
        }
    }

    async function removePhoto() {
        if (!currentUser) return;
        if (!confirm("Are you sure you want to remove your profile photo?")) return;

        const userRef = db.collection('users').doc(currentUser.uid);

        try {
            // First, remove the photoURL from Firestore
            await userRef.update({ photoURL: firebase.firestore.FieldValue.delete() });

            // Try to delete from Storage. This might fail if the user has a photo from an old system, so we wrap it.
            try {
                const photoRef = storage.refFromURL(DOMElements.photoPreview.src);
                await photoRef.delete();
            } catch (storageError) {
                // If the file doesn't exist in storage (e.g. old URL, permissions issue), log it but don't block the user.
                console.warn("Could not delete photo from storage:", storageError.message);
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

    // ====================================================================
    // AUTHENTICATION AND EVENT LISTENERS
    // ====================================================================

    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            loadUserProfile(user);
        } else {
            currentUser = null;
            window.location.href = '/index.html';
        }
    });

    DOMElements.backToDashboardBtn.addEventListener('click', () => {
        window.location.href = '/index.html';
    });

    DOMElements.photoUploadInput.addEventListener('change', handleFileSelect);
    DOMElements.savePhotoBtn.addEventListener('click', savePhoto);
    DOMElements.removePhotoBtn.addEventListener('click', removePhoto);
}

document.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();
});
