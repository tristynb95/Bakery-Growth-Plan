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
        document.body.innerHTML = '<div style="text-align: center; padding: 40px; font-family: sans-serif;"><h1>Error</h1><p>Could not load application configuration. Please contact support.</p></div>';
    }
}

function runProfileScript(app) {
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();

    const DOMElements = {
        profileContent: document.getElementById('profile-content'),
        profileLoading: document.getElementById('profile-loading'),
        pfpPreview: document.getElementById('pfp-preview'),
        pfpInitials: document.getElementById('pfp-initials'),
        pfpUpload: document.getElementById('pfp-upload'),
        pfpUploadBtn: document.getElementById('pfp-upload-btn'),
        profileName: document.getElementById('profile-name'),
        profileBakery: document.getElementById('profile-bakery'),
        saveProfileBtn: document.getElementById('save-profile-btn'),
        saveIndicator: document.getElementById('save-indicator')
    };

    let currentUser = null;
    let userProfile = {};

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            loadUserProfile();
        } else {
            window.location.href = '/index.html';
        }
    });

    async function loadUserProfile() {
        DOMElements.profileLoading.classList.remove('hidden');
        DOMElements.profileContent.classList.add('hidden');

        const userRef = db.collection('users').doc(currentUser.uid);
        const doc = await userRef.get();

        if (doc.exists) {
            userProfile = doc.data();
        } else {
            // Create a default profile if one doesn't exist
            userProfile = {
                name: currentUser.displayName || '',
                bakery: '',
                photoURL: currentUser.photoURL || ''
            };
            await userRef.set(userProfile);
        }

        DOMElements.profileName.value = userProfile.name || '';
        DOMElements.profileBakery.value = userProfile.bakery || '';

        if (userProfile.photoURL) {
            DOMElements.pfpPreview.src = userProfile.photoURL;
            DOMElements.pfpPreview.classList.remove('hidden');
            DOMElements.pfpInitials.classList.add('hidden');
        } else {
            DOMElements.pfpPreview.classList.add('hidden');
            DOMElements.pfpInitials.classList.remove('hidden');
            const name = DOMElements.profileName.value;
             if (name) {
                const names = name.trim().split(' ');
                const firstInitial = names[0] ? names[0][0] : '';
                const lastInitial = names.length > 1 ? names[names.length - 1][0] : '';
                DOMElements.pfpInitials.textContent = (firstInitial + lastInitial).toUpperCase();
            } else {
                DOMElements.pfpInitials.textContent = '--';
            }
        }

        DOMElements.profileLoading.classList.add('hidden');
        DOMElements.profileContent.classList.remove('hidden');
    }

    DOMElements.pfpUploadBtn.addEventListener('click', () => {
        DOMElements.pfpUpload.click();
    });

    DOMElements.pfpUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                DOMElements.pfpPreview.src = event.target.result;
                DOMElements.pfpPreview.classList.remove('hidden');
                DOMElements.pfpInitials.classList.add('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    DOMElements.saveProfileBtn.addEventListener('click', async () => {
        const file = DOMElements.pfpUpload.files[0];
        const name = DOMElements.profileName.value.trim();
        const bakery = DOMElements.profileBakery.value.trim();
        let photoURL = userProfile.photoURL;

        DOMElements.saveProfileBtn.disabled = true;
        DOMElements.saveProfileBtn.textContent = 'Saving...';


        try {
            if (file) {
                const storageRef = storage.ref(`profile_pictures/${currentUser.uid}/${file.name}`);
                const snapshot = await storageRef.put(file);
                photoURL = await snapshot.ref.getDownloadURL();
            }

            const updatedProfile = { name, bakery, photoURL };
            await db.collection('users').doc(currentUser.uid).set(updatedProfile, { merge: true });

            userProfile = updatedProfile;

            DOMElements.saveIndicator.classList.remove('opacity-0');
            setTimeout(() => DOMElements.saveIndicator.classList.add('opacity-0'), 3000);

        } catch (error) {
            console.error("Error saving profile:", error);
            alert("There was an error saving your profile. Please try again.");
        } finally {
            DOMElements.saveProfileBtn.disabled = false;
            DOMElements.saveProfileBtn.textContent = 'Save Changes';
        }
    });
}

document.addEventListener('DOMContentLoaded', initializeFirebase);
