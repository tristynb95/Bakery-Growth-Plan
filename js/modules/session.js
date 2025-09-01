import { appState } from './state.js';
import { handleLogout } from './auth.js';
import { saveData } from './api.js';
import { SESSION_DURATION } from './config.js';

export function resetSessionTimeout() {
    clearTimeout(appState.sessionTimeout);
    localStorage.setItem('lastActivity', new Date().getTime());
    appState.sessionTimeout = setTimeout(async () => {
        if (appState.currentUser) {
            await saveData(true);
            handleLogout(true);
        }
    }, SESSION_DURATION);
}

export function setupActivityListeners() {
    window.addEventListener('mousemove', resetSessionTimeout);
    window.addEventListener('mousedown', resetSessionTimeout);
    window.addEventListener('keypress', resetSessionTimeout);
    window.addEventListener('touchmove', resetSessionTimeout);
    window.addEventListener('scroll', resetSessionTimeout, true);
}

export function clearActivityListeners() {
    window.removeEventListener('mousemove', resetSessionTimeout);
    window.removeEventListener('mousedown', resetSessionTimeout);
    window.removeEventListener('keypress', resetSessionTimeout);
    window.removeEventListener('touchmove', resetSessionTimeout);
    window.removeEventListener('scroll', resetSessionTimeout, true);
    clearTimeout(appState.sessionTimeout);
}
