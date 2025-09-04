document.addEventListener('DOMContentLoaded', () => {
    const backBtn = document.getElementById('back-to-dashboard-btn');
    const editBtn = document.getElementById('edit-team-details-btn');
    const logoutBtn = document.getElementById('dashboard-logout-btn');

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = '/index.html';
        });
    }

    if (editBtn) {
        editBtn.addEventListener('click', () => {
            alert('Edit Team Details functionality will be available soon.');
        });
    }

    if (logoutBtn) {
        // This is a placeholder. The actual logout is handled by Firebase in the main app script.
        logoutBtn.addEventListener('click', () => {
            alert('Logout functionality is handled by the main application script.');
        });
    }
});
