import { appState, undoStack, redoStack, setUndoStack, setRedoStack } from './state.js';
import { saveData } from './api.js';
import { openModal } from './modal.js';
import { parseUkDate } from '../utils.js'; // I'll create a utils.js file for this

/**
 * Summarizes the current plan data into a text format for the AI.
 * @param {object} planData - The plan data object.
 * @returns {string} A string summary of the plan.
 */
export function summarizePlanForAI(planData) {
    const e = (text) => {
        if (!text) return '';
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = text;
        return tempDiv.innerText.trim();
    };
    let summary = `QUARTERLY NARRATIVE: ${e(planData.quarterlyTheme)}\n\n`;
    for (let m = 1; m <= 3; m++) {
        summary += `--- MONTH ${m} ---\n`;
        summary += `GOAL: ${e(planData[`month${m}Goal`])}\n`;
        summary += `MUST-WIN BATTLE: ${e(planData[`m${m}s1_battle`])}\n`;
        summary += `KEY ACTIONS: ${e(planData[`m${m}s2_levers`])}\n`;
        summary += `DEVELOPING OUR BREADHEADS: ${e(planData[`m${m}s3_people`])}\n`;
        summary += `PROTECT THE CORE (PEOPLE): ${e(planData[`m${m}s4_people`])}\n`;
        summary += `PROTECT THE CORE (PRODUCT): ${e(planData[`m${m}s4_product`])}\n`;
        summary += `PROTECT THE CORE (CUSTOMER): ${e(planData[`m${m}s4_customer`])}\n`;
        summary += `PROTECT THE CORE (PLACE): ${e(planData[`m${m}s4_place`])}\n\n`;
    }
    return summary;
}

export function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if (undoBtn) undoBtn.disabled = undoStack.length <= 1;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

export function saveState() {
    const printableArea = document.getElementById('ai-printable-area');
    if (printableArea) {
        const newStack = [...undoStack, printableArea.innerHTML];
        setUndoStack(newStack);
        setRedoStack([]); // Clear redo stack on new action
        updateUndoRedoButtons();
    }
}

export function undo() {
    if (undoStack.length > 1) {
        const currentState = undoStack.pop();
        setRedoStack([currentState, ...redoStack]);
        const previousState = undoStack[undoStack.length - 1];
        document.getElementById('ai-printable-area').innerHTML = previousState;
        updateUndoRedoButtons();
    }
}

export function redo() {
    if (redoStack.length > 0) {
        const nextState = redoStack.shift();
        setUndoStack([...undoStack, nextState]);
        document.getElementById('ai-printable-area').innerHTML = nextState;
        updateUndoRedoButtons();
    }
}

export function setupAiModalInteractivity(container) {
    if (!container) return;
    const makeTablesSortable = (container) => {
        const tables = container.querySelectorAll('table');
        tables.forEach(table => {
            const headers = table.querySelectorAll('thead th');
            const sortableColumns = {
                'Action Step': { index: 0, type: 'text' },
                'Pillar': { index: 1, type: 'text' },
                'Owner': { index: 2, type: 'text' },
                'Due Date': { index: 3, type: 'date' },
                'Status': { index: 5, type: 'text' }
            };
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
        table.querySelectorAll('.sortable-header').forEach(th => {
            th.removeAttribute('data-sort-dir');
        });
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
                if (dateA && dateB) {
                    compareResult = dateA.getTime() - dateB.getTime();
                } else if (dateA && !dateB) {
                    compareResult = -1;
                } else if (!dateA && dateB) {
                    compareResult = 1;
                } else {
                    compareResult = 0;
                }
            } else {
                compareResult = valA.localeCompare(valB, undefined, {numeric: true});
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
                newRow.innerHTML = `
                    <td contenteditable="true"></td>
                    <td contenteditable="true"></td>
                    <td contenteditable="true"></td>
                    <td contenteditable="true"></td>
                    <td contenteditable="true"></td>
                    <td contenteditable="true"></td>
                    <td class="actions-cell"><button class="btn-remove-row"><i class="bi bi-trash3"></i></button></td>
                `;
                tableBody.appendChild(newRow);
                saveState();
            }
        }
        if (removeBtn) {
            removeBtn.closest('tr').remove();
            saveState();
        }
        if (tab) {
            if (tab.classList.contains('active')) return;
            const tabContainer = tab.closest('.ai-action-plan-container');
            const tabs = tabContainer.querySelectorAll('.ai-tab-btn');
            const panels = tabContainer.querySelectorAll('.ai-tabs-content > div');
            tabs.forEach(t => t.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const targetPanel = tabContainer.querySelector(`[data-tab-panel="${tab.dataset.tab}"]`);
            if (targetPanel) targetPanel.classList.add('active');
        }
        if (sortHeader) {
            handleTableSort(sortHeader);
        }
    });
    const observer = new MutationObserver((mutations) => {
        const isTextChange = mutations.some(m => m.type === 'characterData');
        if (isTextChange) {
           saveState();
        }
    });
    observer.observe(container, {
        childList: false,
        subtree: true,
        characterData: true
    });
}

/**
 * Handles the main logic for generating or viewing an AI Action Plan.
 */
export async function handleAIActionPlan() {
    const savedPlan = appState.planData.aiActionPlan;
    if (savedPlan) {
        openModal('aiActionPlan_view');
        const modalContent = document.getElementById('modal-content');
        modalContent.innerHTML = `<div id="ai-printable-area" class="editable-action-plan">${savedPlan}</div>`;
        setUndoStack([]);
        setRedoStack([]);
        saveState();
        setupAiModalInteractivity(modalContent.querySelector('#ai-printable-area'));
    } else {
        if (appState.aiPlanGenerationController) {
            appState.aiPlanGenerationController.abort();
        }
        openModal('aiActionPlan_generate');
        try {
            appState.aiPlanGenerationController = new AbortController();
            const signal = appState.aiPlanGenerationController.signal;

            const planSummary = summarizePlanForAI(appState.planData);
            const response = await fetch('/.netlify/functions/generate-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planSummary }),
                signal: signal
            });

            if (!response.ok) {
                let errorResult;
                try {
                    errorResult = await response.json();
                } catch (e) {
                    throw new Error(response.statusText || 'The AI assistant failed to respond.');
                }
                throw new Error(errorResult.error || 'The AI assistant failed to generate a response.');
            }
            const textResponse = await response.text();
            if (!textResponse) {
                throw new Error("The AI assistant returned an empty plan. Please try regenerating.");
            }
            const data = JSON.parse(textResponse);
            const cleanedHTML = data.actionPlan.replace(/^```(html)?\s*/, '').replace(/```$/, '').trim();
            appState.planData.aiActionPlan = cleanedHTML;
            await saveData(true);
            handleAIActionPlan();
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('AI plan generation was cancelled by the user.');
                return;
            }
            console.error("Error generating AI plan:", error);
            const modalContent = document.getElementById('modal-content');
            modalContent.innerHTML = `<p class="text-red-600 font-semibold">An error occurred.</p><p class="text-gray-600 mt-2 text-sm">${error.message}</p>`;
            const modalActionBtn = document.getElementById('modal-action-btn');
            const modalCancelBtn = document.getElementById('modal-cancel-btn');
            modalActionBtn.style.display = 'none';
            modalCancelBtn.textContent = 'Close';
        } finally {
            appState.aiPlanGenerationController = null;
        }
    }
}

/**
 * Saves the current state of the AI action plan to Firestore.
 */
export async function saveActionPlan() {
    const editedContent = document.getElementById('ai-printable-area').innerHTML;
    const saveButton = document.getElementById('modal-action-btn');
    const originalHTML = saveButton.innerHTML;
    saveButton.disabled = true;
    saveButton.innerHTML = `<i class="bi bi-check-circle-fill"></i> Saved!`;
    await saveData(true, { aiActionPlan: editedContent });
    const printableArea = document.getElementById('ai-printable-area');
    if (printableArea) {
        setUndoStack([editedContent]);
        setRedoStack([]);
        updateUndoRedoButtons();
    }
    setTimeout(() => {
        saveButton.disabled = false;
        saveButton.innerHTML = originalHTML;
    }, 2000);
}

/**
 * Initiates the process to regenerate the AI action plan.
 */
export function handleRegenerateActionPlan() {
    openModal('confirmRegenerate');
}
