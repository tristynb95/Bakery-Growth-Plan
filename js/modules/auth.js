import { auth } from './firebase.js';
import { DOMElements } from './dom.js';
import { appState } from './state.js';
import { clearActivityListeners, setupActivityListeners, resetSessionTimeout } from './session.js';
import { renderDashboard, restoreLastView } from './ui.js';
import { openModal } from './modal.js';

/**
 * Initializes the authentication state listener. This is the main entry point
 * for the application logic after a user's authentication state changes.
 */
export function initializeAuthListener() {
    auth.onAuthStateChanged(async (user) => {
        // Clear any existing data listeners to prevent memory leaks
        if (appState.planUnsubscribe) {
            appState.planUnsubscribe();
            appState.planUnsubscribe = null;
        }
        if (appState.calendarUnsubscribe) {
            appState.calendarUnsubscribe();
            appState.calendarUnsubscribe = null;
        }

        if (user) {
            // User is signed in
            const lastActivity = localStorage.getItem('lastActivity');
            const MAX_INACTIVITY_PERIOD = 8 * 60 * 60 * 1000; // 8 hours

            // If the session is too old, force a logout for security
            if (lastActivity && (new Date().getTime() - lastActivity > MAX_INACTIVITY_PERIOD)) {
                handleLogout(false, true); // `isRevival = true` shows a specific message
                return;
            }

            // Hide auth views and show loading spinner
            DOMElements.loginView.classList.add('hidden');
            DOMElements.registerView.classList.add('hidden');
            DOMElements.resetView.classList.add('hidden');
            DOMElements.initialLoadingView.classList.remove('hidden');

            appState.currentUser = user;
            setupActivityListeners();
            resetSessionTimeout();

            // Check if the user was viewing a specific plan before
            const lastPlanId = localStorage.getItem('lastPlanId');
            const lastViewId = localStorage.getItem('lastViewId');

            if (lastPlanId && lastViewId) {
                await restoreLastView(lastPlanId, lastViewId);
            } else {
                DOMElements.dashboardView.classList.remove('hidden');
                await renderDashboard();
            }
            DOMElements.initialLoadingView.classList.add('hidden');
        } else {
            // User is signed out
            appState.currentUser = null;
            appState.planData = {};
            appState.currentPlanId = null;
            clearActivityListeners();

            // Show the login page and hide all app/dashboard views
            DOMElements.initialLoadingView.classList.add('hidden');
            DOMElements.appView.classList.add('hidden');
            DOMElements.dashboardView.classList.add('hidden');
            DOMElements.registerView.classList.add('hidden');
            DOMElements.resetView.classList.add('hidden');
            DOMElements.loginView.classList.remove('hidden');
        }
    });
}

/**
 * Handles the user logout process.
 * @param {boolean} [isTimeout=false] - Whether the logout is due to a session timeout.
 * @param {boolean} [isRevival=false] - Whether the logout is due to reviving an old session.
 */
export const handleLogout = (isTimeout = false, isRevival = false) => {
    console.log('Logging out...');
    // Unsubscribe from data listeners
    if (appState.planUnsubscribe) appState.planUnsubscribe();
    if (appState.calendarUnsubscribe) appState.calendarUnsubscribe();
    
    // Clear local storage related to the session
    localStorage.removeItem('lastPlanId');
    localStorage.removeItem('lastViewId');
    localStorage.removeItem('lastActivity');

    // Hide UI elements that should not be visible when logged out
    const radialMenu = document.getElementById('radial-menu-container');
    if (radialMenu) radialMenu.classList.add('hidden');

    if (isTimeout) openModal('timeout');
    
    if (isRevival) {
        DOMElements.authError.textContent = 'For your security, please sign in again.';
        DOMElements.authError.style.display = 'block';
    }
    
    // Clear input fields and sign out
    DOMElements.emailInput.value = '';
    DOMElements.passwordInput.value = '';
    try {
        auth.signOut();
    } catch (error) {
        console.error('Error signing out:', error);
        window.location.reload(); // Force a reload as a fallback
    }
};

/**
 * Attempts to log in the user with the provided credentials.
 */
const handleLoginAttempt = () => {
    DOMElements.authError.style.display = 'none';
    auth.signInWithEmailAndPassword(DOMElements.emailInput.value, DOMElements.passwordInput.value)
        .catch(error => {
            let friendlyMessage = 'An unexpected error occurred. Please try again.';
            // CORRECTED: Enhanced error handling for more specific user feedback.
            switch (error.code) {
                case 'auth/invalid-login-credentials':
                case 'auth/invalid-credential':
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                    friendlyMessage = 'Incorrect email or password. Please check your details and try again.';
                    break;
                case 'auth/invalid-email':
                    friendlyMessage = 'The email address is not valid. Please enter a valid email.';
                    break;
                case 'auth/too-many-requests':
                    friendlyMessage = 'Access to this account has been temporarily disabled due to many failed login attempts. You can immediately restore it by resetting your password or you can try again later.';
                    break;
            }
            DOMElements.authError.textContent = friendlyMessage;
            DOMElements.authError.style.display = 'block';
        });
};

/**
 * Sets up all event listeners related to authentication (login, registration, password reset).
 */
export function setupAuthEventListeners() {
    DOMElements.loginBtn.addEventListener('click', handleLoginAttempt);

    const loginOnEnter = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleLoginAttempt();
        }
    };
    DOMElements.emailInput.addEventListener('keyup', loginOnEnter);
    DOMElements.passwordInput.addEventListener('keyup', loginOnEnter);

    DOMElements.createAccountBtn.addEventListener('click', () => {
        const email = DOMElements.registerEmail.value;
        const password = DOMElements.registerPassword.value;
        const errorContainer = DOMElements.registerError;
        errorContainer.style.display = 'none';

        if (!DOMElements.termsAgreeCheckbox.checked) {
            errorContainer.textContent = 'You must agree to the Terms and Conditions and Privacy Policy.';
            errorContainer.style.display = 'block';
            return;
        }
        
        auth.createUserWithEmailAndPassword(email, password)
            .catch(error => {
                let friendlyMessage = 'An unexpected error occurred. Please try again.';
                switch (error.code) {
                    case 'auth/email-already-in-use':
                        friendlyMessage = 'An account with this email address already exists. Please try logging in.';
                        break;
                    case 'auth/weak-password':
                        friendlyMessage = 'The password is too weak. Please choose a stronger password (at least 6 characters).';
                        break;
                    case 'auth/invalid-email':
                        friendlyMessage = 'The email address is not valid. Please enter a valid email.';
                        break;
                }
                errorContainer.textContent = friendlyMessage;
                errorContainer.style.display = 'block';
            });
    });

    DOMElements.showRegisterViewBtn.addEventListener('click', (e) => {
        e.preventDefault();
        DOMElements.loginView.classList.add('hidden');
        DOMElements.resetView.classList.add('hidden');
        DOMElements.registerView.classList.remove('hidden');
        DOMElements.authError.style.display = 'none';
    });

    DOMElements.backToLoginFromRegisterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        DOMElements.registerView.classList.add('hidden');
        DOMElements.loginView.classList.remove('hidden');
    });

    DOMElements.forgotPasswordBtn.addEventListener('click', (e) => {
        e.preventDefault();
        DOMElements.loginView.classList.add('hidden');
        DOMElements.registerView.classList.add('hidden');
        DOMElements.resetView.classList.remove('hidden');
        DOMElements.authError.style.display = 'none';
        DOMElements.resetMessageContainer.innerHTML = '';
    });

    DOMElements.backToLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        DOMElements.resetView.classList.add('hidden');
        DOMElements.loginView.classList.remove('hidden');
    });

    DOMElements.sendResetBtn.addEventListener('click', () => {
        const email = DOMElements.resetEmail.value;
        const messageContainer = DOMElements.resetMessageContainer;
        messageContainer.innerHTML = '';

        if (!email) {
            messageContainer.innerHTML = `<p class="auth-error" style="display:block; margin-bottom: 1rem;">Please enter your email address.</p>`;
            return;
        }

        DOMElements.sendResetBtn.disabled = true;
        DOMElements.sendResetBtn.textContent = 'Sending...';

        auth.sendPasswordResetEmail(email)
            .then(() => {
                messageContainer.innerHTML = `<p class="auth-success">If an account exists for this email, a password reset link has been sent. Please check your inbox.</p>`;
            })
            .catch((error) => {
                // For security, always show the same success message to prevent email enumeration.
                messageContainer.innerHTML = `<p class="auth-success">If an account exists for this email, a password reset link has been sent. Please check your inbox.</p>`;
                console.error("Password Reset Error:", error.message);
            })
            .finally(() => {
                setTimeout(() => {
                    DOMElements.sendResetBtn.disabled = false;
                    DOMElements.sendResetBtn.textContent = 'Send Reset Link';
                }, 3000);
            });
    });

    DOMElements.sidebarLogoutBtn.addEventListener('click', () => handleLogout(false));
    DOMElements.dashboardLogoutBtn.addEventListener('click', () => handleLogout(false));
}
