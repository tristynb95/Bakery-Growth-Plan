import { db, firebase } from './firebase.js';
import { appState } from './state.js';
import { updateViewWithRemoteData, updateUI } from './ui.js';
import { renderCalendar } from './calendar.js';
import { openModal } from './modal.js';

/**
 * Sets up a real-time listener for the current plan document in Firestore.
 * Also loads calendar data and sets up its listener.
 */
export async function setupPlanListener() {
    if (appState.planUnsubscribe) {
        appState.planUnsubscribe();
    }
    if (appState.calendarUnsubscribe) {
        appState.calendarUnsubscribe();
    }

    if (!appState.currentUser || !appState.currentPlanId) {
        appState.planData = {};
        appState.calendar.data = {};
        return;
    }
    const planDocRef = db.collection("users").doc(appState.currentUser.uid).collection("plans").doc(appState.currentPlanId);
    const calendarDocRef = db.collection('users').doc(appState.currentUser.uid).collection('calendar').doc(appState.currentPlanId);
    try {
        const doc = await planDocRef.get();
        if (doc.exists) {
            appState.planData = doc.data();
        } else {
            console.log("No such document on initial load!");
            appState.planData = {};
            handleBackToDashboard(); // This function needs to be imported or passed
        }
    } catch (error) {
        console.error("Error fetching initial plan data:", error);
        handleBackToDashboard(); // This function needs to be imported or passed
    }

    await loadCalendarData();

    appState.planUnsubscribe = planDocRef.onSnapshot((doc) => {
        if (doc.exists) {
            const remoteData = doc.data();
            if (JSON.stringify(remoteData) !== JSON.stringify(appState.planData)) {
                appState.planData = remoteData;
                updateViewWithRemoteData(remoteData);
                updateUI();
            }
        }
    }, (error) => {
        console.error("Error listening to plan changes:", error);
    });

    appState.calendarUnsubscribe = calendarDocRef.onSnapshot((doc) => {
        const remoteCalendarData = doc.exists ? doc.data() : {};
        if (JSON.stringify(remoteCalendarData) !== JSON.stringify(appState.calendar.data)) {
            appState.calendar.data = remoteCalendarData;
            if (!document.getElementById('calendar-modal').classList.contains('hidden')) {
                renderCalendar();
            }
        }
    }, (error) => {
        console.error("Error listening to calendar changes:", error);
    });
}

/**
 * Saves data to the current plan document in Firestore.
 * @param {boolean} [forceImmediate=false] - If true, saves immediately. Otherwise, debounces the save.
 * @param {object|null} [directPayload=null] - A specific payload to save, bypassing DOM scraping.
 * @returns {Promise<void>}
 */
export function saveData(forceImmediate = false, directPayload = null) {
    if (!appState.currentUser || !appState.currentPlanId) return Promise.resolve();

    const localChanges = {};
    const fieldsToDelete = {};

    if (!directPayload) {
        document.querySelectorAll('#app-view input, #app-view [contenteditable="true"]').forEach(el => {
            if (el.id) {
                localChanges[el.id] = el.isContentEditable ? el.innerHTML : el.value;
            }
        });
        document.querySelectorAll('.pillar-buttons').forEach(group => {
            const stepKey = group.dataset.stepKey;
            const dataKey = `${stepKey}_pillar`;
            const selectedButtons = group.querySelectorAll('.selected');
            if (selectedButtons.length > 0) {
                const selectedPillars = Array.from(selectedButtons).map(btn => btn.dataset.pillar).sort();
                localChanges[dataKey] = selectedPillars;
            } else {
                fieldsToDelete[dataKey] = firebase.firestore.FieldValue.delete();
            }
        });
        if (appState.currentView.startsWith('month-')) {
            const monthNum = appState.currentView.split('-')[1];
            document.querySelectorAll('.status-buttons').forEach(group => {
                const week = group.dataset.week;
                const selected = group.querySelector('.selected');
                const key = `m${monthNum}s5_w${week}_status`;
                if (selected) {
                    localChanges[key] = selected.dataset.status;
                } else {
                    fieldsToDelete[key] = firebase.firestore.FieldValue.delete();
                }
            });
        }
    }

    const changedData = {};
    let hasChanges = false;

    if (directPayload) {
         for (const key in directPayload) {
            if (directPayload[key] !== appState.planData[key]) {
                changedData[key] = directPayload[key];
                hasChanges = true;
            }
        }
    } else {
        for (const key in localChanges) {
            if (JSON.stringify(localChanges[key]) !== JSON.stringify(appState.planData[key])) {
                changedData[key] = localChanges[key];
                hasChanges = true;
            }
        }
        for (const key in fieldsToDelete) {
            if (appState.planData[key] !== undefined) {
                changedData[key] = fieldsToDelete[key];
                hasChanges = true;
            }
        }
    }

    if (!hasChanges) {
        return Promise.resolve();
    }

    clearTimeout(appState.saveTimeout);

    const saveToFirestore = async () => {
        const docRef = db.collection("users").doc(appState.currentUser.uid).collection("plans").doc(appState.currentPlanId);
        const dataToSave = {
            ...changedData,
            lastEdited: firebase.firestore.FieldValue.serverTimestamp()
        };
        try {
            await docRef.update(dataToSave);
            const saveIndicator = document.getElementById('save-indicator');
            if (saveIndicator) {
                saveIndicator.classList.remove('opacity-0');
                setTimeout(() => saveIndicator.classList.add('opacity-0'), 2000);
            }
        } catch (error) {
            console.error("Error saving data:", error);
        }
    };

    if (forceImmediate) {
        return saveToFirestore();
    } else {
        return new Promise(resolve => {
            appState.saveTimeout = setTimeout(async () => {
                await saveToFirestore();
                resolve();
            }, 1000);
        });
    }
}

/**
 * Fetches the initial calendar data for the current plan.
 */
export async function loadCalendarData() {
    if (!appState.currentUser || !appState.currentPlanId) return;
    const calendarRef = db.collection('users').doc(appState.currentUser.uid).collection('calendar').doc(appState.currentPlanId);
    try {
        const doc = await calendarRef.get();
        appState.calendar.data = doc.exists ? doc.data() : {};
    } catch (error) {
        console.error("Error loading calendar data:", error);
        appState.calendar.data = {};
    }
}


/**
 * Generates or retrieves a shareable link for the current plan.
 */
export async function handleShare() {
    openModal('sharing');
    try {
        let shareableLink;
        const pointerQuery = db.collection('sharedPlans').where('originalPlanId', '==', appState.currentPlanId);
        const querySnapshot = await pointerQuery.get();
        if (!querySnapshot.empty) {
            const existingPointer = querySnapshot.docs[0];
            shareableLink = `${window.location.origin}/view.html?id=${existingPointer.id}`;
        } else {
            const originalPlanRef = db.collection('users').doc(appState.currentUser.uid).collection('plans').doc(appState.currentPlanId);
            await originalPlanRef.update({ isShared: true });
            const pointerDoc = {
                originalUserId: appState.currentUser.uid,
                originalPlanId: appState.currentPlanId,
                sharedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            const newPointerRef = await db.collection('sharedPlans').add(pointerDoc);
            shareableLink = `${window.location.origin}/view.html?id=${newPointerRef.id}`;
        }
        const modalContent = document.getElementById('modal-content');
        modalContent.innerHTML = `<p class="text-sm text-gray-600 mb-4">This is a live link that will update as you make changes to your plan.</p>
                                  <label for="shareable-link" class="font-semibold block mb-2">Shareable Link:</label>
                                  <div class="flex items-center gap-2">
                                      <input type="text" id="shareable-link" class="form-input" value="${shareableLink}" readonly>
                                      <button id="copy-link-btn" class="btn btn-secondary"><i class="bi bi-clipboard"></i></button>
                                  </div>
                                  <p id="copy-success-msg" class="text-green-600 text-sm mt-2 hidden">Link copied to clipboard!</p>`;
        document.getElementById('copy-link-btn').addEventListener('click', () => {
            const linkInput = document.getElementById('shareable-link');
            linkInput.select();
            document.execCommand('copy');
            document.getElementById('copy-success-msg').classList.remove('hidden');
            setTimeout(() => document.getElementById('copy-success-msg').classList.add('hidden'), 2000);
        });
        const modalActionBtn = document.getElementById('modal-action-btn');
        const modalCancelBtn = document.getElementById('modal-cancel-btn');
        modalActionBtn.style.display = 'none';
        modalCancelBtn.textContent = 'Done';
    } catch (error) {
        console.error("Error creating shareable link:", error);
        const modalContent = document.getElementById('modal-content');
        modalContent.innerHTML = `<p class="text-red-600">Could not create a shareable link. Please try again later.</p>`;
    }
}
