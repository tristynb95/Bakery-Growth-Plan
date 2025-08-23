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

    const DOMElements = {
        profileName: document.getElementById('profile-name'),
        profileEmail: document.getElementById('profile-email'),
        backToDashboardBtn: document.getElementById('back-to-dashboard-btn'),
    };

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // User is signed in.
            DOMElements.profileEmail.textContent = user.email;

            // Fetch user's name from Firestore
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                DOMElements.profileName.textContent = userDoc.data().name || 'No name set';
            } else {
                // Look for the name in any of the user's plans
                const plansRef = db.collection('users').doc(user.uid).collection('plans');
                const snapshot = await plansRef.limit(1).get();
                if (!snapshot.empty) {
                    const planData = snapshot.docs[0].data();
                    DOMElements.profileName.textContent = planData.managerName || 'No name set';
                } else {
                    DOMElements.profileName.textContent = 'No name set';
                }
            }
        } else {
            // User is not signed in.
            // Redirect to login page
            window.location.href = '/index.html';
        }
    });

    DOMElements.backToDashboardBtn.addEventListener('click', () => {
        window.location.href = '/index.html';
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();
});
