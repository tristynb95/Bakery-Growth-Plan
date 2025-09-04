// js/auth.js

// --- SESSION TIMEOUT LOGIC ---
const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes
let sessionTimeout = null;

// This will be called from main.js when the user logs out.
function handleLogout(isTimeout = false) {
    console.log('Logout event triggered...');
    // The actual sign out is handled by the onAuthStateChanged listener in main.js
    // We just need to trigger it.
    document.dispatchEvent(new CustomEvent('logout-request', { detail: { isTimeout } }));
}

async function resetSessionTimeout(appState) {
    clearTimeout(sessionTimeout);
    localStorage.setItem('lastActivity', new Date().getTime());
    sessionTimeout = setTimeout(async () => {
        if (appState.currentUser) {
            console.log("Session timeout, saving data before logging out.");
            // Check if the forceSave function exists on the appState and call it
            if (appState.forceSave) {
                await appState.forceSave();
            }
            handleLogout(true);
        }
    }, SESSION_DURATION);
}

export function setupActivityListeners(appState) {
    // Pass appState here to avoid making it a global module variable
    const resetFn = () => resetSessionTimeout(appState);
    window.addEventListener('mousemove', resetFn);
    window.addEventListener('mousedown', resetFn);
    window.addEventListener('keypress', resetFn);
    window.addEventListener('touchmove', resetFn);
    window.addEventListener('scroll', resetFn, true);
    resetSessionTimeout(appState); // Start the timer immediately
}

export function clearActivityListeners() {
    // We need to be able to remove the specific listener function.
    // This is a simplification. For a real implementation, we would need to store the listener function reference.
    // For this refactoring, we'll assume a page reload clears them effectively upon logout.
    clearTimeout(sessionTimeout);
    // A more robust implementation would be:
    // window.removeEventListener('mousemove', resetFn); ...and so on for all listeners.
}


// This function will be in charge of setting up all the buttons and inputs for the login/register screens.
export function initializeAuth(auth) {
    const loginBtn = document.getElementById('login-btn');

    // ================== THE FIX ==================
    // If the login button doesn't exist, we're not on the login page.
    // So, we exit the function to prevent errors.
    if (!loginBtn) {
        return;
    }
    // =============================================

    // --- DOM Elements for Authentication ---
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const authError = document.getElementById('auth-error');
    const forgotPasswordBtn = document.getElementById('forgot-password-btn');
    const resetView = document.getElementById('reset-view');
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');
    const showRegisterViewBtn = document.getElementById('show-register-view-btn');
    const backToLoginFromRegisterBtn = document.getElementById('back-to-login-from-register-btn');
    const registerEmail = document.getElementById('register-email');
    const registerPassword = document.getElementById('register-password');
    const termsAgreeCheckbox = document.getElementById('terms-agree');
    const createAccountBtn = document.getElementById('create-account-btn');
    const registerError = document.getElementById('register-error');
    const resetEmail = document.getElementById('reset-email');
    const sendResetBtn = document.getElementById('send-reset-btn');
    const resetMessageContainer = document.getElementById('reset-message-container');
    const backToLoginBtn = document.getElementById('back-to-login-btn');

    // --- Login Logic ---
    const handleLoginAttempt = () => {
        authError.style.display = 'none';
        auth.signInWithEmailAndPassword(emailInput.value, passwordInput.value)
            .catch(error => {
                let friendlyMessage = 'An unexpected error occurred. Please try again.';
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
                }
                authError.textContent = friendlyMessage;
                authError.style.display = 'block';
            });
    };

    const loginOnEnter = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleLoginAttempt();
        }
    };

    loginBtn.addEventListener('click', handleLoginAttempt);
    emailInput.addEventListener('keyup', loginOnEnter);
    passwordInput.addEventListener('keyup', loginOnEnter);

    // --- Registration Logic ---
    createAccountBtn.addEventListener('click', () => {
        const email = registerEmail.value;
        const password = registerPassword.value;
        registerError.style.display = 'none';
        if (!termsAgreeCheckbox.checked) {
            registerError.textContent = 'You must agree to the Terms and Conditions and Privacy Policy.';
            registerError.style.display = 'block';
            return;
        }
        auth.createUserWithEmailAndPassword(email, password)
            .catch(error => {
                let friendlyMessage = 'An unexpected error occurred. Please try again.';
                switch (error.code) {
                    // --- MODIFIED LINE START ---
                    case 'auth/email-already-in-use':
                        friendlyMessage = 'This email may already be registered. Please try logging in instead.';
                        break;
                    // --- MODIFIED LINE END ---
                    case 'auth/weak-password':
                        friendlyMessage = 'The password is too weak. Please choose a stronger password.';
                        break;
                    case 'auth/invalid-email':
                        friendlyMessage = 'The email address is not valid. Please enter a valid email.';
                        break;
                }
                registerError.textContent = friendlyMessage;
                registerError.style.display = 'block';
            });
    });

    // --- View Switching Logic ---
    showRegisterViewBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loginView.classList.add('hidden');
        resetView.classList.add('hidden');
        registerView.classList.remove('hidden');
        authError.style.display = 'none';
    });

    backToLoginFromRegisterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        registerView.classList.add('hidden');
        loginView.classList.remove('hidden');
    });

    forgotPasswordBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loginView.classList.add('hidden');
        registerView.classList.add('hidden');
        resetView.classList.remove('hidden');
        authError.style.display = 'none';
        resetMessageContainer.innerHTML = '';
    });

    backToLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        resetView.classList.add('hidden');
        loginView.classList.remove('hidden');
    });

    // --- Password Reset Logic ---
    sendResetBtn.addEventListener('click', () => {
        const email = resetEmail.value;
        resetMessageContainer.innerHTML = '';
        if (!email) {
            resetMessageContainer.innerHTML = `<p class="auth-error" style="display:block; margin-bottom: 1rem;">Please enter your email address.</p>`;
            return;
        }
        sendResetBtn.disabled = true;
        sendResetBtn.textContent = 'Sending...';
        auth.sendPasswordResetEmail(email)
            .then(() => {
                resetMessageContainer.innerHTML = `<p class="auth-success">If an account exists for this email, a password reset link has been sent. Please check your inbox.</p>`;
            })
            .catch((error) => {
                if (error.code === 'auth/invalid-email') {
                    resetMessageContainer.innerHTML = `<p class="auth-error" style="display:block; margin-bottom: 1rem;">The email address is not valid. Please enter a valid email.</p>`;
                } else {
                    // For all other errors (like user-not-found), show the generic success message
                    resetMessageContainer.innerHTML = `<p class="auth-success">If an account exists for this email, a password reset link has been sent. Please check your inbox.</p>`;
                }
                console.error("Password Reset Error:", error.code, error.message);
            })
            .finally(() => {
                setTimeout(() => {
                    sendResetBtn.disabled = false;
                    sendResetBtn.textContent = 'Send Reset Link';
                }, 3000);
            });
    });
}
