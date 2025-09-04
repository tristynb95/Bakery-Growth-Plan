document.addEventListener('DOMContentLoaded', () => {
    const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
    const manageTeamBtn = document.getElementById('manage-team-btn');
    const logoutBtn = document.getElementById('dashboard-logout-btn');

    if (backToDashboardBtn) {
        backToDashboardBtn.addEventListener('click', () => {
            window.location.href = '/index.html';
        });
    }

    if (manageTeamBtn) {
        manageTeamBtn.addEventListener('click', () => {
            window.location.href = '/manage-team.html';
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            // Dispatch a global event that the main.js script will catch
            document.dispatchEvent(new CustomEvent('logout-request'));
        });
    }
});
