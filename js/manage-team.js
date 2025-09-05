// js/manage-team.js

// Import the sign-out function for consistent logout behaviour
import { handleSignOut } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- Page Navigation ---
    const backToHubBtn = document.getElementById('back-to-hub-btn');
    const logoutBtn = document.getElementById('dashboard-logout-btn');

    if (backToHubBtn) {
        backToHubBtn.addEventListener('click', () => {
            window.location.href = '/team.html';
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            handleSignOut();
        });
    }

    // --- Add/Edit Member Modal Logic ---
    const addMemberBtn = document.getElementById('add-member-btn');
    const modalOverlay = document.getElementById('member-modal-overlay');
    const modalBox = document.getElementById('member-modal-box');
    const modalCloseBtn = document.getElementById('member-modal-close-btn');
    const modalCancelBtn = document.getElementById('member-modal-cancel-btn');
    const modalActionBtn = document.getElementById('member-modal-action-btn');

    function openModal() {
        // Reset form fields here if needed
        modalOverlay.classList.remove('hidden');
    }

    function closeModal() {
        modalOverlay.classList.add('hidden');
    }
    
    // Event Listeners
    if (addMemberBtn) {
        addMemberBtn.addEventListener('click', openModal);
    }
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeModal);
    }
    if (modalCancelBtn) {
        modalCancelBtn.addEventListener('click', closeModal);
    }
    
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            // Closes modal if user clicks on the dark background
            if (e.target === modalOverlay) {
                closeModal();
            }
        });
    }
    
    if (modalActionBtn) {
        modalActionBtn.addEventListener('click', () => {
            // This is where you would add the logic to save the new member's data to Firestore.
            // For now, it will just log the data and close.
            const name = document.getElementById('member-name').value;
            const position = document.getElementById('member-position').value;
            const email = document.getElementById('member-email').value;

            console.log('Saving member:', { name, position, email });
            // Add Firestore save logic here...

            closeModal();
        });
    }

});
