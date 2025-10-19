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

/**
 * NEW: Helper function to get the data-tab ID of the currently active month tab.
 * @returns {string|null} The active tab ID (e.g., "month1") or null if none found.
 */
function getActiveTabId() {
    // Look within the modal header for the active tab
    const activeTab = document.querySelector('#modal-box .modal-header .ai-tab-btn.active');
    return activeTab ? activeTab.dataset.tab : null; // e.g., "month1"
}


/**
 * NEW: Helper function to update the visibility of AI modal footer buttons.
 */
function updateFooterButtonVisibility() {
    // Ensure modalContent is available before querying inside it
    if (!DOMElements.modalContent) return;
    const activePanel = DOMElements.modalContent.querySelector('.ai-tabs-content > div.active');
    if (!activePanel) return;

    const activePanelHasPlan = !!activePanel.querySelector('table');
    const anyPanelHasPlan = !!DOMElements.modalContent.querySelector('.ai-tabs-content table'); // Check across all tabs

    const footer = DOMElements.modalBox?.querySelector('.modal-footer'); // Use optional chaining
    if (!footer) return;

    const undoRedoContainer = footer.querySelector('.undo-redo-container');
    const regenButton = footer.querySelector('#modal-regen-btn'); // Use ID now
    const printButton = footer.querySelector('#modal-print-btn'); // Use ID now
    // Save button removed as saving is automatic

    // Undo/Redo visibility depends on history AND if the active panel has content
    if (undoRedoContainer) {
        undoRedoContainer.style.display = activePanelHasPlan ? 'flex' : 'none';
        if (activePanelHasPlan) {
            updateUndoRedoButtons(); // Update disabled state only if visible
        }
    }
    // Regenerate is only relevant if the *active* panel has a plan
    if (regenButton) regenButton.style.display = activePanelHasPlan ? 'inline-flex' : 'none';
    // Print is relevant if *any* panel has a plan
    if (printButton) printButton.style.display = anyPanelHasPlan ? 'inline-flex' : 'none';
}


// --- AI Action Plan Logic (with Undo/Redo & Real-Time Saving) ---

function updateUndoRedoButtons() {
    const activeTabId = getActiveTabId();
    if (!activeTabId || !undoHistory[activeTabId]) return; // Add check

    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if (undoBtn) undoBtn.disabled = undoHistory[activeTabId].length <= 1;
    if (redoBtn) redoBtn.disabled = redoHistory[activeTabId].length === 0;
}


function saveState() {
    const activeTabId = getActiveTabId();
    // Ensure activeTabId is valid before proceeding
    if (!activeTabId || !undoHistory[activeTabId]) return;

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
    if (!activeTabId || !undoHistory[activeTabId] || undoHistory[activeTabId].length <= 1) return; // Add check for valid activeTabId

    const currentState = undoHistory[activeTabId].pop();
    redoHistory[activeTabId].push(currentState);
    const previousState = undoHistory[activeTabId][undoHistory[activeTabId].length - 1];
    const activePanel = document.querySelector(`.ai-tabs-content > div[data-tab-panel="${activeTabId}"]`);
    if (activePanel) {
        activePanel.innerHTML = previousState;
        makeTablesSortable(activePanel); // Re-apply sortability after changing content
    }
    updateUndoRedoButtons();
    if (debouncedSave) debouncedSave(); // Trigger save after undo
}

function redo() {
    const activeTabId = getActiveTabId();
     if (!activeTabId || !redoHistory[activeTabId] || redoHistory[activeTabId].length === 0) return; // Add check for valid activeTabId

    const nextState = redoHistory[activeTabId].pop();
    undoHistory[activeTabId].push(nextState);
    const activePanel = document.querySelector(`.ai-tabs-content > div[data-tab-panel="${activeTabId}"]`);
    if (activePanel) {
        activePanel.innerHTML = nextState;
        makeTablesSortable(activePanel); // Re-apply sortability after changing content
    }
    updateUndoRedoButtons();
    if (debouncedSave) debouncedSave(); // Trigger save after redo
}


function makeTablesSortable(tableContainer) {
    if (!tableContainer) return;
    const tables = tableContainer.querySelectorAll('table');
    tables.forEach(table => {
        const headers = table.querySelectorAll('thead th');
        const sortableColumns = { 'Action Step': { index: 0, type: 'text' }, 'Pillar': { index: 1, type: 'text' }, 'Owner': { index: 2, type: 'text' }, 'Due Date': { index: 3, type: 'date' }, 'Status': { index: 5, type: 'text' } };
        headers.forEach((th) => {
            const headerText = th.innerText.trim();
            if (sortableColumns[headerText]) {
                const config = sortableColumns[headerText];
                 // Prevent adding multiple sort icons if function runs again
                if (!th.classList.contains('sortable-header')) {
                    th.classList.add('sortable-header');
                    th.dataset.column = config.index;
                    th.dataset.sortType = config.type;
                    th.innerHTML = ''; // Clear existing content
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
            }
        });
    });
};

function setupAiModalInteractivity(container) {
    if (!container) return;

    // Initialize debounced save function for the current modal instance
     debouncedSave = debounce(() => {
         const currentMonthTab = getActiveTabId();
         const monthNum = currentMonthTab ? parseInt(currentMonthTab.replace('month', ''), 10) : null;
         if (monthNum) { // Only save if we have a valid month
            saveActionPlan(false, monthNum);
         }
     }, 1000);


    // Apply sortability to all initial tables within the container's content area
    const contentArea = container.querySelector('.ai-tabs-content');
    if (contentArea) {
        makeTablesSortable(contentArea);
    }


    const handleTableSort = (header) => {
        const table = header.closest('table');
        const tbody = table?.querySelector('tbody'); // Optional chaining
        if (!tbody) return; // Exit if no table body found
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
                // Use localeCompare for better text sorting, including numbers within text
                compareResult = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
            }
            return newDirection === 'asc' ? compareResult : -compareResult;
        });
        // Efficiently re-append sorted rows
        tbody.append(...rows);
        saveState(); // Save state after sorting
        if (debouncedSave) debouncedSave(); // Trigger debounced save
    };
    container.addEventListener('click', async (e) => {
        const addBtn = e.target.closest('.btn-add-row');
        const removeBtn = e.target.closest('.btn-remove-row');
        const tab = e.target.closest('.ai-tab-btn');
        const sortHeader = e.target.closest('.sortable-header');
        const generateBtn = e.target.closest('.generate-month-plan-btn');

        if (addBtn) {
            const tableBody = addBtn.closest('table')?.querySelector('tbody'); // Optional chaining
            if (tableBody) {
                const newRow = document.createElement('tr');
                newRow.innerHTML = `<td contenteditable="true"></td><td contenteditable="true"></td><td contenteditable="true"></td><td contenteditable="true"></td><td contenteditable="true"></td><td contenteditable="true">To Do</td><td class="actions-cell"><button class="btn-remove-row"><i class="bi bi-trash3"></i></button></td>`;
                tableBody.appendChild(newRow);
                saveState();
                if (debouncedSave) debouncedSave();
            }
        }
        if (removeBtn) {
             removeBtn.closest('tr')?.remove(); // Use optional chaining
             saveState();
             if (debouncedSave) debouncedSave();
        }
        if (tab) {
            if (tab.classList.contains('active')) return;
             // Ensure we look for tabs within the modal context
            const tabContainer = tab.closest('.modal-header-main, .ai-action-plan-container'); // Check both header and potential content tabs
            if (!tabContainer) return;

            tabContainer.querySelectorAll('.ai-tab-btn').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
             // Target content panels within the modal content area
            const contentContainer = DOMElements.modalContent?.querySelector('.ai-tabs-content'); // Optional chaining
            if (!contentContainer) return;

            contentContainer.querySelectorAll(':scope > div').forEach(p => p.classList.remove('active'));
            const targetPanel = contentContainer.querySelector(`[data-tab-panel="${tab.dataset.tab}"]`);
            if (targetPanel) targetPanel.classList.add('active');
            updateUndoRedoButtons(); // Update buttons on tab switch
            updateFooterButtonVisibility(); // Update footer visibility on tab switch
        }
        if (sortHeader) { handleTableSort(sortHeader); }

         // --- Initial Generation Logic ---
        if (generateBtn) {
            const month = generateBtn.dataset.month;
            const panel = container.querySelector(`[data-tab-panel="month${month}"]`);
            if (!panel) return; // Exit if panel not found
            panel.innerHTML = `<div class="flex flex-col items-center justify-center p-8"><div class="loading-spinner"></div><p class="mt-4 text-gray-600">Generating plan for Month ${month}...</p></div>`;

             // Hide generate button itself and Regenerate button in footer
            generateBtn.closest('div')?.classList.add('hidden'); // Optional chaining for safety
            const footer = DOMElements.modalBox?.querySelector('.modal-footer'); // Optional chaining
            const regenButton = footer?.querySelector('#modal-regen-btn'); // Use ID + optional chaining
            if (regenButton) regenButton.style.display = 'none';


            try {
                if (appState.aiPlanGenerationController) {
                    appState.aiPlanGenerationController.abort();
                }
                appState.aiPlanGenerationController = new AbortController();
                const signal = appState.aiPlanGenerationController.signal;

                const monthTableHTML = await generateAiActionPlan(currentPlanSummary, signal, month);

                panel.innerHTML = monthTableHTML;
                makeTablesSortable(panel); // Apply sortability to the newly added table

                // Save only the generated month immediately
                await saveActionPlan(true, parseInt(month, 10));

                // Reset undo/redo history for the generated month
                if(undoHistory[`month${month}`]) { // Check if history exists for the month
                    undoHistory[`month${month}`] = [panel.innerHTML];
                    redoHistory[`month${month}`] = [];
                }
                updateUndoRedoButtons();

                // Restore relevant footer buttons after successful generation
                 if (regenButton) regenButton.style.display = 'inline-flex';
                 const printButton = footer?.querySelector('#modal-print-btn'); // Select print button + optional chaining
                 if (printButton) printButton.style.display = 'inline-flex'; // Show print button


            } catch (error) {
                 // Restore Generate New button visibility even on failure/cancel
                if (regenButton) regenButton.style.display = 'inline-flex';

                if (error.name === 'AbortError') {
                    console.log(`Month ${month} plan generation cancelled.`);
                    panel.innerHTML = `
                        <div class="text-center p-8 flex flex-col items-center justify-center min-h-[300px]">
                            <h3 class="font-bold text-lg text-gray-700">Generation Cancelled</h3>
                            <button class="btn btn-primary generate-month-plan-btn mt-4" data-month="${month}">
                                <i class="bi bi-stars"></i>
                                <span>Generate Month ${month} Plan</span>
                            </button>
                        </div>`;
                } else {
                     console.error("Error generating AI plan for month:", error);
                      // Add a Retry button within the error message
                     panel.innerHTML = `<div class="text-center p-8 text-red-600"><p class="font-semibold">Generation Failed</p><p class="text-sm">${error.message}</p><button class="btn btn-secondary mt-4 retry-generation-btn" data-month="${month}">Retry</button></div>`;
                }


            } finally {
                appState.aiPlanGenerationController = null;
                 // Ensure footer visibility is correct based on the potentially updated content
                 // Use setTimeout to ensure DOM updates are processed before visibility check
                setTimeout(updateFooterButtonVisibility, 50);
            }
        } // End if (generateBtn)

        // Add event listener for the retry button
        const retryBtn = e.target.closest('.retry-generation-btn');
        if (retryBtn) {
            const month = retryBtn.dataset.month;
            const panel = container.querySelector(`[data-tab-panel="month${month}"]`);
            if (panel) {
                // Re-show the original generate button structure
                 panel.innerHTML = `
                        <div class="text-center p-8 flex flex-col items-center justify-center min-h-[300px]">
                            <i class="bi bi-robot text-4xl text-gray-300 mb-4"></i>
                            <h3 class="font-bold text-lg text-gray-700">Action Plan for Month ${month}</h3>
                            <p class="text-gray-500 my-2 max-w-sm">Generate a tactical action plan using AI based on your goals for this month.</p>
                            <button class="btn btn-primary generate-month-plan-btn mt-4" data-month="${month}">
                                <i class="bi bi-stars"></i>
                                <span>Generate Month ${month} Plan</span>
                            </button>
                        </div>`;
                 // Find the newly added button and click it
                 const newGenerateBtn = panel.querySelector(`.generate-month-plan-btn[data-month="${month}"]`);
                 if (newGenerateBtn) {
                     // Use setTimeout to ensure the button is fully rendered before clicking
                     setTimeout(() => newGenerateBtn.click(), 0);
                 }
            }
        }
    });

    // --- Observer Setup ---
    let observerInstance = null; // Store observer instance locally
    const observerCallback = (mutationsList) => {
        // We only care if something *actually* changed the content
        let contentChanged = false;
        for(const mutation of mutationsList) {
            if (mutation.type === 'characterData' || mutation.type === 'childList') {
                 // Check if it's just a highlight change from sorting or selection, or irrelevant node changes
                const isHighlightChange = (mutation.target.nodeType === Node.ELEMENT_NODE && mutation.target.classList.contains('is-highlighted')) ||
                                          (mutation.removedNodes.length > 0 && mutation.removedNodes[0].nodeType === Node.ELEMENT_NODE && mutation.removedNodes[0].classList.contains('is-highlighted')) ||
                                          (mutation.addedNodes.length > 0 && mutation.addedNodes[0].nodeType === Node.ELEMENT_NODE && mutation.addedNodes[0].classList.contains('is-highlighted'));

                // Ignore changes that are just adding/removing the highlight class or involve empty text nodes
                 if (!isHighlightChange && !(mutation.target.nodeType === Node.TEXT_NODE && mutation.target.textContent.trim() === '')) {
                     contentChanged = true;
                     break;
                 }
            }
        }
        if (contentChanged) {
            saveState(); // Update undo stack
            if (debouncedSave) debouncedSave(); // Trigger debounced save
        }
    };

    observerInstance = new MutationObserver(observerCallback);
    const observerConfig = { childList: true, subtree: true, characterData: true };
    const targetNode = container.querySelector('.ai-tabs-content');
    if (targetNode) {
        observerInstance.observe(targetNode, observerConfig);
        // Store the instance on the modal box to disconnect later
        DOMElements.modalBox.observerInstance = observerInstance;
         console.log("MutationObserver attached."); // Debug log
    } else {
        console.error("Could not find '.ai-tabs-content' to observe.");
    }

    // --- END Observer Setup ---

    // Return the observer so it can be disconnected later if needed
    return observerInstance; // Return the instance
}


// --- MODIFIED: saveActionPlan Function ---
/**
 * Saves the AI action plan content for one or all months to Firestore.
 * @param {boolean} forceImmediate - If true, saves immediately bypassing debounce.
 * @param {number|null} monthToSave - If a number (1, 2, or 3), saves only that month. Saves all if null.
 */
async function saveActionPlan(forceImmediate = false, monthToSave = null) {
    // Ensure we have the necessary context before proceeding
    if (!appState || !appState.currentUser || !appState.currentPlanId || !activeSaveDataFunction) {
         console.warn("Save context not fully available. Skipping saveActionPlan.");
         return;
     }

    const payload = {};
    const months = monthToSave ? [monthToSave] : [1, 2, 3]; // Determine which months to process

    console.log(`saveActionPlan called: forceImmediate=${forceImmediate}, monthToSave=${monthToSave}`); // Debug log

    for (let i of months) { // Iterate only through the required months
        const panel = document.querySelector(`#ai-printable-area [data-tab-panel="month${i}"]`);
        // Check if the panel exists AND contains a table (meaning it has a generated plan)
        if (panel && panel.querySelector('table')) {
            payload[`aiActionPlanMonth${i}`] = panel.innerHTML;
        } else {
             // If saving a specific month and it has no table, explicitly mark for deletion in payload.
             // If saving all months, mark for deletion only if it *previously existed* in appState.planData.
            if (monthToSave || appState.planData?.[`aiActionPlanMonth${i}`]) { // Optional chaining
               // Use Firestore's sentinel value for deletion
               payload[`aiActionPlanMonth${i}`] = firebase.firestore.FieldValue.delete();
            }
        }
    }

    // Only proceed if there's an active save function and actual changes to save
    if (Object.keys(payload).length > 0) {
        try {
             console.log(`Calling activeSaveDataFunction with payload:`, payload); // Debug log
             await activeSaveDataFunction(forceImmediate, payload);
             console.log(`Action plan saved successfully for month(s): ${months.join(', ')}`);
             // Optionally show a brief success indicator if needed (saveIndicator already handled by activeSaveDataFunction)
         } catch (error) {
             console.error("Error in saveActionPlan calling activeSaveDataFunction:", error);
             // Consider showing a user-facing error message here
             openModal('warning', { title: 'Save Failed', message: 'Could not save the action plan changes. Please check your connection and try again.' });
         }
    } else {
         console.log("No changes detected in saveActionPlan, skipping save.");
    }
}


// --- MODIFIED: handleRegenerateActionPlan ---
// Gets the active month *before* opening the confirmation modal
function handleRegenerateActionPlan() {
    const activeTabId = getActiveTabId();
    const monthNum = activeTabId ? activeTabId.replace('month', '') : null;
    if (!monthNum) {
         console.error("handleRegenerateActionPlan: Could not determine active month.");
         openModal('warning', { title: 'Error', message: 'Could not determine which month to regenerate. Please select a month tab first.' });
         return;
     }
    openModal('confirmRegenerate', { monthNum: monthNum }); // Pass monthNum in context
}


function requestCloseModal() {
    const modalType = DOMElements.modalBox?.dataset.type; // Optional chaining
    if (modalType === 'aiActionPlan_generate' && appState.aiPlanGenerationController) {
        appState.aiPlanGenerationController.abort();
    }
     // Disconnect observer BEFORE closing
     if (DOMElements.modalBox?.dataset.observerAttached === 'true') {
         const observerInstance = DOMElements.modalBox.observerInstance;
         if (observerInstance && typeof observerInstance.disconnect === 'function') {
             observerInstance.disconnect();
             console.log("MutationObserver disconnected.");
         }
         delete DOMElements.modalBox.dataset.observerAttached;
         delete DOMElements.modalBox.observerInstance;
     }
    // Since we save automatically, we don't need to check for unsaved changes.
    closeModal();
}


async function handleModalAction() {
     // Use optional chaining for safety
     const type = DOMElements.modalBox?.dataset.type;
     const planId = DOMElements.modalBox?.dataset.planId;

    if (!type) return; // Exit if modal type is not defined

    if (type === 'timeout') {
        closeModal();
        return;
    }
    switch (type) {
        case 'create':
            const newPlanNameInput = document.getElementById('newPlanName');
            const newPlanName = newPlanNameInput?.value.trim(); // Optional chaining
            const newPlanQuarter = document.getElementById('newPlanQuarter')?.value.trim(); // Optional chaining
            const originalButtonText = DOMElements.modalActionBtn.textContent;
            const errorContainer = document.getElementById('modal-error-container');
            if(errorContainer) errorContainer.innerHTML = '';
             if (newPlanNameInput) newPlanNameInput.classList.remove('input-error'); // Check if element exists

            if (!newPlanName) {
                if (newPlanNameInput) {
                    newPlanNameInput.classList.add('input-error', 'shake');
                    setTimeout(() => newPlanNameInput.classList.remove('shake'), 500);
                }
                return;
            }
            DOMElements.modalActionBtn.disabled = true;
            DOMElements.modalActionBtn.textContent = 'Checking...';
             if (!appState.currentUser?.uid) { // Check if user is logged in
                 console.error("User not logged in, cannot create plan.");
                 if (errorContainer) errorContainer.innerHTML = `<p class="auth-error" style="display:block; margin: 0; width: 100%;">Authentication error. Please log in again.</p>`;
                 DOMElements.modalActionBtn.disabled = false;
                 DOMElements.modalActionBtn.textContent = originalButtonText;
                 return;
             }
            const plansRef = db.collection('users').doc(appState.currentUser.uid).collection('plans');
            const nameQuery = await plansRef.where('planName', '==', newPlanName).get();
            if (!nameQuery.empty) {
                if (newPlanNameInput) newPlanNameInput.classList.add('input-error', 'shake'); // Check element
                if(errorContainer) {
                   errorContainer.innerHTML = `<p class="auth-error" style="display:block; margin: 0; width: 100%;">A plan with this name already exists.</p>`;
                }
                DOMElements.modalActionBtn.disabled = false;
                DOMElements.modalActionBtn.textContent = originalButtonText;
                 if (newPlanNameInput) setTimeout(() => newPlanNameInput.classList.remove('shake'), 500); // Check element
                return;
            }
            DOMElements.modalActionBtn.disabled = false;
            DOMElements.modalActionBtn.textContent = originalButtonText;
            closeModal();
             if (DOMElements.creationLoadingView) DOMElements.creationLoadingView.classList.remove('hidden'); // Check element
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
                 openModal('warning', { title: 'Creation Failed', message: 'Could not create the new plan. Please try again.' });
            } finally {
                 if (DOMElements.creationLoadingView) DOMElements.creationLoadingView.classList.add('hidden'); // Check element
            }
            break;
        case 'edit':
            const newName = document.getElementById('editPlanName')?.value.trim(); // Optional chaining
            const newQuarter = document.getElementById('editPlanQuarter')?.value.trim(); // Optional chaining
            if (newName && planId && appState.currentUser?.uid) { // Add checks
                try {
                    await db.collection('users').doc(appState.currentUser.uid).collection('plans').doc(planId).update({
                        planName: newName,
                        quarter: newQuarter
                    });
                    document.dispatchEvent(new CustomEvent('rerender-dashboard'));
                } catch (error) {
                    console.error("Error updating plan details:", error);
                    openModal('warning', { title: 'Update Failed', message: 'Could not save changes. Please try again.' });
                 }
            } else if (!newName) {
                 // Handle case where name is empty if it's required
                 const nameInput = document.getElementById('editPlanName');
                 if (nameInput) {
                     nameInput.classList.add('input-error', 'shake');
                     setTimeout(() => nameInput.classList.remove('shake'), 500);
                 }
                 return; // Prevent closing modal if validation fails
             }
            closeModal();
            break;
        case 'delete':
            if (planId && appState.currentUser?.uid) { // Add checks
                try {
                    await db.collection('users').doc(appState.currentUser.uid).collection('plans').doc(planId).delete();
                    document.dispatchEvent(new CustomEvent('rerender-dashboard'));
                } catch (error) {
                     console.error("Error deleting plan:", error);
                     openModal('warning', { title: 'Deletion Failed', message: 'Could not delete the plan. Please try again.' });
                 }
            }
            closeModal();
            break;
        case 'confirmDeleteEvent':
            document.dispatchEvent(new CustomEvent('event-deletion-confirmed'));
            closeModal();
            break;
        case 'confirmDeleteConversation':
            document.dispatchEvent(new CustomEvent('conversation-deletion-confirmed', {
                detail: { conversationId: planId } // planId holds the conversationId here
            }));
            closeModal();
            break;
        case 'confirmDeleteFile':
            document.dispatchEvent(new CustomEvent('file-deletion-confirmed', {
                detail: { fileId: planId } // planId holds the fileId here
            }));
            closeModal();
            break;
          // Action for the AI save button is handled directly in its event listener now
         // case 'saveActionPlan':
         //    await saveActionPlan(true); // Force immediate save
         //    break;
    }
}


// --- Public (Exported) Functions ---

export async function handleShare(db, appState) {
    if (!appState.currentUser || !appState.currentPlanId) {
        openModal('warning', { title: 'Error', message: 'Cannot share plan. Please ensure you are logged in and have a plan selected.' });
        return;
    }
    openModal('sharing');
    try {
        let shareableLink;
        // Query sharedPlans collection using the plan ID directly
        const pointerQuery = db.collection('sharedPlans').where('originalPlanId', '==', appState.currentPlanId).limit(1);
        const querySnapshot = await pointerQuery.get();

        if (!querySnapshot.empty) {
            // If a pointer exists, use its ID
            const existingPointer = querySnapshot.docs[0];
            shareableLink = `${window.location.origin}/view.html?id=${existingPointer.id}`;
        } else {
            // If no pointer exists, create one
            const originalPlanRef = db.collection('users').doc(appState.currentUser.uid).collection('plans').doc(appState.currentPlanId);
            // Ensure the plan document exists before trying to update/create a share link
            const planDoc = await originalPlanRef.get();
            if (!planDoc.exists) {
                throw new Error("Cannot share a plan that doesn't exist.");
            }
            // Update the original plan to mark it as shared (optional, but can be useful)
            // Consider if this update is necessary - might trigger unnecessary writes.
            // await originalPlanRef.update({ isShared: true });

            // Create the pointer document
            const pointerDoc = {
                originalUserId: appState.currentUser.uid,
                originalPlanId: appState.currentPlanId,
                sharedAt: firebase.firestore.FieldValue.serverTimestamp(),
                // Add plan details for easier querying/display if needed, e.g.:
                planName: planDoc.data()?.planName || 'Untitled Plan',
                managerName: planDoc.data()?.managerName || 'Unknown Manager'
            };
            const newPointerRef = await db.collection('sharedPlans').add(pointerDoc);
            shareableLink = `${window.location.origin}/view.html?id=${newPointerRef.id}`;
        }
        // Update the modal content with the link
        const modalContent = document.getElementById('modal-content');
        if (!modalContent) return; // Add check
        modalContent.innerHTML = `<p class="text-sm text-gray-600 mb-4">Anyone with this link can view a read-only version of your plan. It updates automatically as you make changes.</p>
                                  <label for="shareable-link" class="font-semibold block mb-2">Shareable Link:</label>
                                  <div class="flex items-center gap-2">
                                      <input type="text" id="shareable-link" class="form-input" value="${shareableLink}" readonly>
                                      <button id="copy-link-btn" class="btn btn-secondary" title="Copy link"><i class="bi bi-clipboard"></i></button>
                                  </div>
                                  <p id="copy-success-msg" class="text-green-600 text-sm mt-2 hidden">Link copied!</p>`;

        const copyBtn = document.getElementById('copy-link-btn');
        const successMsg = document.getElementById('copy-success-msg');
        if (copyBtn && successMsg) { // Add checks
            copyBtn.addEventListener('click', () => {
                const linkInput = document.getElementById('shareable-link');
                linkInput?.select(); // Optional chaining
                try {
                    navigator.clipboard.writeText(linkInput?.value || ''); // Use Clipboard API
                    successMsg.classList.remove('hidden');
                    setTimeout(() => successMsg.classList.add('hidden'), 2000);
                } catch (err) {
                    console.error('Failed to copy link: ', err);
                     // Fallback for older browsers (less reliable)
                     try { document.execCommand('copy'); successMsg.classList.remove('hidden'); setTimeout(() => successMsg.classList.add('hidden'), 2000); }
                     catch (execErr) { alert('Failed to copy link automatically. Please copy it manually.');}
                }
            });
        }
        DOMElements.modalActionBtn.style.display = 'none';
        DOMElements.modalCancelBtn.textContent = 'Done';
    } catch (error) {
        console.error("Error creating shareable link:", error);
         const modalContent = document.getElementById('modal-content');
         if(modalContent) modalContent.innerHTML = `<p class="text-red-600">Could not create a shareable link. Please try again.</p>`; // Add check
         DOMElements.modalActionBtn.style.display = 'none'; // Ensure action btn is hidden on error too
         DOMElements.modalCancelBtn.textContent = 'Close';
    }
}


export async function handleAIActionPlan(appState, saveDataFn, planSummary) {
    if (!saveDataFn) {
         console.error("Save function not provided to handleAIActionPlan.");
         openModal('warning', { title: 'Error', message: 'Cannot open AI Action Plan. Internal configuration missing.' });
         return;
     }
    activeSaveDataFunction = saveDataFn;
    currentPlanSummary = planSummary; // Store the summary for later use
    openModal('aiActionPlan_view');
}

export function initializeCharCounters() {
    document.querySelectorAll('div[contenteditable="true"][data-maxlength]').forEach(editor => { // More specific selector
        let wrapper = editor.closest('.textarea-wrapper'); // Use closest to handle potential nesting changes
        let counter = wrapper?.querySelector('.char-counter'); // Use optional chaining

        // If not already initialized, create the wrapper and counter
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'textarea-wrapper';
            editor.parentNode?.insertBefore(wrapper, editor); // Use optional chaining
            wrapper.appendChild(editor);

            counter = document.createElement('div');
            counter.className = 'char-counter';
            wrapper.appendChild(counter);

             // Define update function locally
             const updateCounter = () => {
                 if (!editor.dataset.maxlength) return; // Exit if maxlength is missing
                 const maxLength = parseInt(editor.dataset.maxlength, 10);
                 const currentLength = editor.innerText.length;
                 const remaining = maxLength - currentLength;
                 if(counter) { // Check if counter exists
                     counter.textContent = `${remaining}`;
                     counter.style.color = remaining < 0 ? 'var(--gails-red)' : (remaining < 20 ? '#D97706' : 'var(--gails-text-secondary)');
                 }
             };

             // Attach listeners only once during initialization
             editor.addEventListener('input', updateCounter);
             editor.addEventListener('focus', () => counter?.classList.add('visible')); // Optional chaining
             editor.addEventListener('blur', () => counter?.classList.remove('visible')); // Optional chaining
             editor.addEventListener('input', () => managePlaceholder(editor)); // Also manage placeholder

             updateCounter(); // Initial update
             managePlaceholder(editor); // Initial placeholder check

        } else if (counter) {
            // If already initialized, just ensure the counter updates
             const updateFn = () => {
                 if (!editor.dataset.maxlength) return;
                 const maxLength = parseInt(editor.dataset.maxlength, 10);
                 const currentLength = editor.innerText.length;
                 const remaining = maxLength - currentLength;
                 counter.textContent = `${remaining}`;
                 counter.style.color = remaining < 0 ? 'var(--gails-red)' : (remaining < 20 ? '#D97706' : 'var(--gails-text-secondary)');
             };
             updateFn(); // Update counter on re-render/re-initialization call
             managePlaceholder(editor); // Update placeholder state too
        }

    });
}


export function openModal(type, context = {}) {
     // Ensure essential elements exist before proceeding
     if (!DOMElements.modalOverlay || !DOMElements.modalBox || !DOMElements.modalActionBtn || !DOMElements.modalCancelBtn) {
         console.error("Cannot open modal: Essential modal DOM elements are missing.");
         return;
     }

    // *** FIX: Destructure monthNum from context for confirmRegenerate ***
    const { planId, currentName, planName, eventTitle, currentQuarter, fileName, monthNum } = context;


    // --- HEADER RESET ---
    const modalHeader = DOMElements.modalBox.querySelector('.modal-header');
     if (!modalHeader) { // Add safety check for header
         console.error("Modal header element not found.");
         return;
     }

    if (modalHeader.querySelector('.modal-header-main')) {
        // Reset only if the complex AI header is present
        modalHeader.innerHTML = `
            <h3 id="modal-title" class="text-lg font-bold">Modal Title</h3>
            <button id="modal-close-btn" class="btn btn-secondary btn-icon"><i class="bi bi-x-lg"></i></button>
        `;
        // Re-attach close listener
        const newCloseBtn = modalHeader.querySelector('#modal-close-btn');
        if (newCloseBtn) newCloseBtn.addEventListener('click', requestCloseModal);
        DOMElements.modalTitle = document.getElementById('modal-title'); // Re-assign title element reference
    } else {
         // If it's the simple header, just ensure the title element is referenced correctly
         DOMElements.modalTitle = modalHeader.querySelector('#modal-title') || document.getElementById('modal-title'); // Fallback to existing global ref if needed
          // Ensure close button listener is attached if not done already or if reset is needed
          let closeBtn = modalHeader.querySelector('#modal-close-btn');
          if (!closeBtn) {
              closeBtn = document.createElement('button');
              closeBtn.id = 'modal-close-btn';
              closeBtn.className = 'btn btn-secondary btn-icon';
              closeBtn.innerHTML = '<i class="bi bi-x-lg"></i>';
              modalHeader.appendChild(closeBtn);
          }
           // Remove existing listener before adding a new one to prevent duplicates
           closeBtn.removeEventListener('click', requestCloseModal);
           closeBtn.addEventListener('click', requestCloseModal);
    }


    // --- END HEADER RESET ---

    DOMElements.modalBox.dataset.type = type;
    // Store planId safely, ensuring it's not undefined or null being stored
    DOMElements.modalBox.dataset.planId = planId || '';
    const footer = DOMElements.modalActionBtn.parentNode;
    if (!footer) { // Add safety check for footer
        console.error("Modal footer element not found.");
        return;
    }


    // Clear dynamic buttons BUT keep modalActionBtn and modalCancelBtn
    footer.querySelectorAll('.dynamic-btn').forEach(btn => btn.remove());
    // Reset standard buttons
    DOMElements.modalActionBtn.style.display = 'inline-flex';
    DOMElements.modalCancelBtn.style.display = 'inline-flex';
    DOMElements.modalActionBtn.className = 'btn btn-primary'; // Reset classes
    DOMElements.modalCancelBtn.className = 'btn btn-secondary'; // Reset classes
    DOMElements.modalActionBtn.textContent = 'Action';
    DOMElements.modalCancelBtn.textContent = 'Cancel';
    DOMElements.modalActionBtn.disabled = false;
    DOMElements.modalCancelBtn.disabled = false;
    // Remove previous listeners before adding new ones - CLONE NODE METHOD
    const actionBtnClone = DOMElements.modalActionBtn.cloneNode(true);
    const cancelBtnClone = DOMElements.modalCancelBtn.cloneNode(true);
    DOMElements.modalActionBtn.replaceWith(actionBtnClone);
    DOMElements.modalCancelBtn.replaceWith(cancelBtnClone);
    // Re-select the cloned elements from the footer
    DOMElements.modalActionBtn = footer.querySelector('.btn-primary');
    DOMElements.modalCancelBtn = footer.querySelector('.btn-secondary');
     // Ensure the elements were found before adding listeners
     if (DOMElements.modalActionBtn) DOMElements.modalActionBtn.addEventListener('click', handleModalAction);
     if (DOMElements.modalCancelBtn) DOMElements.modalCancelBtn.addEventListener('click', requestCloseModal);


    footer.style.justifyContent = 'flex-end'; // Default alignment

    // --- Modal Content Setup ---
     // Ensure modalContent exists before modifying
     if (!DOMElements.modalContent) {
         console.error("Modal content element not found.");
         return;
     }

    switch (type) {
        case 'create':
            if (DOMElements.modalTitle) DOMElements.modalTitle.textContent = "Create New Plan"; // Check title element
            DOMElements.modalContent.innerHTML = `<label for="newPlanName" class="font-semibold block mb-2">Plan Name:</label>
                                                  <input type="text" id="newPlanName" class="form-input" placeholder="e.g., Q4 2025 Focus" value="New Plan ${new Date().toLocaleDateString('en-GB')}">
                                                  <label for="newPlanQuarter" class="font-semibold block mb-2 mt-4">Quarter:</label>
                                                  <input type="text" id="newPlanQuarter" class="form-input" placeholder="e.g., Q3 FY26">
                                                  <div id="modal-error-container" class="modal-error-container"></div>`;
            DOMElements.modalActionBtn.textContent = "Create Plan";
             const newPlanNameInput = document.getElementById('newPlanName');
             if (newPlanNameInput) newPlanNameInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') handleModalAction(); }); // Check element
            break;
        case 'edit':
            if (DOMElements.modalTitle) DOMElements.modalTitle.textContent = "Edit Plan Details"; // Check title element
            DOMElements.modalContent.innerHTML = `<label for="editPlanName" class="font-semibold block mb-2">Plan Name:</label>
                                                  <input type="text" id="editPlanName" class="form-input" value="${currentName || ''}">
                                                  <label for="editPlanQuarter" class="font-semibold block mb-2 mt-4">Quarter:</label>
                                                  <input type="text" id="editPlanQuarter" class="form-input" placeholder="e.g., Q3 FY26" value="${currentQuarter || ''}">`;
            DOMElements.modalActionBtn.textContent = "Save Changes";
             const editPlanNameInput = document.getElementById('editPlanName');
             if (editPlanNameInput) editPlanNameInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') handleModalAction(); }); // Check element
            break;
        case 'delete':
             if (DOMElements.modalTitle) DOMElements.modalTitle.textContent = "Confirm Deletion"; // Check title element
            DOMElements.modalContent.innerHTML = `<p>Are you sure you want to permanently delete the plan: <strong class="font-bold">${planName || 'this plan'}</strong>?</p><p class="mt-2 text-sm text-red-700 bg-red-100 p-3 rounded-lg">This action is final and cannot be undone.</p>`;
            DOMElements.modalActionBtn.textContent = "Confirm Delete";
            DOMElements.modalActionBtn.className = 'btn btn-danger';
            break;
        case 'confirmDeleteFile':
             if (DOMElements.modalTitle) DOMElements.modalTitle.textContent = "Confirm Deletion"; // Check title element
            DOMElements.modalContent.innerHTML = `<p>Are you sure you want to permanently delete the file: <strong class="font-bold">${fileName || 'this file'}</strong>?</p><p class="mt-2 text-sm text-red-700 bg-red-100 p-3 rounded-lg">This action cannot be undone.</p>`;
            DOMElements.modalActionBtn.textContent = "Confirm Delete";
            DOMElements.modalActionBtn.className = 'btn btn-danger';
            break;
        case 'confirmDeleteConversation':
             if (DOMElements.modalTitle) DOMElements.modalTitle.textContent = "Confirm Deletion"; // Check title element
            DOMElements.modalContent.innerHTML = `<p>Are you sure you want to permanently delete this conversation and all of its messages?</p><p class="mt-2 text-sm text-red-700 bg-red-100 p-3 rounded-lg">This action cannot be undone.</p>`;
            DOMElements.modalActionBtn.textContent = "Yes, Delete Conversation";
            DOMElements.modalActionBtn.className = 'btn btn-danger';
            DOMElements.modalCancelBtn.textContent = "Cancel";
            break;
        case 'timeout':
            if (DOMElements.modalTitle) DOMElements.modalTitle.textContent = "Session Ended"; // Check title element
            DOMElements.modalContent.innerHTML = `<p>Your work has been saved automatically. For your security, please sign in to continue.</p>`;
            DOMElements.modalActionBtn.textContent = "Continue";
            DOMElements.modalCancelBtn.style.display = 'none';
            DOMElements.modalActionBtn.onclick = closeModal; // Simpler action
            break;
        case 'sharing':
            if (DOMElements.modalTitle) DOMElements.modalTitle.textContent = "Share Your Plan"; // Check title element
            DOMElements.modalContent.innerHTML = `<div class="flex items-center justify-center p-8"><div class="loading-spinner"></div><p class="ml-4 text-gray-600">Generating secure link...</p></div>`;
            DOMElements.modalActionBtn.style.display = 'none';
            DOMElements.modalCancelBtn.textContent = 'Cancel';
            break;
        case 'aiActionPlan_generate': // Fallback / Initial loading state
            if (DOMElements.modalTitle) DOMElements.modalTitle.textContent = "Generating AI Action Plan"; // Check title element
            DOMElements.modalContent.innerHTML = `<div class="flex flex-col items-center justify-center p-8"><div class="loading-spinner"></div><p class="mt-4 text-gray-600">Please wait, the AI is creating your plan...</p></div>`;
            DOMElements.modalActionBtn.style.display = 'none';
            DOMElements.modalCancelBtn.textContent = 'Cancel'; // Allow cancellation
            break;
        case 'aiActionPlan_view': {
            // 1. Rebuild the header with tabs
           // const modalHeader = DOMElements.modalBox.querySelector('.modal-header'); // Already defined above
            if (!modalHeader) break; // Exit if header missing
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
             // Re-attach close listener and re-assign title element
             const newCloseBtnAI = modalHeader.querySelector('#modal-close-btn');
             if(newCloseBtnAI) newCloseBtnAI.addEventListener('click', requestCloseModal);
             DOMElements.modalTitle = document.getElementById('modal-title');


            // 2. Setup the modal footer
            if (!footer) break; // Exit if footer missing
            footer.style.justifyContent = 'space-between'; // Align items to ends
             // -- Undo/Redo Container --
            const undoRedoContainer = document.createElement('div');
            undoRedoContainer.className = 'undo-redo-container dynamic-btn'; // Added dynamic-btn class
            undoRedoContainer.innerHTML = `<button id="undo-btn" class="btn btn-secondary btn-icon" title="Undo"><i class="bi bi-arrow-counterclockwise"></i></button><button id="redo-btn" class="btn btn-secondary btn-icon" title="Redo"><i class="bi bi-arrow-clockwise"></i></button>`;
            footer.insertBefore(undoRedoContainer, footer.firstChild); // Add to the start of the footer
             const undoBtn = undoRedoContainer.querySelector('#undo-btn');
             const redoBtn = undoRedoContainer.querySelector('#redo-btn');
             if(undoBtn) undoBtn.addEventListener('click', undo); // Attach listener
             if(redoBtn) redoBtn.addEventListener('click', redo); // Attach listener

             // -- Right-side Buttons Container --
             const rightButtonsContainer = document.createElement('div');
             rightButtonsContainer.className = 'flex items-center gap-2 dynamic-btn'; // Use dynamic-btn class


            const printBtn = document.createElement('button');
            printBtn.id = 'modal-print-btn'; // Give it an ID
            printBtn.className = 'btn btn-secondary dynamic-btn'; // Add dynamic-btn
            printBtn.innerHTML = `<i class="bi bi-printer-fill"></i> Print Plan`;
            printBtn.onclick = () => { // Keep onclick for simplicity here
                 if (!DOMElements.modalContent) return; // Add check
                const content = DOMElements.modalContent.querySelector('.ai-tabs-content > div.active');
                if (!content || !content.querySelector('table')) { alert("No plan to print for this month."); return; }
                const currentModalHeader = DOMElements.modalBox?.querySelector('.modal-header'); // Optional chaining
                const title = currentModalHeader?.querySelector('.ai-tabs-nav .ai-tab-btn.active')?.textContent || 'Action Plan'; // Optional chaining
                const printNode = content.cloneNode(true);
                printNode.querySelectorAll('.actions-cell, tfoot').forEach(el => el.remove());
                const styles = `@page { size: A4; margin: 25mm; } body { font-family: 'DM Sans', sans-serif; } .print-header { text-align: center; border-bottom: 2px solid #D10A11; padding-bottom: 15px; margin-bottom: 25px; } h1 { font-family: 'Poppins', sans-serif; } h2 { font-family: 'Poppins', sans-serif; color: #D10A11; } table { width: 100%; border-collapse: collapse; font-size: 9pt; } th, td { border: 1px solid #E5E7EB; padding: 10px; text-align: left; } thead { display: table-header-group; }`;
                const win = window.open('', '', 'height=800,width=1200');
                 if (!win) { alert("Please allow popups to print."); return; } // Check if window opened
                win.document.write(`<html><head><title>${title}</title><style>${styles}</style></head><body>`);
                win.document.write(`<div class="print-header"><h1>${title}</h1><h2>Our Bakery Action Plan</h2><p>${appState.planData?.planName || 'Growth Plan'} | ${appState.planData?.bakeryLocation || 'Your Bakery'}</p></div>`); // Optional chaining for appState data
                win.document.write(printNode.innerHTML);
                win.document.write('</body></html>');
                 win.document.close(); // Important for some browsers
                setTimeout(() => { try { win.print(); } catch (e) { console.error("Print error:", e); win.close(); } }, 500); // Delay print slightly + error handling
            };

            const regenButton = document.createElement('button');
            regenButton.id = 'modal-regen-btn'; // Give it an ID
            regenButton.className = 'btn btn-secondary dynamic-btn'; // Add dynamic-btn
            regenButton.innerHTML = `<i class="bi bi-stars"></i> Generate New`;
            regenButton.addEventListener('click', handleRegenerateActionPlan); // Use addEventListener

            rightButtonsContainer.appendChild(regenButton);
            rightButtonsContainer.appendChild(printBtn);
            footer.appendChild(rightButtonsContainer); // Append the container for right buttons

            DOMElements.modalActionBtn.style.display = 'none'; // Hide the default action button
            DOMElements.modalCancelBtn.textContent = 'Done'; // Change cancel to 'Done'

            // 3. Setup the modal content (panels without nav)
             if (!DOMElements.modalContent) break; // Add check
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
            let observer = null; // To hold the MutationObserver instance
            for (let i = 1; i <= 3; i++) {
                const panel = DOMElements.modalContent.querySelector(`[data-tab-panel="month${i}"]`);
                 if (!panel) continue; // Skip if panel not found
                 // Use optional chaining for safer access to planData
                const monthPlanHTML = appState.planData?.[`aiActionPlanMonth${i}`];
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
                     // Ensure history array exists before pushing
                     if (!undoHistory[`month${i}`]) undoHistory[`month${i}`] = [];
                     if (!redoHistory[`month${i}`]) redoHistory[`month${i}`] = [];
                    undoHistory[`month${i}`].push(panel.innerHTML); // Initial state
                }
            }
             // Setup interactivity for the whole modal box (including header tabs and content)
             observer = setupAiModalInteractivity(DOMElements.modalBox);
             // Ensure the observer is disconnected when the modal closes
             DOMElements.modalBox.dataset.observerAttached = 'true'; // Flag to check if observer is active
             if(observer) DOMElements.modalBox.observerInstance = observer; // Store the instance


            // 6. Initial UI state update
            updateUndoRedoButtons();
            updateFooterButtonVisibility(); // Call the helper to set initial visibility

            // Add event listener to update footer on tab clicks within the modal
             // Ensure modalBox exists before adding listener
             if (DOMElements.modalBox) {
                 DOMElements.modalBox.addEventListener('click', (e) => {
                     if (e.target.closest('.ai-tab-btn')) {
                         // Use setTimeout to allow the DOM update (tab switch) to complete
                         setTimeout(updateFooterButtonVisibility, 0);
                     }
                 });
             }


            break; // End aiActionPlan_view case
        }
        // --- FIX: Revised confirmRegenerate Case ---
        case 'confirmRegenerate': {
            // *** Use monthNum passed from context ***
            // const activeTabId = getActiveTabId(); // REMOVED
            // const monthNum = activeTabId ? activeTabId.replace('month', '') : null; // REMOVED

            // Check if monthNum was passed correctly
            if (!monthNum) {
                console.error("Month number missing in context for regeneration.");
                closeModal(); // Close the confirmation modal
                setTimeout(() => openModal('warning', { title: 'Error', message: 'Could not determine which month to regenerate. Please try again.' }), 50);
                return;
            }

            if (DOMElements.modalTitle) DOMElements.modalTitle.textContent = "Confirm Regeneration"; // Check title element
            DOMElements.modalContent.innerHTML = `<p>Are you sure you want to generate a new plan for <strong>Month ${monthNum}</strong>? This will overwrite the current Month ${monthNum} plan and any edits you've made. This action cannot be undone.</p>`;
            DOMElements.modalActionBtn.textContent = "Yes, Generate New Plan";
            DOMElements.modalActionBtn.className = 'btn btn-danger'; // Keep danger style

            // *** REVISED ONCLICK LOGIC ***
            DOMElements.modalActionBtn.onclick = async () => {
                // 1. Close the small confirmation modal FIRST
                closeModal();

                // 2. Target the panel in the *main* AI modal (which should still be open or re-opened if needed)
                 setTimeout(async () => { // Use setTimeout to ensure the main modal is ready
                     // --- Ensure main modal is open and structured ---
                     // Check if the main modal is already open and is the correct type
                     const isMainModalOpen = !DOMElements.modalOverlay?.classList.contains('hidden') && DOMElements.modalBox?.dataset.type === 'aiActionPlan_view';
                     if (!isMainModalOpen) {
                         openModal('aiActionPlan_view'); // Re-ensure the main modal is open and structured correctly
                         // Wait briefly for the modal to potentially re-render
                         await new Promise(resolve => setTimeout(resolve, 100)); // Increased wait slightly
                     }
                     // --- End ensure main modal open ---

                     const panel = document.querySelector(`#ai-printable-area [data-tab-panel="month${monthNum}"]`);
                     if (!panel) {
                          console.error("Target panel for regeneration not found after re-opening modal.");
                          openModal('warning', { title: 'Error', message: 'Could not start regeneration. Panel not found.' });
                          return;
                      }

                     // 3. Display loading state
                     panel.innerHTML = `<div class="flex flex-col items-center justify-center p-8"><div class="loading-spinner"></div><p class="mt-4 text-gray-600">Generating new plan for Month ${monthNum}...</p></div>`;

                     // 4. Hide relevant footer buttons
                     const footer = DOMElements.modalBox?.querySelector('.modal-footer'); // Optional chaining
                     const regenButton = footer?.querySelector('#modal-regen-btn'); // Use ID
                     const printButton = footer?.querySelector('#modal-print-btn'); // Use ID
                     const undoRedoContainer = footer?.querySelector('.undo-redo-container');

                     if (regenButton) regenButton.style.display = 'none';
                     if (printButton) printButton.style.display = 'none';
                     if (undoRedoContainer) undoRedoContainer.style.display = 'none';

                     try {
                         if (appState.aiPlanGenerationController) {
                             appState.aiPlanGenerationController.abort();
                         }
                         appState.aiPlanGenerationController = new AbortController();
                         const signal = appState.aiPlanGenerationController.signal;

                         // 5. Call API for the specific month
                         const monthTableHTML = await generateAiActionPlan(currentPlanSummary, signal, monthNum);

                         // 6. Update only the specific panel
                         panel.innerHTML = monthTableHTML;
                         makeTablesSortable(panel); // Re-apply sortability

                         // 7. Save only the regenerated month immediately
                         await saveActionPlan(true, parseInt(monthNum, 10));

                         // 8. Reset undo/redo history for the regenerated month
                          if(undoHistory[`month${monthNum}`]) { // Check array exists
                            undoHistory[`month${monthNum}`] = [panel.innerHTML];
                            redoHistory[`month${monthNum}`] = [];
                          }
                         updateUndoRedoButtons(); // Update button states

                         // 9. Restore footer button visibility after success
                         if (regenButton) regenButton.style.display = 'inline-flex';
                         if (printButton) printButton.style.display = 'inline-flex';
                         if (undoRedoContainer) undoRedoContainer.style.display = 'flex';


                     } catch (error) {
                          // Restore button visibility even on error/cancel
                          if (regenButton) regenButton.style.display = 'inline-flex';
                          // Only show print button if *any* plan exists after potential failure
                          const anyPlanExists = !!DOMElements.modalContent?.querySelector('.ai-tabs-content table');
                          if (printButton) printButton.style.display = anyPlanExists ? 'inline-flex' : 'none';
                          // Show undo/redo only if current panel has content (might be error message)
                          const activePanelHasContent = !!panel?.innerHTML.trim(); // Check if panel is empty after error
                          if (undoRedoContainer) undoRedoContainer.style.display = activePanelHasContent ? 'flex' : 'none';


                         if (error.name === 'AbortError') {
                              panel.innerHTML = `
                                 <div class="text-center p-8 flex flex-col items-center justify-center min-h-[300px]">
                                     <h3 class="font-bold text-lg text-gray-700">Generation Cancelled</h3>
                                     <button class="btn btn-primary generate-month-plan-btn mt-4" data-month="${monthNum}">
                                         <i class="bi bi-stars"></i>
                                         <span>Generate Month ${monthNum} Plan</span>
                                     </button>
                                 </div>`;
                         } else {
                             console.error(`Error regenerating AI plan for month ${monthNum}:`, error);
                             panel.innerHTML = `<div class="text-center p-8 text-red-600"><p class="font-semibold">Generation Failed</p><p class="text-sm">${error.message}</p><button class="btn btn-secondary mt-4 retry-generation-btn" data-month="${monthNum}">Retry</button></div>`;
                         }
                     } finally {
                         appState.aiPlanGenerationController = null;
                         // Ensure footer visibility is finally correct based on the potentially updated content
                         setTimeout(updateFooterButtonVisibility, 50); // Use helper
                     }
                 }, 50); // Delay ensures the main modal is likely ready
            }; // End onclick

            // Cancel button logic: close confirmation, ensure main modal is visible.
             DOMElements.modalCancelBtn.textContent = "Cancel";
             DOMElements.modalCancelBtn.onclick = () => {
                 closeModal(); // Only close the confirmation modal
                 // Re-open main modal to be safe, in case it somehow closed
                  setTimeout(() => openModal('aiActionPlan_view'), 50);
             };
            break; // End confirmRegenerate case
        }
        case 'confirmClose':
             // This case is no longer needed with real-time saving.
            closeModal();
            break;
        case 'confirmDeleteEvent':
             if (DOMElements.modalTitle) DOMElements.modalTitle.textContent = "Confirm Deletion"; // Check title element
            DOMElements.modalContent.innerHTML = `<p>Are you sure you want to permanently delete the event: <strong class="font-bold">${eventTitle || 'this event'}</strong>?</p><p class="mt-2 text-sm text-red-700 bg-red-100 p-3 rounded-lg">This action cannot be undone.</p>`;
            DOMElements.modalActionBtn.textContent = "Confirm Delete";
            DOMElements.modalActionBtn.className = 'btn btn-danger';
            break;
         case 'warning': // Added generic warning modal
             if (DOMElements.modalTitle) DOMElements.modalTitle.textContent = context.title || "Warning"; // Use context title
             DOMElements.modalContent.innerHTML = `<p>${context.message || 'An unexpected issue occurred.'}</p>`; // Use context message
             DOMElements.modalActionBtn.textContent = "OK";
             DOMElements.modalCancelBtn.style.display = 'none'; // Hide cancel button
             DOMElements.modalActionBtn.onclick = closeModal; // Simple close action
             break;
    }
     // Ensure overlay is visible only if modal content was successfully set up
     if (DOMElements.modalContent?.innerHTML || type === 'sharing' || type === 'aiActionPlan_generate') { // Include loading states
         DOMElements.modalOverlay?.classList.remove('hidden'); // Optional chaining
     } else if (!DOMElements.modalContent?.innerHTML && type !== 'sharing' && type !== 'aiActionPlan_generate') {
         console.warn(`Modal content for type '${type}' might be empty or setup failed.`); // Warn if content is empty unexpectedly
     }
}


export function closeModal() {
     // Check if essential elements exist
     if (!DOMElements.modalOverlay || !DOMElements.modalBox) {
         console.warn("Cannot close modal: Overlay or Box element missing.");
         return;
     }

    // Disconnect MutationObserver if it was attached for the AI modal
    if (DOMElements.modalBox.dataset.observerAttached === 'true') {
        const observerInstance = DOMElements.modalBox.observerInstance;
        if (observerInstance && typeof observerInstance.disconnect === 'function') {
            observerInstance.disconnect();
            console.log("MutationObserver disconnected.");
        }
         // Clean up dataset attributes and stored instance
        delete DOMElements.modalBox.dataset.observerAttached;
        delete DOMElements.modalBox.observerInstance;
    }
    DOMElements.modalOverlay.classList.add('hidden');

     // Clear content and reset dataset type to prevent state issues on re-open
     if(DOMElements.modalContent) DOMElements.modalContent.innerHTML = '';
     delete DOMElements.modalBox.dataset.type;
     delete DOMElements.modalBox.dataset.planId;

     // Ensure default footer button event listeners are reset (important!)
     const footer = DOMElements.modalActionBtn?.parentNode; // Optional chaining
     if (footer && DOMElements.modalActionBtn && DOMElements.modalCancelBtn) { // Check if buttons exist before cloning
         // Re-clone and replace to remove specific listeners from this modal instance
         const actionBtnClone = DOMElements.modalActionBtn.cloneNode(true);
         const cancelBtnClone = DOMElements.modalCancelBtn.cloneNode(true);
         DOMElements.modalActionBtn.replaceWith(actionBtnClone);
         DOMElements.modalCancelBtn.replaceWith(cancelBtnClone);
         // Re-select and re-attach general listeners
         DOMElements.modalActionBtn = footer.querySelector('.btn-primary');
         DOMElements.modalCancelBtn = footer.querySelector('.btn-secondary');
         if(DOMElements.modalActionBtn) DOMElements.modalActionBtn.addEventListener('click', handleModalAction);
         if(DOMElements.modalCancelBtn) DOMElements.modalCancelBtn.addEventListener('click', requestCloseModal);
     }
}


// --- Main Initializer ---

export function initializeUI(database, state) {
    db = database;
    appState = state;

    // Gracefully handle if elements are not found (e.g., on different pages)
     // Find close button within the modal box for reliability
     // Note: This listener is added/re-added dynamically in openModal now
     // const modalCloseBtn = DOMElements.modalBox?.querySelector('#modal-close-btn');
     // if (modalCloseBtn) {
     //     modalCloseBtn.addEventListener('click', requestCloseModal);
     // }

     if(DOMElements.modalOverlay){
        DOMElements.modalOverlay.addEventListener('mousedown', (e) => {
             // Ensure it's the overlay itself being clicked, not content within the modal box
            if (e.target === DOMElements.modalOverlay) {
                requestCloseModal();
            }
        });
     }

    if (DOMElements.mobileMenuBtn && DOMElements.appView && DOMElements.sidebarOverlay) {
        DOMElements.mobileMenuBtn.addEventListener('click', () => DOMElements.appView.classList.toggle('sidebar-open'));
        DOMElements.sidebarOverlay.addEventListener('click', () => DOMElements.appView.classList.remove('sidebar-open'));
    }

    // Swipe gestures (keep as is, ensure elements exist)
    if (DOMElements.mainContent && DOMElements.appView) {
        let touchStartX = 0;
        const swipeThreshold = 50;
        DOMElements.mainContent.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
        DOMElements.mainContent.addEventListener('touchend', e => { if (e.changedTouches[0].screenX > touchStartX + swipeThreshold) { DOMElements.appView.classList.add('sidebar-open'); } });
    }
    if (DOMElements.sidebar && DOMElements.appView) {
         let touchStartX = 0; // Declare locally
         const swipeThreshold = 50; // Declare locally
        DOMElements.sidebar.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
        DOMElements.sidebar.addEventListener('touchend', e => { if (e.changedTouches[0].screenX < touchStartX - swipeThreshold) { DOMElements.appView.classList.remove('sidebar-open'); } });
    }

    // Radial Menu (keep as is, ensure elements exist)
    if (DOMElements.radialMenuContainer && DOMElements.radialMenuFab && DOMElements.radialMenuOverlay) {
        DOMElements.radialMenuFab.addEventListener('click', () => DOMElements.radialMenuContainer.classList.toggle('open'));
        DOMElements.radialMenuOverlay.addEventListener('click', () => DOMElements.radialMenuContainer.classList.remove('open'));
    }

    // Cookie Consent (keep as is, ensure elements exist)
    if (DOMElements.cookieBanner && DOMElements.acceptBtn && DOMElements.declineBtn) {
        if (localStorage.getItem('gails_cookie_consent') === null) {
            DOMElements.cookieBanner.classList.remove('hidden');
        }
        DOMElements.acceptBtn.addEventListener('click', () => { localStorage.setItem('gails_cookie_consent', 'true'); DOMElements.cookieBanner.classList.add('hidden'); });
        DOMElements.declineBtn.addEventListener('click', () => { localStorage.setItem('gails_cookie_consent', 'false'); DOMElements.cookieBanner.classList.add('hidden'); });
    }

    // Chat Input Auto-Resize (keep as is, ensure element exists)
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('input', () => {
            chatInput.style.height = 'auto'; // Reset height
            // Calculate scroll height but cap it to prevent excessive growth
            const newHeight = Math.min(chatInput.scrollHeight, 150); // Cap at 150px for example
            chatInput.style.height = `${newHeight}px`;
            // Add overflow handling if content exceeds max height
            chatInput.style.overflowY = (newHeight >= 150) ? 'auto' : 'hidden';
        });
    }


    // File Viewer Modal Listeners (keep as is, ensure elements exist)
    if (DOMElements.fileModal && DOMElements.fileModalCloseBtn) {
        DOMElements.fileModalCloseBtn.addEventListener('click', () => {
            DOMElements.fileModal.classList.add('hidden');
            // Clear content when closing
             if (DOMElements.fileModalContent) DOMElements.fileModalContent.innerHTML = '';
        });
        DOMElements.fileModal.addEventListener('click', (e) => {
            if (e.target === DOMElements.fileModal) {
                DOMElements.fileModal.classList.add('hidden');
                 // Clear content when closing
                 if (DOMElements.fileModalContent) DOMElements.fileModalContent.innerHTML = '';
            }
        });
    }
}
