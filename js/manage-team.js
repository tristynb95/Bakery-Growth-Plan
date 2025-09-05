// js/manage-team.js

// Import the sign-out function for consistent logout behaviour
import { handleSignOut } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- Page Navigation ---
    const backToHubBtn = document.getElementById('back-to-hub-btn');
    const logoutBtn = document.getElementById('dashboard-logout-btn');

    if (backToHubBtn) {
        backToHubBtn.addEventListener('click', () => { window.location.href = '/team.html'; });
    }
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => { handleSignOut(); });
    }

    // --- Add/Edit Member Modal Logic ---
    const addMemberBtn = document.getElementById('add-member-btn');
    const modalOverlay = document.getElementById('member-modal-overlay');
    const modalCloseBtn = document.getElementById('member-modal-close-btn');
    const modalCancelBtn = document.getElementById('member-modal-cancel-btn');
    const modalActionBtn = document.getElementById('member-modal-action-btn');

    // Tag Input Elements
    const coursesContainer = document.getElementById('member-courses-container');
    const coursesInput = document.getElementById('member-courses-input');
    let courses = new Set();

    function createTag(label) {
        const tag = document.createElement('div');
        tag.classList.add('tag-item');
        tag.innerHTML = `
            <span>${label}</span>
            <i class="bi bi-x-lg tag-remove-btn" data-label="${label}"></i>
        `;
        // Insert the new tag before the input field
        coursesContainer.insertBefore(tag, coursesInput);
    }

    function resetForm() {
        document.getElementById('member-first-name').value = '';
        document.getElementById('member-last-name').value = '';
        document.getElementById('member-position').value = '';
        document.getElementById('member-start-date').value = '';
        document.getElementById('member-key-holder').checked = false;
        coursesInput.value = '';
        courses.clear();
        coursesContainer.querySelectorAll('.tag-item').forEach(tag => tag.remove());
    }

    function openModal() {
        resetForm();
        modalOverlay.classList.remove('hidden');
    }

    function closeModal() {
        modalOverlay.classList.add('hidden');
    }
    
    // Event Listeners for Modal
    if (addMemberBtn) { addMemberBtn.addEventListener('click', openModal); }
    if (modalCloseBtn) { modalCloseBtn.addEventListener('click', closeModal); }
    if (modalCancelBtn) { modalCancelBtn.addEventListener('click', closeModal); }
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });
    }

    // Tag Input Logic
    if (coursesInput) {
        coursesInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const label = coursesInput.value.trim();
                if (label && !courses.has(label)) {
                    courses.add(label);
                    createTag(label);
                }
                coursesInput.value = '';
            }
        });
    }

    if (coursesContainer) {
        coursesContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('tag-remove-btn')) {
                const labelToRemove = e.target.dataset.label;
                courses.delete(labelToRemove);
                e.target.parentElement.remove();
            }
        });
    }
    
    if (modalActionBtn) {
        modalActionBtn.addEventListener('click', () => {
            const newMember = {
                firstName: document.getElementById('member-first-name').value,
                lastName: document.getElementById('member-last-name').value,
                position: document.getElementById('member-position').value,
                startDate: document.getElementById('member-start-date').value,
                isKeyHolder: document.getElementById('member-key-holder').checked,
                completedCourses: Array.from(courses) // Convert Set to Array for Firestore
            };

            console.log('Saving member:', newMember);
            // Add Firestore save logic here...
            // e.g., db.collection('users').doc(managerUID).collection('team').add(newMember);

            closeModal();
        });
    }
});
