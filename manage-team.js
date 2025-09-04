document.addEventListener('DOMContentLoaded', () => {
    const backToHubBtn = document.getElementById('back-to-hub-btn');
    const logoutBtn = document.getElementById('dashboard-logout-btn');

    if (backToHubBtn) {
        backToHubBtn.addEventListener('click', () => {
            // This assumes the hub is at 'team.html'
            window.location.href = '/team.html';
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
             // In a real app, this would dispatch a global event
             alert('Logout functionality is handled by the main application script.');
             window.location.href = '/index.html';
        });
    }
});
