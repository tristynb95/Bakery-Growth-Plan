document.addEventListener('DOMContentLoaded', () => {
    const profileBtn = document.getElementById('dashboard-profile-btn');
    const logoutBtn = document.getElementById('dashboard-logout-btn');

    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            window.location.href = '/profile.html';
        });
    }

    if (logoutBtn) {
        // This is a placeholder. The actual logout is handled by Firebase in the main app script.
        logoutBtn.addEventListener('click', () => {
            alert('Logout functionality is handled by the main application script.');
        });
    }
});
