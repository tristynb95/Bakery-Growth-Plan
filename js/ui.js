// js/ui.js

import { generateAiActionPlan } from './api.js';
import { parseUkDate } from './calendar.js';

// Dependencies that will be passed in from main.js
let db, appState, saveData;
let activeSaveDataFunction = null; // To hold the saveData function from the current view

// AI Action Plan State
let undoStack = [];
let redoStack = [];

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

function managePlaceholder(editor) {
    if (!editor || !editor.isContentEditable) return;
    if (editor.innerText.trim() === '') {
        editor.classList.add('is-placeholder-showing');
    } else {
        editor.classList.remove('is-placeholder-showing');
    }
}

// --- AI Action Plan Logic (with Undo/Redo) ---
function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if (undoBtn) undoBtn.disabled = undoStack.length <= 1;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

function saveState() {
    const printableArea = document.getElementById('ai-printable-area');
    if (printableArea) {
        undoStack.push(printableArea.innerHTML);
        redoStack = []; // Clear redo stack on new action
        updateUndoRedoButtons();
    }
}

function undo() {
    if (undoStack.length > 1) {
        const currentState = undoStack.pop();
        redoStack.push(currentState);
        const previousState = undoStack[undoStack.length - 1];
        document.getElementById('ai-printable-area').innerHTML = previousState;
        updateUndoRedoButtons();
    }
}

function redo() {
    if (redoStack.length > 0) {
        const nextState = redoStack.pop();
        undoStack.push(nextState);
        document.getElementById('ai-printable-area').innerHTML = nextState;
        updateUndoRedoButtons();
    }
}

function setupAiModalInteractivity(container) {
    if (!container) return;
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
    container.addEventListener('click', (e) => {
        const addBtn = e.target.closest('.btn-add-row');
        const removeBtn = e.target.closest('.btn-remove-row');
        const tab = e.target.closest('.ai-tab-btn');
        const sortHeader = e.target.closest('.sortable-header');
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
            const tabContainer = tab.closest('.ai-action-plan-container');
            tabContainer.querySelectorAll('.ai-tab-btn').forEach(t => t.classList.remove('active'));
            tabContainer.querySelectorAll('.ai-tabs-content > div').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const targetPanel = tabContainer.querySelector(`[data-tab-panel="${tab.dataset.tab}"]`);
            if (targetPanel) targetPanel.classList.add('active');
        }
        if (sortHeader) { handleTableSort(sortHeader); }
    });
    const observer = new MutationObserver((mutations) => {
        if (mutations.some(m => m.type === 'characterData')) { saveState(); }
    });
    observer.observe(container, { childList: false, subtree: true, characterData: true });
}

async function saveActionPlan() {
    const editedContent = document.getElementById('ai-printable-area').innerHTML;
    const saveButton = DOMElements.modalActionBtn;
    const originalHTML = saveButton.innerHTML;
    saveButton.disabled = true;
    saveButton.innerHTML = `<i class="bi bi-check-circle-fill"></i> Saved!`;
    if (activeSaveDataFunction) {
        await activeSaveDataFunction(true, { aiActionPlan: editedContent });
    } else {
        console.error("No active save function to save AI plan!");
    }
    undoStack = [editedContent];
    redoStack = [];
    updateUndoRedoButtons();
    setTimeout(() => {
        saveButton.disabled = false;
        saveButton.innerHTML = originalHTML;
    }, 2000);
}

function handleRegenerateActionPlan() {
    openModal('confirmRegenerate');
}

function requestCloseModal() {
    const modalType = DOMElements.modalBox.dataset.type;
    if (modalType === 'aiActionPlan_generate' && appState.aiPlanGenerationController) {
        appState.aiPlanGenerationController.abort();
    }
    const isAiModal = modalType === 'aiActionPlan_view';
    const hasUnsavedChanges = undoStack.length > 1;
    if (isAiModal && hasUnsavedChanges) {
        openModal('confirmClose');
    } else {
        closeModal();
    }
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
                DOMElements.modalActionBtn.textContent = "Create Plan";
                setTimeout(() => newPlanNameInput.classList.remove('shake'), 500);
                return;
            }
            DOMElements.modalActionBtn.disabled = false;
            DOMElements.modalActionBtn.textContent = "Create Plan";
            closeModal();
            DOMElements.creationLoadingView.classList.remove('hidden');
            try {
                const newPlan = await plansRef.add({
                    planName: newPlanName,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastEdited: firebase.firestore.FieldValue.serverTimestamp(),
                    managerName: ''
                });
                // Instead of calling handleSelectPlan directly, dispatch an event
                document.dispatchEvent(new CustomEvent('plan-selected', { detail: { planId: newPlan.id } }));
            } catch (error) {
                console.error("Error creating new plan:", error);
            } finally {
                DOMElements.creationLoadingView.classList.add('hidden');
            }
            break;
        case 'edit':
            const newName = document.getElementById('editPlanName').value;
            if (newName && newName.trim() !== '') {
                try {
                    await db.collection('users').doc(appState.currentUser.uid).collection('plans').doc(planId).update({ planName: newName });
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
    const savedPlan = appState.planData.aiActionPlan;
    if (savedPlan) {
        openModal('aiActionPlan_view');
        const modalContent = document.getElementById('modal-content');
        modalContent.innerHTML = `<div id="ai-printable-area" class="editable-action-plan">${savedPlan}</div>`;
        undoStack = [];
        redoStack = [];
        saveState();
        setupAiModalInteractivity(modalContent.querySelector('#ai-printable-area'));
    } else {
        if (appState.aiPlanGenerationController) {
            appState.aiPlanGenerationController.abort();
        }
        openModal('aiActionPlan_generate');
        try {
            appState.aiPlanGenerationController = new AbortController();
            const cleanedHTML = await generateAiActionPlan(planSummary, appState.aiPlanGenerationController.signal);
            appState.planData.aiActionPlan = cleanedHTML;
            await saveData(true); // Force save the new AI plan
            handleAIActionPlan(appState, saveData, planSummary); // Recurse to show the plan
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('AI plan generation cancelled.');
                return;
            }
            console.error("Error generating AI plan:", error);
            document.getElementById('modal-content').innerHTML = `<p class="text-red-600 font-semibold">An error occurred.</p><p class="text-gray-600 mt-2 text-sm">${error.message}</p>`;
            DOMElements.modalActionBtn.style.display = 'none';
            DOMElements.modalCancelBtn.textContent = 'Close';
        } finally {
            appState.aiPlanGenerationController = null;
        }
    }
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
    const { planId, currentName, planName } = context;
    DOMElements.modalBox.dataset.type = type;
    DOMElements.modalBox.dataset.planId = planId;
    const footer = DOMElements.modalActionBtn.parentNode;

    // Robust cleanup
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
                                              <div id="modal-error-container" class="modal-error-container"></div>`;
            DOMElements.modalActionBtn.textContent = "Create Plan";
            document.getElementById('newPlanName').addEventListener('keyup', (e) => { if (e.key === 'Enter') handleModalAction(); });
            break;
        case 'edit':
            DOMElements.modalTitle.textContent = "Edit Plan Name";
            DOMElements.modalContent.innerHTML = `<label for="editPlanName" class="font-semibold block mb-2">Plan Name:</label><input type="text" id="editPlanName" class="form-input" value="${currentName}">`;
            DOMElements.modalActionBtn.textContent = "Save Changes";
            document.getElementById('editPlanName').addEventListener('keyup', (e) => { if (e.key === 'Enter') handleModalAction(); });
            break;
        case 'delete':
            DOMElements.modalTitle.textContent = "Confirm Deletion";
            DOMElements.modalContent.innerHTML = `<p>Are you sure you want to permanently delete the plan: <strong class="font-bold">${planName}</strong>?</p><p class="mt-2 text-sm text-red-700 bg-red-100 p-3 rounded-lg">This action is final and cannot be undone.</p>`;
            DOMElements.modalActionBtn.textContent = "Confirm Delete";
            DOMElements.modalActionBtn.className = 'btn btn-primary bg-red-600 hover:bg-red-700';
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
        case 'aiActionPlan_generate':
            DOMElements.modalTitle.textContent = "Generating AI Action Plan";
            DOMElements.modalContent.innerHTML = `<div class="flex flex-col items-center justify-center p-8"><div class="loading-spinner"></div><p class="mt-4 text-gray-600">Please wait, the AI is creating your plan...</p></div>`;
            DOMElements.modalActionBtn.style.display = 'none';
            DOMElements.modalCancelBtn.textContent = 'Cancel';
            break;
        case 'aiActionPlan_view':
            DOMElements.modalTitle.textContent = "Edit Your Action Plan";
            footer.style.justifyContent = 'space-between';
            const undoRedoContainer = document.createElement('div');
            undoRedoContainer.className = 'undo-redo-container dynamic-btn';
            undoRedoContainer.innerHTML = `<button id="undo-btn" class="btn btn-secondary btn-icon" title="Undo"><i class="bi bi-arrow-counterclockwise"></i></button><button id="redo-btn" class="btn btn-secondary btn-icon" title="Redo"><i class="bi bi-arrow-clockwise"></i></button>`;
            footer.insertBefore(undoRedoContainer, footer.firstChild);
            undoRedoContainer.querySelector('#undo-btn').onclick = undo;
            undoRedoContainer.querySelector('#redo-btn').onclick = redo;
            const regenButton = document.createElement('button');
            regenButton.className = 'btn btn-secondary dynamic-btn';
            regenButton.innerHTML = `<i class="bi bi-stars"></i> Generate New`;
            regenButton.onclick = handleRegenerateActionPlan;
            const printBtn = document.createElement('button');
            printBtn.className = 'btn btn-secondary dynamic-btn';
            printBtn.innerHTML = `<i class="bi bi-printer-fill"></i> Print Plan`;
            printBtn.onclick = () => {
                const content = document.getElementById('ai-printable-area').querySelector('.ai-tabs-content > div.active');
                if (!content) { alert("Could not find active month to print."); return; }
                const title = document.querySelector('.ai-tabs-nav .ai-tab-btn.active')?.textContent || 'Action Plan';
                const printNode = content.cloneNode(true);
                printNode.querySelectorAll('.actions-cell, tfoot').forEach(el => el.remove());
                const styles = `@page { size: A4; margin: 25mm; } body { font-family: 'DM Sans', sans-serif; } .print-header { text-align: center; border-bottom: 2px solid #D10A11; padding-bottom: 15px; margin-bottom: 25px; } h1 { font-family: 'Poppins', sans-serif; } h2 { font-family: 'Poppins', sans-serif; color: #D10A11; } table { width: 100%; border-collapse: collapse; font-size: 9pt; } th, td { border: 1px solid #E5E7EB; padding: 10px; text-align: left; } thead { display: table-header-group; }`;
                const win = window.open('', '', 'height=800,width=1200');
                win.document.write(`<html><head><title>${title}</title><style>${styles}</style></head><body>`);
                win.document.write(`<div class="print-header"><h1>${title}</h1><h2>Our Bakery Action Plan</h2><p>${appState.planData.planName} | ${appState.planData.bakeryLocation}</p></div>`);
                win.document.write(printNode.innerHTML);
                win.document.write('</body></html>');
                win.document.close();
                setTimeout(() => win.print(), 500);
            };
            DOMElements.modalActionBtn.textContent = "Save Changes";
            DOMElements.modalActionBtn.onclick = saveActionPlan;
            footer.insertBefore(regenButton, DOMElements.modalActionBtn);
            footer.insertBefore(printBtn, DOMElements.modalActionBtn);
            DOMElements.modalCancelBtn.style.display = 'none';
            updateUndoRedoButtons();
            break;
        case 'confirmRegenerate':
            DOMElements.modalTitle.textContent = "Are you sure?";
            DOMElements.modalContent.innerHTML = `<p>Generating a new plan will overwrite your existing action plan and any edits. This cannot be undone.</p>`;
            DOMElements.modalActionBtn.textContent = "Yes, Generate New";
            DOMElements.modalActionBtn.className = 'btn btn-primary bg-red-600 hover:bg-red-700';
            DOMElements.modalActionBtn.onclick = () => {
                delete appState.planData.aiActionPlan;
                saveData(true).then(() => handleAIActionPlan(appState, saveData, null)); // Summary will be regenerated
            };
            DOMElements.modalCancelBtn.textContent = "Cancel";
            DOMElements.modalCancelBtn.onclick = () => {
                openModal('aiActionPlan_view');
                const lastState = undoStack.length > 0 ? undoStack[undoStack.length - 1] : appState.planData.aiActionPlan || '';
                document.getElementById('modal-content').innerHTML = `<div id="ai-printable-area" class="editable-action-plan">${lastState}</div>`;
                setupAiModalInteractivity(document.getElementById('ai-printable-area'));
            };
            break;
        case 'confirmClose':
            DOMElements.modalTitle.textContent = "Discard Changes?";
            DOMElements.modalContent.innerHTML = `<p>You have unsaved changes. Are you sure you want to close without saving?</p>`;
            DOMElements.modalActionBtn.textContent = "Discard";
            DOMElements.modalActionBtn.className = 'btn btn-primary bg-red-600 hover:bg-red-700';
            DOMElements.modalActionBtn.onclick = () => closeModal();
            DOMElements.modalCancelBtn.textContent = "Cancel";
            DOMElements.modalCancelBtn.onclick = () => {
                openModal('aiActionPlan_view');
                const lastState = undoStack[undoStack.length - 1];
                document.getElementById('modal-content').innerHTML = `<div id="ai-printable-area" class="editable-action-plan">${lastState}</div>`;
                setupAiModalInteractivity(document.getElementById('ai-printable-area'));
                updateUndoRedoButtons();
            };
            break;
    }
    DOMElements.modalOverlay.classList.remove('hidden');
}

export function closeModal() {
    DOMElements.modalOverlay.classList.add('hidden');
}

// --- Main Initializer ---

export function initializeUI(database, state) {
    // Connect to other parts of the app
    db = database;
    appState = state;

    // --- Modal Event Listeners ---
    DOMElements.modalCloseBtn.addEventListener('click', closeModal);
    DOMElements.modalOverlay.addEventListener('mousedown', (e) => {
        if (e.target === DOMElements.modalOverlay) {
            closeModal();
        }
    });
    DOMElements.modalActionBtn.addEventListener('click', handleModalAction);
    DOMElements.modalCancelBtn.addEventListener('click', closeModal);

    // --- Mobile Sidebar & Swipe ---
    DOMElements.mobileMenuBtn.addEventListener('click', () => DOMElements.appView.classList.toggle('sidebar-open'));
    DOMElements.sidebarOverlay.addEventListener('click', () => DOMElements.appView.classList.remove('sidebar-open'));

    // --- Radial Menu ---
    if (DOMElements.radialMenuFab) {
        DOMElements.radialMenuFab.addEventListener('click', () => DOMElements.radialMenuContainer.classList.toggle('open'));
        DOMElements.radialMenuOverlay.addEventListener('click', () => DOMElements.radialMenuContainer.classList.remove('open'));
    }

    // --- Cookie Banner ---
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
}
