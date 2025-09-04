// js/manage-team.js

// Import the sign-out function for consistent logout behaviour
import { handleSignOut } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    const backToHubBtn = document.getElementById('back-to-hub-btn');
    const logoutBtn = document.getElementById('dashboard-logout-btn');

    // Make the "Back to Team Hub" button functional
    if (backToHubBtn) {
        backToHubBtn.addEventListener('click', () => {
            window.location.href = '/team.html';
        });
    }

    // Implement robust logout functionality
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            handleSignOut();
        });
    }
});
