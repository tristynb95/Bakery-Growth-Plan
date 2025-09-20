// js/auth.js

let auth; // The Firebase auth instance

// --- SESSION TIMEOUT LOGIC ---
const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes
let sessionTimeout = null;

/**
 * The single, reliable function for signing out a user.
 * It clears session data from local storage and then signs the user out.
 */
export function handleSignOut() {
    if (auth) {
        localStorage.removeItem('lastPlanId');
        localStorage.removeItem('lastViewId');
        sessionStorage.removeItem('lastPlanId');
        sessionStorage.removeItem('lastViewId');
        localStorage.removeItem('lastActivity');

        // FIX: Clear the login form fields upon logout to prevent pre-filling.
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        if (emailInput) {
            emailInput.value = '';
        }
        if (passwordInput) {
            passwordInput.value = '';
        }
        
        auth.signOut();
    } else {
        console.error("Auth module not initialized. Cannot sign out.");
    }
}

function handleLogout(isTimeout = false) {
    console.log('Logout event triggered...');
    document.dispatchEvent(new CustomEvent('logout-request', { detail: { isTimeout } }));
}

async function resetSessionTimeout(appState) {
    clearTimeout(sessionTimeout);
    localStorage.setItem('lastActivity', new Date().getTime());
    sessionTimeout = setTimeout(async () => {
        if (appState.currentUser) {
            console.log("Session timeout, saving data before logging out.");
            if (appState.forceSave) {
                await appState.forceSave();
            }
            handleLogout(true);
        }
    }, SESSION_DURATION);
}

export function setupActivityListeners(appState) {
    const resetFn = () => resetSessionTimeout(appState);
    window.addEventListener('mousemove', resetFn);
    window.addEventListener('mousedown', resetFn);
    window.addEventListener('keypress', resetFn);
    window.addEventListener('touchmove', resetFn);
    window.addEventListener('scroll', resetFn, true);
    resetSessionTimeout(appState);
}

export function clearActivityListeners() {
    clearTimeout(sessionTimeout);
}

/**
 * Initializes the auth module with the Firebase auth instance and sets up UI listeners.
 * @param {object} _auth The initialized Firebase auth instance.
 */
export function initializeAuth(_auth) {
    auth = _auth;
    const loginBtn = document.getElementById('login-btn');

    if (!loginBtn) {
        return; // Not on the login page, exit gracefully.
    }

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
                    case 'auth/email-already-in-use':
                        friendlyMessage = 'This email may already be registered. Please try logging in instead.';
                        break;
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