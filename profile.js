// ====================================================================
// SECURELY INITIALIZE FIREBASE
// ====================================================================
async function initializeFirebase() {
    try {
        const response = await fetch('/.netlify/functions/config');
        if (!response.ok) throw new Error('Could not fetch Firebase configuration.');
        const firebaseConfig = await response.json();
        firebase.initializeApp(firebaseConfig);
        runProfileScript();
    } catch (error) {
        console.error("Failed to initialize Firebase:", error);
        document.body.innerHTML = '<div style="text-align: center; padding: 40px; font-family: sans-serif;"><h1>Error</h1><p>Could not load application configuration. Please try again later.</p></div>';
    }
}

function runProfileScript() {
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();

    // --- DOM REFERENCES ---
    const DOMElements = {
        initialLoadingView: document.getElementById('initial-loading-view'),
        profileView: document.getElementById('profile-view'),
        pfpPreview: document.getElementById('pfp-preview'),
        pfpUploadInput: document.getElementById('pfp-upload-input'),
        pfpSpinner: document.getElementById('pfp-spinner'),
        profileNameInput: document.getElementById('profile-name'),
        profileBakeryInput: document.getElementById('profile-bakery'),
        saveProfileBtn: document.getElementById('save-profile-btn'),
        saveIndicator: document.getElementById('save-indicator'),
    };

    let currentUser = null;
    let originalProfileData = {};

    // --- AUTHENTICATION LISTENER ---
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            loadUserProfile();
        } else {
            // If no user is logged in, redirect to the login page
            window.location.href = '/index.html';
        }
    });

    // --- DATA HANDLING ---
    async function loadUserProfile() {
        try {
            const userDocRef = db.collection('users').doc(currentUser.uid);
            const userDoc = await userDocRef.get();

            if (userDoc.exists) {
                const userData = userDoc.data();
                originalProfileData = {
                    name: userData.name || '',
                    bakery: userData.bakery || '',
                    photoURL: userData.photoURL || 'placeholder.png',
                };
                updateUI(originalProfileData);
            } else {
                // If no profile document exists, create one with empty values
                await userDocRef.set({ name: '', bakery: '', photoURL: 'placeholder.png' });
                originalProfileData = { name: '', bakery: '', photoURL: 'placeholder.png' };
                updateUI(originalProfileData);
            }
        } catch (error) {
            console.error("Error loading user profile:", error);
            alert("Could not load your profile. Please try refreshing the page.");
        } finally {
            // Show the profile view and hide the loader
            DOMElements.initialLoadingView.classList.add('hidden');
            DOMElements.profileView.classList.remove('hidden');
        }
    }

    async function saveUserProfile() {
        const newName = DOMElements.profileNameInput.value.trim();
        const newBakery = DOMElements.profileBakeryInput.value.trim();

        if (!newName || !newBakery) {
            alert("Please fill in both your name and bakery.");
            return;
        }

        DOMElements.saveProfileBtn.disabled = true;
        DOMElements.saveProfileBtn.innerHTML = '<div class="loading-spinner !w-5 !h-5 !border-2"></div> Saving...';

        try {
            const userDocRef = db.collection('users').doc(currentUser.uid);
            await userDocRef.update({
                name: newName,
                bakery: newBakery
            });

            originalProfileData.name = newName;
            originalProfileData.bakery = newBakery;

            // Show success indicator
            DOMElements.saveIndicator.classList.remove('opacity-0');
            setTimeout(() => {
                DOMElements.saveIndicator.classList.add('opacity-0');
            }, 2500);

        } catch (error) {
            console.error("Error saving profile:", error);
            alert("There was an error saving your profile. Please try again.");
        } finally {
            DOMElements.saveProfileBtn.disabled = false;
            DOMElements.saveProfileBtn.textContent = 'Save Changes';
        }
    }

    // --- UI UPDATES ---
    function updateUI(profileData) {
        DOMElements.profileNameInput.value = profileData.name;
        DOMElements.profileBakeryInput.value = profileData.bakery;
        DOMElements.pfpPreview.src = profileData.photoURL;
    }

    // --- PROFILE PICTURE HANDLING ---
    async function handlePfpUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type and size
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            alert("Invalid file type. Please upload a JPG, PNG, or WEBP image.");
            return;
        }
        const maxSizeInMB = 5;
        if (file.size > maxSizeInMB * 1024 * 1024) {
            alert(`File is too large. Please upload an image smaller than ${maxSizeInMB}MB.`);
            return;
        }

        DOMElements.pfpSpinner.classList.remove('hidden');

        try {
            const filePath = `profile_pictures/${currentUser.uid}/${Date.now()}_${file.name}`;
            const fileRef = storage.ref(filePath);
            const uploadTask = await fileRef.put(file);
            const downloadURL = await uploadTask.ref.getDownloadURL();

            // Update Firestore with the new photo URL
            const userDocRef = db.collection('users').doc(currentUser.uid);
            await userDocRef.update({ photoURL: downloadURL });

            // Update UI and local state
            originalProfileData.photoURL = downloadURL;
            DOMElements.pfpPreview.src = downloadURL;

        } catch (error) {
            console.error("Error uploading profile picture:", error);
            alert("Failed to upload your profile picture. Please try again.");
        } finally {
            DOMElements.pfpSpinner.classList.add('hidden');
            // Reset file input to allow re-uploading the same file if needed
            DOMElements.pfpUploadInput.value = '';
        }
    }


    // --- EVENT LISTENERS ---
    DOMElements.saveProfileBtn.addEventListener('click', saveUserProfile);
    DOMElements.pfpUploadInput.addEventListener('change', handlePfpUpload);
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', initializeFirebase);
