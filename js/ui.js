// js/ui.js

import { generateAiActionPlan } from './api.js';
import { parseUkDate } from './calendar.js';

// Dependencies that will be passed in from main.js
let db, appState;
let activeSaveDataFunction = null; // To hold the saveData function from the current view
let currentPlanSummary = ''; // To hold the plan summary for on-demand generation

// AI Action Plan State
let undoHistory = { month1: [], month2: [], month3: [] };
let redoHistory = { month1: [], month2: [], month3: [] };
let debouncedSave = null; // Will hold the debounced save function

// --- DOM Element References ---
const DOMElements = {
    // Modals
    modalOverlay: document.getElementById('modal-overlay'),
    modalBox: document.getElementById('modal-box'),
    modalTitle: document.getElementById('modal-title'),
    modalContent: document.getElementById('modal-content'),
    modalActionBtn: document.getElementById('modal-action-btn'),
    modalCancelBtn: document.getElementById('modal-cancel-btn'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    // File Viewer Modal
    fileModal: document.getElementById('file-view-modal'),
    fileModalBox: document.querySelector('#file-view-modal .modal-box'),
    fileModalTitle: document.getElementById('file-modal-title'),
    fileModalContent: document.getElementById('file-modal-content'),
    fileModalCloseBtn: document.getElementById('file-modal-close-btn'),
    fileModalDownloadBtn: document.getElementById('file-modal-download-btn'),
    fileModalDeleteBtn: document.getElementById('file-modal-delete-btn'),
    // Mobile Sidebar & Menu
    appView: document.getElementById('app-view'),
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    sidebar: document.getElementById('sidebar'),
    mainContent: document.querySelector('#app-view main'),
    // Radial Menu
    radialMenuContainer: document.getElementById('radial-menu-container'),
    radialMenuFab: document.getElementById('radial-menu-fab'),
    radialMenuOverlay: document.getElementById('radial-menu-overlay'),
    // Other UI
    saveIndicator: document.getElementById('save-indicator'),
    creationLoadingView: document.getElementById('creation-loading-view'),
    cookieBanner: document.getElementById('cookie-consent-banner'),
    acceptBtn: document.getElementById('cookie-accept-btn'),
    declineBtn: document.getElementById('cookie-decline-btn'),
};

// --- Private Helper Functions ---

/**
 * A utility function to delay invoking a function until after `wait` milliseconds
 * have elapsed since the last time it was invoked.
 * @param {Function} func The function to debounce.
 * @param {number} wait The number of milliseconds to delay.
 * @returns {Function} The new debounced function.
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}


function managePlaceholder(editor) {
    if (!editor || !editor.isContentEditable) return;
    if (editor.innerText.trim() === '') {
        editor.classList.add('is-placeholder-showing');
    } else {
        editor.classList.remove('is-placeholder-showing');
    }
}

// --- AI Action Plan Logic (with Undo/Redo & Real-Time Saving) ---
function getActiveTabId() {
    const activeTab = document.querySelector('.ai-tab-btn.active');
    return activeTab ? activeTab.dataset.tab : null;
}

function updateUndoRedoButtons() {
    const activeTabId = getActiveTabId();
    if (!activeTabId) return;

    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if (undoBtn) undoBtn.disabled = undoHistory[activeTabId].length <= 1;
    if (redoBtn) redoBtn.disabled = redoHistory[activeTabId].length === 0;
}

function saveState() {
    const activeTabId = getActiveTabId();
    const activePanel = document.querySelector(`.ai-tabs-content > div[data-tab-panel="${activeTabId}"]`);
    if (activePanel) {
        const currentState = activePanel.innerHTML;
        // Prevent pushing duplicate states to the undo stack
        if (undoHistory[activeTabId][undoHistory[activeTabId].length - 1] !== currentState) {
            undoHistory[activeTabId].push(currentState);
            redoHistory[activeTabId] = []; // Clear redo stack for the current tab on new action
            updateUndoRedoButtons();
        }
    }
}

function undo() {
    const activeTabId = getActiveTabId();
    if (undoHistory[activeTabId] && undoHistory[activeTabId].length > 1) {
        const currentState = undoHistory[activeTabId].pop();
        redoHistory[activeTabId].push(currentState);
        const previousState = undoHistory[activeTabId][undoHistory[activeTabId].length - 1];
        const activePanel = document.querySelector(`.ai-tabs-content > div[data-tab-panel="${activeTabId}"]`);
        if (activePanel) {
            activePanel.innerHTML = previousState;
        }
        updateUndoRedoButtons();
        debouncedSave(); // Trigger save after undo
    }
}

function redo() {
    const activeTabId = getActiveTabId();
    if (redoHistory[activeTabId] && redoHistory[activeTabId].length > 0) {
        const nextState = redoHistory[activeTabId].pop();
        undoHistory[activeTabId].push(nextState);
        const activePanel = document.querySelector(`.ai-tabs-content > div[data-tab-panel="${activeTabId}"]`);
        if (activePanel) {
            activePanel.innerHTML = nextState;
        }
        updateUndoRedoButtons();
        debouncedSave(); // Trigger save after redo
    }
}

function setupAiModalInteractivity(container) {
    if (!container) return;

    debouncedSave = debounce(() => saveActionPlan(false), 1000);

    const makeTablesSortable = (container) => {
        const tables = container.querySelectorAll('table');
        tables.forEach(table => {
            const headers = table.querySelectorAll('thead th');
            const sortableColumns = { 'Action Step': { index: 0, type: 'text' }, 'Pillar': { index: 1, type: 'text' }, 'Owner': { index: 2, type: 'text' }, 'Due Date': { index: 3, type: 'date' }, 'Status': { index: 5, type: 'text' } };
            headers.forEach((th) => {
                const headerText = th.innerText.trim();
                if (sortableColumns[headerText]) {
                    const config = sortableColumns[headerText];
                    th.classList.add('sortable-header');
                    th.dataset.column = config.index;
                    th.dataset.sortType = config.type;
                    th.innerHTML = '';
                    const wrapper = document.createElement('div');
                    wrapper.className = 'header-flex-wrapper';
                    const textSpan = document.createElement('span');
                    textSpan.textContent = headerText;
                    const iconSpan = document.createElement('span');
                    iconSpan.className = 'sort-icon';
                    wrapper.appendChild(textSpan);
                    wrapper.appendChild(iconSpan);
                    th.appendChild(wrapper);
                }
            });
        });
    };
    makeTablesSortable(container);
    const handleTableSort = (header) => {
        const table = header.closest('table');
        const tbody = table.querySelector('tbody');
        const columnIndex = parseInt(header.dataset.column, 10);
        const sortType = header.dataset.sortType || 'text';
        const currentDirection = header.dataset.sortDir || 'desc';
        const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
        table.querySelectorAll('.sortable-header').forEach(th => { th.removeAttribute('data-sort-dir'); });
        header.dataset.sortDir = newDirection;
        const rows = Array.from(tbody.querySelectorAll('tr'));
        rows.sort((rowA, rowB) => {
            const cellA = rowA.querySelectorAll('td')[columnIndex];
            const cellB = rowB.querySelectorAll('td')[columnIndex];
            const valA = cellA ? cellA.innerText.trim() : '';
            const valB = cellB ? cellB.innerText.trim() : '';
            let compareResult = 0;
            if (sortType === 'date') {
                const dateA = parseUkDate(valA);
                const dateB = parseUkDate(valB);
                if (dateA && dateB) { compareResult = dateA.getTime() - dateB.getTime(); }
                else if (dateA && !dateB) { compareResult = -1; }
                else if (!dateA && dateB) { compareResult = 1; }
                else { compareResult = 0; }
            } else {
                compareResult = valA.localeCompare(valB, undefined, { numeric: true });
            }
            return newDirection === 'asc' ? compareResult : -compareResult;
        });
        tbody.innerHTML = '';
        rows.forEach(row => tbody.appendChild(row));
        saveState();
    };
    container.addEventListener('click', async (e) => {
        const addBtn = e.target.closest('.btn-add-row');
        const removeBtn = e.target.closest('.btn-remove-row');
        const tab = e.target.closest('.ai-tab-btn');
        const sortHeader = e.target.closest('.sortable-header');
        const generateBtn = e.target.closest('.generate-month-plan-btn');

        if (addBtn) {
            const tableBody = addBtn.closest('table').querySelector('tbody');
            if (tableBody) {
                const newRow = document.createElement('tr');
                newRow.innerHTML = `<td contenteditable="true"></td><td contenteditable="true"></td><td contenteditable="true"></td><td contenteditable="true"></td><td contenteditable="true"></td><td contenteditable="true"></td><td class="actions-cell"><button class="btn-remove-row"><i class="bi bi-trash3"></i></button></td>`;
                tableBody.appendChild(newRow);
                saveState();
            }
        }
        if (removeBtn) { removeBtn.closest('tr').remove(); saveState(); }
        if (tab) {
            if (tab.classList.contains('active')) return;
            const tabContainer = tab.closest('.ai-action-plan-container, .modal-header-main');
            tabContainer.querySelectorAll('.ai-tab-btn').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const contentContainer = container.querySelector('.ai-tabs-content');
            contentContainer.querySelectorAll(':scope > div').forEach(p => p.classList.remove('active'));
            const targetPanel = contentContainer.querySelector(`[data-tab-panel="${tab.dataset.tab}"]`);
            if (targetPanel) targetPanel.classList.add('active');
            updateUndoRedoButtons(); // Update buttons on tab switch
        }
        if (sortHeader) { handleTableSort(sortHeader); }

        if (generateBtn) {
            const month = generateBtn.dataset.month;
            const panel = container.querySelector(`[data-tab-panel="month${month}"]`);
            panel.innerHTML = `<div class="flex flex-col items-center justify-center p-8"><div class="loading-spinner"></div><p class="mt-4 text-gray-600">Generating plan for Month ${month}...</p></div>`;
            
            try {
                if (appState.aiPlanGenerationController) {
                    appState.aiPlanGenerationController.abort();
                }
                appState.aiPlanGenerationController = new AbortController();
                const signal = appState.aiPlanGenerationController.signal;

                const monthTableHTML = await generateAiActionPlan(currentPlanSummary, signal, month);

                panel.innerHTML = monthTableHTML;
                makeTablesSortable(panel); // Ensure the new table is sortable
                
                // Instantly save the newly generated plan
                await saveActionPlan(true); 

                // Now that it's saved, show the footer buttons
                const footer = document.querySelector('#modal-box .modal-footer');
                const regenButton = footer.querySelector('.dynamic-btn[onclick*="handleRegenerateActionPlan"]');
                const printButton = footer.querySelector('.dynamic-btn[onclick*="print"]');
                if(regenButton) regenButton.style.display = 'inline-flex';
                if(printButton) printButton.style.display = 'inline-flex';


            } catch (error) {
                if (error.name === 'AbortError') {
                    console.log(`Month ${month} plan generation cancelled.`);
                    // Optional: Restore the 'Generate' button if desired
                    panel.innerHTML = `
                        <div class="text-center p-8 flex flex-col items-center justify-center min-h-[300px]">
                            <h3 class="font-bold text-lg text-gray-700">Generation Cancelled</h3>
                            <button class="btn btn-primary generate-month-plan-btn mt-4" data-month="${month}">
                                <i class="bi bi-stars"></i>
                                <span>Generate Month ${month} Plan</span>
                            </button>
                        </div>`;
                    return;
                }
                console.error("Error generating AI plan for month:", error);
                panel.innerHTML = `<div class="text-center p-8 text-red-600"><p class="font-semibold">Generation Failed</p><p class="text-sm">${error.message}</p></div>`;
            } finally {
                appState.aiPlanGenerationController = null;
            }
        }
    });
    const observer = new MutationObserver((mutations) => {
        if (mutations.some(m => m.type === 'characterData' || m.type === 'childList')) {
            saveState();
            debouncedSave();
        }
    });
    observer.observe(container, { childList: true, subtree: true, characterData: true });
}

async function saveActionPlan(forceImmediate = false) {
    const payload = {};
    for (let i = 1; i <= 3; i++) {
        const panel = document.querySelector(`#ai-printable-area [data-tab-panel="month${i}"]`);
        if (panel && panel.querySelector('table')) {
            payload[`aiActionPlanMonth${i}`] = panel.innerHTML;
        } else {
            if(appState.planData[`aiActionPlanMonth${i}`]) {
               payload[`aiActionPlanMonth${i}`] = firebase.firestore.FieldValue.delete();
            }
        }
    }

    if (activeSaveDataFunction && Object.keys(payload).length > 0) {
        await activeSaveDataFunction(forceImmediate, payload);
    }
}


function handleRegenerateActionPlan() {
    openModal('confirmRegenerate');
}

function requestCloseModal() {
    const modalType = DOMElements.modalBox.dataset.type;
    if (modalType === 'aiActionPlan_generate' && appState.aiPlanGenerationController) {
        appState.aiPlanGenerationController.abort();
    }
    // Since we save automatically, we don't need to check for unsaved changes.
    closeModal();
}

async function handleModalAction() {
    const type = DOMElements.modalBox.dataset.type;
    const planId = DOMElements.modalBox.dataset.planId;
    if (type === 'timeout') {
        closeModal();
        return;
    }
    switch (type) {
        case 'create':
            const newPlanNameInput = document.getElementById('newPlanName');
            const newPlanName = newPlanNameInput.value.trim();
            const newPlanQuarter = document.getElementById('newPlanQuarter').value.trim();
            const originalButtonText = DOMElements.modalActionBtn.textContent;
            const errorContainer = document.getElementById('modal-error-container');
            if(errorContainer) errorContainer.innerHTML = '';
            newPlanNameInput.classList.remove('input-error');
            if (!newPlanName) {
                newPlanNameInput.classList.add('input-error', 'shake');
                setTimeout(() => newPlanNameInput.classList.remove('shake'), 500);
                return;
            }
            DOMElements.modalActionBtn.disabled = true;
            DOMElements.modalActionBtn.textContent = 'Checking...';
            const plansRef = db.collection('users').doc(appState.currentUser.uid).collection('plans');
            const nameQuery = await plansRef.where('planName', '==', newPlanName).get();
            if (!nameQuery.empty) {
                newPlanNameInput.classList.add('input-error', 'shake');
                if(errorContainer) {
                   errorContainer.innerHTML = `<p class="auth-error" style="display:block; margin: 0; width: 100%;">A plan with this name already exists.</p>`;
                }
                DOMElements.modalActionBtn.disabled = false;
                DOMElements.modalActionBtn.textContent = originalButtonText;
                setTimeout(() => newPlanNameInput.classList.remove('shake'), 500);
                return;
            }
            DOMElements.modalActionBtn.disabled = false;
            DOMElements.modalActionBtn.textContent = originalButtonText;
            closeModal();
            DOMElements.creationLoadingView.classList.remove('hidden');
            try {
                const userDocRef = db.collection('users').doc(appState.currentUser.uid);
                const userDoc = await userDocRef.get();
                const userData = userDoc.exists ? userDoc.data() : { name: '', bakery: '' };

                const newPlan = await plansRef.add({
                    planName: newPlanName,
                    quarter: newPlanQuarter,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastEdited: firebase.firestore.FieldValue.serverTimestamp(),
                    managerName: userData.name, 
                    bakeryLocation: userData.bakery
                });
                document.dispatchEvent(new CustomEvent('plan-selected', { detail: { planId: newPlan.id } }));
            } catch (error) {
                console.error("Error creating new plan:", error);
            } finally {
                DOMElements.creationLoadingView.classList.add('hidden');
            }
            break;
        case 'edit':
            const newName = document.getElementById('editPlanName').value.trim();
            const newQuarter = document.getElementById('editPlanQuarter').value.trim();
            if (newName) {
                try {
                    await db.collection('users').doc(appState.currentUser.uid).collection('plans').doc(planId).update({ 
                        planName: newName,
                        quarter: newQuarter
                    });
                    document.dispatchEvent(new CustomEvent('rerender-dashboard'));
                } catch (error) { console.error("Error updating plan name:", error); }
            }
            closeModal();
            break;
        case 'delete':
            try {
                await db.collection('users').doc(appState.currentUser.uid).collection('plans').doc(planId).delete();
                document.dispatchEvent(new CustomEvent('rerender-dashboard'));
            } catch (error) { console.error("Error deleting plan:", error); }
            closeModal();
            break;
        case 'confirmDeleteEvent':
            document.dispatchEvent(new CustomEvent('event-deletion-confirmed'));
            closeModal();
            break;
        case 'confirmDeleteConversation':
            document.dispatchEvent(new CustomEvent('conversation-deletion-confirmed', {
                detail: { conversationId: planId }
            }));
            closeModal();
            break;
        case 'confirmDeleteFile':
            document.dispatchEvent(new CustomEvent('file-deletion-confirmed', {
                detail: { fileId: planId }
            }));
            closeModal();
            break;
    }
}

// --- Public (Exported) Functions ---

export async function handleShare(db, appState) {
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
        modalContent.innerHTML = `<p class="text-sm text-gray-600 mb-4">This link reflects the live plan and updates automatically.</p>
                                  <label for="shareable-link" class="font-semibold block mb-2">Shareable Link:</label>
                                  <div class="flex items-center gap-2">
                                      <input type="text" id="shareable-link" class="form-input" value="${shareableLink}" readonly>
                                      <button id="copy-link-btn" class="btn btn-secondary"><i class="bi bi-clipboard"></i></button>
                                  </div>
                                  <p id="copy-success-msg" class="text-green-600 text-sm mt-2 hidden">Link copied!</p>`;
        document.getElementById('copy-link-btn').addEventListener('click', () => {
            document.getElementById('shareable-link').select();
            document.execCommand('copy');
            document.getElementById('copy-success-msg').classList.remove('hidden');
            setTimeout(() => document.getElementById('copy-success-msg').classList.add('hidden'), 2000);
        });
        DOMElements.modalActionBtn.style.display = 'none';
        DOMElements.modalCancelBtn.textContent = 'Done';
    } catch (error) {
        console.error("Error creating shareable link:", error);
        document.getElementById('modal-content').innerHTML = `<p class="text-red-600">Could not create a shareable link. Please try again.</p>`;
    }
}

export async function handleAIActionPlan(appState, saveDataFn, planSummary) {
    activeSaveDataFunction = saveDataFn;
    currentPlanSummary = planSummary; // Store the summary for later use
    openModal('aiActionPlan_view');
}

export function initializeCharCounters() {
    document.querySelectorAll('div[data-maxlength]').forEach(editor => {
        if (editor.parentNode.classList.contains('textarea-wrapper')) {
            return; // Already initialized
        }
        const newWrapper = document.createElement('div');
        newWrapper.className = 'textarea-wrapper';
        editor.parentNode.insertBefore(newWrapper, editor);
        newWrapper.appendChild(editor);

        const newCounter = document.createElement('div');
        newCounter.className = 'char-counter';
        newWrapper.appendChild(newCounter);

        const updateCounter = () => {
            const maxLength = parseInt(editor.dataset.maxlength, 10);
            const currentLength = editor.innerText.length;
            const remaining = maxLength - currentLength;
            newCounter.textContent = `${remaining}`;
            newCounter.style.color = remaining < 0 ? 'var(--gails-red)' : (remaining < 20 ? '#D97706' : 'var(--gails-text-secondary)');
        };
        updateCounter();
        editor.addEventListener('input', updateCounter);
        editor.addEventListener('focus', () => newCounter.classList.add('visible'));
        editor.addEventListener('blur', () => newCounter.classList.remove('visible'));
        editor.addEventListener('input', () => managePlaceholder(editor));
    });
}

export function openModal(type, context = {}) {
    const { planId, currentName, planName, eventTitle, currentQuarter, fileName } = context;

    // --- HEADER RESET ---
    const modalHeader = DOMElements.modalBox.querySelector('.modal-header');
    if (modalHeader.querySelector('.modal-header-main')) {
        modalHeader.innerHTML = `
            <h3 id="modal-title" class="text-lg font-bold">Modal Title</h3>
            <button id="modal-close-btn" class="btn btn-secondary btn-icon"><i class="bi bi-x-lg"></i></button>
        `;
        modalHeader.querySelector('#modal-close-btn').addEventListener('click', requestCloseModal);
        DOMElements.modalTitle = document.getElementById('modal-title');
    }
    // --- END HEADER RESET ---

    DOMElements.modalBox.dataset.type = type;
    DOMElements.modalBox.dataset.planId = planId;
    const footer = DOMElements.modalActionBtn.parentNode;

    footer.querySelectorAll('.dynamic-btn').forEach(btn => btn.remove());
    DOMElements.modalActionBtn.style.display = 'inline-flex';
    DOMElements.modalCancelBtn.style.display = 'inline-flex';
    DOMElements.modalActionBtn.className = 'btn btn-primary';
    DOMElements.modalCancelBtn.className = 'btn btn-secondary';
    DOMElements.modalActionBtn.textContent = 'Action';
    DOMElements.modalCancelBtn.textContent = 'Cancel';
    DOMElements.modalActionBtn.disabled = false;
    DOMElements.modalCancelBtn.disabled = false;
    DOMElements.modalActionBtn.onclick = handleModalAction;
    DOMElements.modalCancelBtn.onclick = requestCloseModal;
    footer.style.justifyContent = 'flex-end';

    switch (type) {
        case 'create':
            DOMElements.modalTitle.textContent = "Create New Plan";
            DOMElements.modalContent.innerHTML = `<label for="newPlanName" class="font-semibold block mb-2">Plan Name:</label>
                                                  <input type="text" id="newPlanName" class="form-input" placeholder="e.g., Q4 2025 Focus" value="New Plan ${new Date().toLocaleDateString('en-GB')}">
                                                  <label for="newPlanQuarter" class="font-semibold block mb-2 mt-4">Quarter:</label>
                                                  <input type="text" id="newPlanQuarter" class="form-input" placeholder="e.g., Q3 FY26">
                                                  <div id="modal-error-container" class="modal-error-container"></div>`;
            DOMElements.modalActionBtn.textContent = "Create Plan";
            document.getElementById('newPlanName').addEventListener('keyup', (e) => { if (e.key === 'Enter') handleModalAction(); });
            break;
        case 'edit':
            DOMElements.modalTitle.textContent = "Edit Plan Details";
            DOMElements.modalContent.innerHTML = `<label for="editPlanName" class="font-semibold block mb-2">Plan Name:</label>
                                                  <input type="text" id="editPlanName" class="form-input" value="${currentName}">
                                                  <label for="editPlanQuarter" class="font-semibold block mb-2 mt-4">Quarter:</label>
                                                  <input type="text" id="editPlanQuarter" class="form-input" placeholder="e.g., Q3 FY26" value="${currentQuarter || ''}">`;
            DOMElements.modalActionBtn.textContent = "Save Changes";
            document.getElementById('editPlanName').addEventListener('keyup', (e) => { if (e.key === 'Enter') handleModalAction(); });
            break;
        case 'delete':
            DOMElements.modalTitle.textContent = "Confirm Deletion";
            DOMElements.modalContent.innerHTML = `<p>Are you sure you want to permanently delete the plan: <strong class="font-bold">${planName}</strong>?</p><p class="mt-2 text-sm text-red-700 bg-red-100 p-3 rounded-lg">This action is final and cannot be undone.</p>`;
            DOMElements.modalActionBtn.textContent = "Confirm Delete";
            DOMElements.modalActionBtn.className = 'btn btn-danger';
            break;
        case 'confirmDeleteFile':
            DOMElements.modalTitle.textContent = "Confirm Deletion";
            DOMElements.modalContent.innerHTML = `<p>Are you sure you want to permanently delete the file: <strong class="font-bold">${fileName}</strong>?</p><p class="mt-2 text-sm text-red-700 bg-red-100 p-3 rounded-lg">This action cannot be undone.</p>`;
            DOMElements.modalActionBtn.textContent = "Confirm Delete";
            DOMElements.modalActionBtn.className = 'btn btn-danger';
            break;
        case 'confirmDeleteConversation':
            DOMElements.modalTitle.textContent = "Confirm Deletion";
            DOMElements.modalContent.innerHTML = `<p>Are you sure you want to permanently delete this conversation and all of its messages?</p><p class="mt-2 text-sm text-red-700 bg-red-100 p-3 rounded-lg">This action cannot be undone.</p>`;
            DOMElements.modalActionBtn.textContent = "Yes, Delete Conversation";
            DOMElements.modalActionBtn.className = 'btn btn-danger';
            DOMElements.modalCancelBtn.textContent = "Cancel";
            break;
        case 'timeout':
            DOMElements.modalTitle.textContent = "Session Ended";
            DOMElements.modalContent.innerHTML = `<p>Your work has been saved automatically. For your security, please sign in to continue.</p>`;
            DOMElements.modalActionBtn.textContent = "Continue";
            DOMElements.modalCancelBtn.style.display = 'none';
            DOMElements.modalActionBtn.onclick = closeModal;
            break;
        case 'sharing':
            DOMElements.modalTitle.textContent = "Share Your Plan";
            DOMElements.modalContent.innerHTML = `<div class="flex items-center justify-center p-8"><div class="loading-spinner"></div><p class="ml-4 text-gray-600">Generating secure link...</p></div>`;
            DOMElements.modalActionBtn.style.display = 'none';
            DOMElements.modalCancelBtn.textContent = 'Cancel';
            break;
        case 'aiActionPlan_generate': // This case is now a fallback, but kept for clarity.
            DOMElements.modalTitle.textContent = "Generating AI Action Plan";
            DOMElements.modalContent.innerHTML = `<div class="flex flex-col items-center justify-center p-8"><div class="loading-spinner"></div><p class="mt-4 text-gray-600">Please wait, the AI is creating your plan...</p></div>`;
            DOMElements.modalActionBtn.style.display = 'none';
            DOMElements.modalCancelBtn.textContent = 'Cancel';
            break;
        case 'aiActionPlan_view': {
            // 1. Rebuild the header with tabs
            const modalHeader = DOMElements.modalBox.querySelector('.modal-header');
            modalHeader.innerHTML = `
                <div class="modal-header-main">
                    <h3 id="modal-title" class="text-lg font-bold">AI Action Plan</h3>
                    <nav class="ai-tabs-nav header-tabs">
                        <button class="btn btn-secondary ai-tab-btn active" data-tab="month1">Month 1</button>
                        <button class="btn btn-secondary ai-tab-btn" data-tab="month2">Month 2</button>
                        <button class="btn btn-secondary ai-tab-btn" data-tab="month3">Month 3</button>
                    </nav>
                </div>
                <button id="modal-close-btn" class="btn btn-secondary btn-icon"><i class="bi bi-x-lg"></i></button>
            `;
            modalHeader.querySelector('#modal-close-btn').addEventListener('click', requestCloseModal);

            // 2. Setup the modal footer
            footer.style.justifyContent = 'space-between';
            const undoRedoContainer = document.createElement('div');
            undoRedoContainer.className = 'undo-redo-container dynamic-btn';
            undoRedoContainer.innerHTML = `<button id="undo-btn" class="btn btn-secondary btn-icon" title="Undo"><i class="bi bi-arrow-counterclockwise"></i></button><button id="redo-btn" class="btn btn-secondary btn-icon" title="Redo"><i class="bi bi-arrow-clockwise"></i></button>`;
            footer.insertBefore(undoRedoContainer, footer.firstChild);
            undoRedoContainer.querySelector('#undo-btn').onclick = undo;
            undoRedoContainer.querySelector('#redo-btn').onclick = redo;
            
            const rightButtonsContainer = document.createElement('div');
            rightButtonsContainer.className = 'flex items-center gap-2 dynamic-btn';

            const printBtn = document.createElement('button');
            printBtn.className = 'btn btn-secondary dynamic-btn';
            printBtn.innerHTML = `<i class="bi bi-printer-fill"></i> Print Plan`;
            printBtn.onclick = () => {
                const content = DOMElements.modalContent.querySelector('.ai-tabs-content > div.active');
                if (!content || !content.querySelector('table')) { alert("No plan to print for this month."); return; }
                const title = modalHeader.querySelector('.ai-tabs-nav .ai-tab-btn.active')?.textContent || 'Action Plan';
                const printNode = content.cloneNode(true);
                printNode.querySelectorAll('.actions-cell, tfoot').forEach(el => el.remove());
                const styles = `@page { size: A4; margin: 25mm; } body { font-family: 'DM Sans', sans-serif; } .print-header { text-align: center; border-bottom: 2px solid #D10A11; padding-bottom: 15px; margin-bottom: 25px; } h1 { font-family: 'Poppins', sans-serif; } h2 { font-family: 'Poppins', sans-serif; color: #D10A11; } table { width: 100%; border-collapse: collapse; font-size: 9pt; } th, td { border: 1px solid #E5E7EB; padding: 10px; text-align: left; } thead { display: table-header-group; }`;
                const win = window.open('', '', 'height=800,width=1200');
                win.document.write(`<html><head><title>${title}</title><style>${styles}</style></head><body>`);
                win.document.write(`<div class="print-header"><h1>${title}</h1><h2>Our Bakery Action Plan</h2><p>${appState.planData.planName} | ${appState.planData.bakeryLocation}</p></div>`);
                win.document.write(printNode.innerHTML);
                win.document.write('</body></html>');
                setTimeout(() => win.print(), 500);
            };

            const regenButton = document.createElement('button');
            regenButton.className = 'btn btn-secondary dynamic-btn';
            regenButton.innerHTML = `<i class="bi bi-stars"></i> Generate New`;
            regenButton.onclick = handleRegenerateActionPlan;

            rightButtonsContainer.appendChild(regenButton);
            rightButtonsContainer.appendChild(printBtn);
            footer.appendChild(rightButtonsContainer);

            DOMElements.modalActionBtn.style.display = 'none';
            DOMElements.modalCancelBtn.textContent = 'Done';

            // 3. Setup the modal content (panels without nav)
            const modalContentHTML = `
                <div id="ai-printable-area" class="editable-action-plan">
                    <div class="ai-action-plan-container">
                        <div class="ai-tabs-content">
                            <div class="active" data-tab-panel="month1"></div>
                            <div data-tab-panel="month2"></div>
                            <div data-tab-panel="month3"></div>
                        </div>
                    </div>
                </div>`;
            DOMElements.modalContent.innerHTML = modalContentHTML;
            
            // 4. Populate the panels
            for (let i = 1; i <= 3; i++) {
                const panel = DOMElements.modalContent.querySelector(`[data-tab-panel="month${i}"]`);
                const monthPlanHTML = appState.planData[`aiActionPlanMonth${i}`];
                if (monthPlanHTML) {
                    panel.innerHTML = monthPlanHTML;
                } else {
                    panel.innerHTML = `
                        <div class="text-center p-8 flex flex-col items-center justify-center min-h-[300px]">
                            <i class="bi bi-robot text-4xl text-gray-300 mb-4"></i>
                            <h3 class="font-bold text-lg text-gray-700">Action Plan for Month ${i}</h3>
                            <p class="text-gray-500 my-2 max-w-sm">Generate a tactical action plan using AI based on your goals for this month.</p>
                            <button class="btn btn-primary generate-month-plan-btn mt-4" data-month="${i}">
                                <i class="bi bi-stars"></i>
                                <span>Generate Month ${i} Plan</span>
                            </button>
                        </div>`;
                }
            }
            
            // 5. Setup interactivity and initialize history
            undoHistory = { month1: [], month2: [], month3: [] };
            redoHistory = { month1: [], month2: [], month3: [] };
            for (let i = 1; i <= 3; i++) {
                const panel = DOMElements.modalContent.querySelector(`[data-tab-panel="month${i}"]`);
                if (panel) {
                    undoHistory[`month${i}`].push(panel.innerHTML);
                }
            }
            // Add interactivity to BOTH header and content
            setupAiModalInteractivity(DOMElements.modalBox); 
            updateUndoRedoButtons();

            // New logic to control the visibility of all footer buttons
            const updateFooterButtonVisibility = () => {
                const anyPanelHasPlan = !!DOMElements.modalContent.querySelector('.ai-tabs-content table');
                const activePanelHasPlan = !!DOMElements.modalContent.querySelector('.ai-tabs-content > div.active table');

                if (regenButton) {
                    regenButton.style.display = activePanelHasPlan ? 'inline-flex' : 'none';
                }
                if (printBtn) {
                    printBtn.style.display = anyPanelHasPlan ? 'inline-flex' : 'none';
                }
            };

            DOMElements.modalBox.addEventListener('click', (e) => {
                if (e.target.closest('.ai-tab-btn') || e.target.closest('.generate-month-plan-btn')) {
                    setTimeout(updateFooterButtonVisibility, 50);
                }
            });

            updateFooterButtonVisibility();
            break;
        }
        case 'confirmRegenerate': {
            const activeTabId = getActiveTabId();
            const monthNum = activeTabId ? activeTabId.replace('month', '') : '';
            
            DOMElements.modalTitle.textContent = "Confirm Regeneration";
            DOMElements.modalContent.innerHTML = `<p>Are you sure you want to generate a new plan for <strong>Month ${monthNum}</strong>? This will overwrite the current Month ${monthNum} plan and any edits you've made. This action cannot be undone.</p>`;
            DOMElements.modalActionBtn.textContent = "Yes, Generate New Plan";
            DOMElements.modalActionBtn.className = 'btn btn-danger';
            
            DOMElements.modalActionBtn.onclick = () => {
                closeModal(); // Close the confirmation modal
                // Re-open the main modal and simulate the generate click
                openModal('aiActionPlan_view'); 
                // Use a timeout to ensure the DOM is ready
                setTimeout(() => {
                    const generateBtn = document.querySelector(`.generate-month-plan-btn[data-month="${monthNum}"]`);
                    if (generateBtn) {
                        generateBtn.click();
                    } else {
                        // This case handles if the user wants to regenerate an *existing* plan
                        const panel = document.querySelector(`[data-tab-panel="${activeTabId}"]`);
                        if(panel){
                            const tempBtn = document.createElement('button');
                            tempBtn.className = 'generate-month-plan-btn';
                            tempBtn.dataset.month = monthNum;
                            panel.innerHTML = '';
                            panel.appendChild(tempBtn);
                            tempBtn.click();
                        }
                    }
                }, 50);
            };
            
            DOMElements.modalCancelBtn.textContent = "Cancel";
            DOMElements.modalCancelBtn.onclick = () => {
                closeModal();
                openModal('aiActionPlan_view');
            };
            break;
        }
        case 'confirmClose':
             // This case is no longer needed with real-time saving.
            closeModal();
            break;
        case 'confirmDeleteEvent':
            DOMElements.modalTitle.textContent = "Confirm Deletion";
            DOMElements.modalContent.innerHTML = `<p>Are you sure you want to permanently delete the event: <strong class="font-bold">${eventTitle}</strong>?</p><p class="mt-2 text-sm text-red-700 bg-red-100 p-3 rounded-lg">This action cannot be undone.</p>`;
            DOMElements.modalActionBtn.textContent = "Confirm Delete";
            DOMElements.modalActionBtn.className = 'btn btn-danger';
            break;
    }
    DOMElements.modalOverlay.classList.remove('hidden');
}

export function closeModal() {
    DOMElements.modalOverlay.classList.add('hidden');
}

// --- Main Initializer ---

export function initializeUI(database, state) {
    db = database;
    appState = state;

    if (!DOMElements.modalCloseBtn || !DOMElements.mobileMenuBtn) {
        return;
    }

    DOMElements.modalCloseBtn.addEventListener('click', requestCloseModal);
    DOMElements.modalOverlay.addEventListener('mousedown', (e) => {
        if (e.target === DOMElements.modalOverlay) {
            requestCloseModal();
        }
    });

    DOMElements.mobileMenuBtn.addEventListener('click', () => DOMElements.appView.classList.toggle('sidebar-open'));
    DOMElements.sidebarOverlay.addEventListener('click', () => DOMElements.appView.classList.remove('sidebar-open'));

    let touchStartX = 0;
    const swipeThreshold = 50; 

    DOMElements.mainContent.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    DOMElements.mainContent.addEventListener('touchend', e => {
        const touchEndX = e.changedTouches[0].screenX;
        if (touchEndX > touchStartX + swipeThreshold) {
            DOMElements.appView.classList.add('sidebar-open');
        }
    });

    DOMElements.sidebar.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    DOMElements.sidebar.addEventListener('touchend', e => {
        const touchEndX = e.changedTouches[0].screenX;
        if (touchEndX < touchStartX - swipeThreshold) {
            DOMElements.appView.classList.remove('sidebar-open');
        }
    });

    if (DOMElements.radialMenuFab) {
        DOMElements.radialMenuFab.addEventListener('click', () => DOMElements.radialMenuContainer.classList.toggle('open'));
        DOMElements.radialMenuOverlay.addEventListener('click', () => DOMElements.radialMenuContainer.classList.remove('open'));
    }

    if (localStorage.getItem('gails_cookie_consent') === null) {
        DOMElements.cookieBanner.classList.remove('hidden');
    }
    DOMElements.acceptBtn.addEventListener('click', () => {
        localStorage.setItem('gails_cookie_consent', 'true');
        DOMElements.cookieBanner.classList.add('hidden');
    });
    DOMElements.declineBtn.addEventListener('click', () => {
        localStorage.setItem('gails_cookie_consent', 'false');
        DOMElements.cookieBanner.classList.add('hidden');
    });

    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('input', () => {
            chatInput.style.height = 'auto';
            chatInput.style.height = `${chatInput.scrollHeight}px`;
        });
    }

    // --- NEW: Event Listeners for File Viewer Modal ---
    if (DOMElements.fileModal) {
        DOMElements.fileModalCloseBtn.addEventListener('click', () => {
            DOMElements.fileModal.classList.add('hidden');
        });

        DOMElements.fileModal.addEventListener('click', (e) => {
            if (e.target === DOMElements.fileModal) {
                DOMElements.fileModal.classList.add('hidden');
            }
        });
    }
}