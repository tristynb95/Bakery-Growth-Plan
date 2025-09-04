document.addEventListener('DOMContentLoaded', () => {
    const backBtn = document.getElementById('back-to-dashboard-btn');
    const profileBtn = document.getElementById('profile-btn');
    const logoutBtn = document.getElementById('dashboard-logout-btn');

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = '/index.html';
        });
    }

    if (manageTeamBtn) {
        manageTeamBtn.addEventListener('click', () => {
            window.location.href = '/manage-team.html';
        });
    }

    if (logoutBtn) {
        // In a real single-page app, this would dispatch a global logout event.
        // For this project structure, redirecting is the simplest approach.
        logoutBtn.addEventListener('click', () => {
             alert('Logout functionality is handled by the main application script. For this page, we will redirect you to the login page.');
             window.location.href = '/index.html';
        });
    }
});
