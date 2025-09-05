// js/manage-team.js

import { handleSignOut } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- Data ---
    const positions = [
        'Assistant Bakery Manager', 'Baker', 'Bakery Manager', 'Barista', 
        'Head Baker', 'Head Barista', 'Team Leader', 'Team Member'
    ].sort();

    // --- Page Navigation ---
    const backToHubBtn = document.getElementById('back-to-hub-btn');
    const logoutBtn = document.getElementById('dashboard-logout-btn');
    if (backToHubBtn) { backToHubBtn.addEventListener('click', () => { window.location.href = '/team.html'; }); }
    if (logoutBtn) { logoutBtn.addEventListener('click', () => { handleSignOut(); }); }

    // --- Modal Elements ---
    const addMemberBtn = document.getElementById('add-member-btn');
    const modalOverlay = document.getElementById('member-modal-overlay');
    const modalCloseBtn = document.getElementById('member-modal-close-btn');
    const modalCancelBtn = document.getElementById('member-modal-cancel-btn');
    const modalActionBtn = document.getElementById('member-modal-action-btn');

    // --- Tag Input Elements ---
    const coursesContainer = document.getElementById('member-courses-container');
    const coursesInput = document.getElementById('member-courses-input');
    let courses = new Set();

    // --- Custom Dropdown Functionality ---
    function setupPositionDropdown() {
        const dropdown = document.getElementById('position-dropdown');
        const searchInput = document.getElementById('position-search-input');
        const hiddenInput = document.getElementById('member-position');
        const optionsContainer = dropdown.querySelector('.dropdown-options');
        const selectedDisplay = dropdown.querySelector('.dropdown-selected'); // <-- FIX: Get reference to the container

        function filterOptions(searchTerm = '') {
            optionsContainer.innerHTML = '';
            const filtered = positions.filter(p => p.toLowerCase().includes(searchTerm.toLowerCase()));
            
            if (filtered.length === 0) {
                optionsContainer.innerHTML = `<div class="dropdown-option no-results">No positions found</div>`;
                return;
            }

            filtered.forEach(position => {
                const option = document.createElement('div');
                option.className = 'dropdown-option';
                option.textContent = position;
                option.dataset.value = position;
                option.addEventListener('click', () => selectOption(option));
                optionsContainer.appendChild(option);
            });
        }

        function selectOption(option) {
            searchInput.value = option.textContent;
            hiddenInput.value = option.dataset.value;
            dropdown.classList.remove('open');
        }

        // --- BUG FIX 1: Make the entire component clickable ---
        selectedDisplay.addEventListener('click', () => {
            searchInput.focus();
        });

        searchInput.addEventListener('focus', () => {
            dropdown.classList.add('open');
            filterOptions(searchInput.value);
        });

        searchInput.addEventListener('input', () => filterOptions(searchInput.value));
        
        // --- BUG FIX 2: Refined click-away logic ---
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
                // UX Improvement: If user clicks away with invalid text, reset it.
                const currentVal = searchInput.value;
                const hiddenVal = hiddenInput.value;
                if (currentVal && currentVal !== hiddenVal) {
                    searchInput.value = hiddenVal; // Revert to last valid selection
                }
            }
        });

        searchInput.addEventListener('keydown', (e) => {
            if (!dropdown.classList.contains('open')) return;
            const options = Array.from(optionsContainer.querySelectorAll('.dropdown-option:not(.no-results)'));
            if (options.length === 0) return;
            let currentIndex = options.findIndex(opt => opt.classList.contains('is-highlighted'));

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    if (currentIndex > -1) options[currentIndex].classList.remove('is-highlighted');
                    const nextIndex = (currentIndex + 1) % options.length;
                    options[nextIndex].classList.add('is-highlighted');
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (currentIndex > -1) options[currentIndex].classList.remove('is-highlighted');
                    const prevIndex = (currentIndex - 1 + options.length) % options.length;
                    options[prevIndex].classList.add('is-highlighted');
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (currentIndex > -1) selectOption(options[currentIndex]);
                    break;
                case 'Escape':
                    dropdown.classList.remove('open');
                    break;
            }
        });
    }

    // --- Tag Input Functionality ---
    function createTag(label) {
        const tag = document.createElement('div');
        tag.classList.add('tag-item');
        tag.innerHTML = `<span>${label}</span><i class="bi bi-x-lg tag-remove-btn" data-label="${label}"></i>`;
        coursesContainer.insertBefore(tag, coursesInput);
    }
    
    // --- Main Modal Functions ---
    function resetForm() {
        document.getElementById('member-first-name').value = '';
        document.getElementById('member-last-name').value = '';
        document.getElementById('position-search-input').value = '';
        document.getElementById('member-position').value = '';
        document.getElementById('member-contract-type').value = '';
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
    
    // --- Event Listener Setup ---
    if (addMemberBtn) { addMemberBtn.addEventListener('click', openModal); }
    if (modalCloseBtn) { modalCloseBtn.addEventListener('click', closeModal); }
    if (modalCancelBtn) { modalCancelBtn.addEventListener('click', closeModal); }
    if (modalOverlay) { modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); }); }

    if (coursesInput) {
        coursesInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const label = coursesInput.value.trim();
                if (label && !courses.has(label)) {
                    courses.add(label); createTag(label);
                }
                coursesInput.value = '';
            }
        });
    }

    if (coursesContainer) {
        coursesContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('tag-remove-btn')) {
                courses.delete(e.target.dataset.label);
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
                contractType: document.getElementById('member-contract-type').value,
                startDate: document.getElementById('member-start-date').value,
                isKeyHolder: document.getElementById('member-key-holder').checked,
                completedCourses: Array.from(courses)
            };
            
            if (!newMember.firstName || !newMember.lastName || !newMember.position) {
                alert('Please fill in at least the First Name, Last Name, and Position.');
                return;
            }

            console.log('Saving member:', newMember);
            closeModal();
        });
    }
    
    // Initialise components
    setupPositionDropdown();
});
