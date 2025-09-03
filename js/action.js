// js/action.js

async function initializeFirebase() {
    try {
        const response = await fetch('/.netlify/functions/config');
        if (!response.ok) {
            throw new Error('Could not fetch Firebase configuration.');
        }
        const firebaseConfig = await response.json();
        const app = firebase.initializeApp(firebaseConfig);
        runActionHandler(app);
    } catch (error) {
        console.error("Failed to initialize Firebase:", error);
        showError('Could not connect to the authentication service. Please try again later.');
    }
}

function runActionHandler(app) {
    const auth = firebase.auth();

    const DOMElements = {
        loadingView: document.getElementById('loading-view'),
        resetPasswordView: document.getElementById('reset-password-view'),
        successView: document.getElementById('success-view'),
        errorView: document.getElementById('error-view'),
        newPasswordInput: document.getElementById('new-password'),
        confirmNewPasswordInput: document.getElementById('confirm-new-password'),
        passwordToggles: document.querySelectorAll('.password-toggle'),
        resetPasswordBtn: document.getElementById('reset-password-btn'),
        resetError: document.getElementById('reset-error'),
        errorMessage: document.getElementById('error-message'),
    };

    function getUrlParameter(name) {
        const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
        const results = regex.exec(window.location.href);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, ' '));
    }

    function showError(message) {
        DOMElements.loadingView.classList.add('hidden');
        DOMElements.resetPasswordView.classList.add('hidden');
        DOMElements.successView.classList.add('hidden');
        DOMElements.errorMessage.textContent = message;
        DOMElements.errorView.classList.remove('hidden');
    }

    const mode = getUrlParameter('mode');
    const actionCode = getUrlParameter('oobCode');

    if (mode === 'resetPassword' && actionCode) {
        auth.verifyPasswordResetCode(actionCode)
            .then(email => {
                DOMElements.loadingView.classList.add('hidden');
                DOMElements.resetPasswordView.classList.remove('hidden');

                const handleReset = () => {
                    const newPassword = DOMElements.newPasswordInput.value;
                    const confirmPassword = DOMElements.confirmNewPasswordInput.value;
                    DOMElements.resetError.style.display = 'none';

                    if (newPassword.length < 6) {
                        DOMElements.resetError.textContent = 'Password must be at least 6 characters long.';
                        DOMElements.resetError.style.display = 'block';
                        return;
                    }
                    
                    if (newPassword !== confirmPassword) {
                        DOMElements.resetError.textContent = 'Passwords do not match.';
                        DOMElements.resetError.style.display = 'block';
                        return;
                    }

                    auth.confirmPasswordReset(actionCode, newPassword)
                        .then(() => {
                            DOMElements.resetPasswordView.classList.add('hidden');
                            DOMElements.successView.classList.remove('hidden');
                        })
                        .catch(error => {
                            let message = 'An unexpected error occurred. Please try again.';
                            if (error.code === 'auth/weak-password') {
                                message = 'The new password is too weak.';
                            }
                            DOMElements.resetError.textContent = message;
                            DOMElements.resetError.style.display = 'block';
                        });
                };
                
                DOMElements.resetPasswordBtn.addEventListener('click', handleReset);
                DOMElements.newPasswordInput.addEventListener('keyup', (e) => {
                    if (e.key === 'Enter') handleReset();
                });
                DOMElements.confirmNewPasswordInput.addEventListener('keyup', (e) => {
                    if (e.key === 'Enter') handleReset();
                });

                DOMElements.passwordToggles.forEach(toggle => {
                    toggle.addEventListener('click', () => {
                        const input = toggle.previousElementSibling;
                        const icon = toggle.querySelector('i');
                        if (input.type === 'password') {
                            input.type = 'text';
                            icon.classList.remove('bi-eye-slash-fill');
                            icon.classList.add('bi-eye-fill');
                        } else {
                            input.type = 'password';
                            icon.classList.remove('bi-eye-fill');
                            icon.classList.add('bi-eye-slash-fill');
                        }
                    });
                });

            })
            .catch(error => {
                showError('This password reset link is invalid or has expired. Please request a new one from the login page.');
            });
    } else {
        showError('The requested action is not valid.');
    }
}

document.addEventListener('DOMContentLoaded', initializeFirebase);
