import { DOMElements } from './dom.js';
import { appState } from './state.js';
import { db, firebase } from './firebase.js';
import { handleSelectPlan, renderDashboard } from './ui.js';
import { handleAIActionPlan, saveActionPlan, handleRegenerateActionPlan, undo, redo, updateUndoRedoButtons, setupAiModalInteractivity } from './ai.js';
import { saveData } from './api.js';

function requestCloseModal() {
    const modalType = DOMElements.modalBox.dataset.type;

    if (modalType === 'aiActionPlan_generate' && appState.aiPlanGenerationController) {
        appState.aiPlanGenerationController.abort();
    }

    const isAiModal = modalType === 'aiActionPlan_view';
    // This needs to import undoStack from state.js
    // For now, I'll assume it's globally available, and fix later.
    // const hasUnsavedChanges = undoStack.length > 1;
    const hasUnsavedChanges = false; // Placeholder
    if (isAiModal && hasUnsavedChanges) {
        openModal('confirmClose');
    } else {
        closeModal();
    }
}

export function closeModal() {
    document.querySelectorAll('.dynamic-btn').forEach(btn => btn.remove());
    DOMElements.modalActionBtn.onclick = null;
    DOMElements.modalCancelBtn.onclick = null;
    DOMElements.modalActionBtn.style.display = 'inline-flex';
    DOMElements.modalOverlay.classList.add('hidden');
}

async function handleModalAction() {
    const type = DOMElements.modalBox.dataset.type;
    const planId = DOMElements.modalBox.dataset.planId;
    if (type === 'timeout') {
        closeModal();
        return;
    }
    switch(type) {
        case 'create':
            const newPlanNameInput = document.getElementById('newPlanName');
            const newPlanName = newPlanNameInput.value.trim();
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
                   errorContainer.innerHTML = `<p class="auth-error" style="display:block; margin: 0; width: 100%;">A plan with this name already exists. Please choose another.</p>`;
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
                const newPlan = await plansRef.add({
                    planName: newPlanName,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastEdited: firebase.firestore.FieldValue.serverTimestamp(),
                    managerName: ''
                });
                await handleSelectPlan(newPlan.id);
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
                    await renderDashboard();
                } catch (error) { console.error("Error updating plan name:", error); }
            }
            closeModal();
            break;
        case 'delete':
            try {
                await db.collection('users').doc(appState.currentUser.uid).collection('plans').doc(planId).delete();
                await renderDashboard();
            } catch (error) { console.error("Error deleting plan:", error); }
            closeModal();
            break;
    }
}

export function openModal(type, context = {}) {
    const { planId, currentName, planName } = context;
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
            DOMElements.modalContent.innerHTML = `<div class="flex items-center justify-center p-8"><div class="loading-spinner"></div><p class="ml-4 text-gray-600">Generating secure shareable link...</p></div>`;
            DOMElements.modalActionBtn.style.display = 'none';
            DOMElements.modalCancelBtn.textContent = 'Cancel';
            break;
        case 'aiActionPlan_generate':
            DOMElements.modalTitle.textContent = "Generating AI Action Plan";
            DOMElements.modalContent.innerHTML = `<div class="flex flex-col items-center justify-center p-8"><div class="loading-spinner"></div><p class="mt-4 text-gray-600">Please wait, the AI is creating your plan...</p></div>`;
            DOMElements.modalActionBtn.style.display = 'none';
            DOMElements.modalCancelBtn.style.display = 'inline-flex';
            DOMElements.modalCancelBtn.textContent = 'Cancel';
            break;
        case 'aiActionPlan_view': {
            DOMElements.modalTitle.textContent = "Edit Your Action Plan";
            footer.style.justifyContent = 'space-between';

            const undoRedoContainer = document.createElement('div');
            undoRedoContainer.className = 'undo-redo-container dynamic-btn';
            const undoBtn = document.createElement('button');
            undoBtn.id = 'undo-btn';
            undoBtn.className = 'btn btn-secondary btn-icon';
            undoBtn.title = 'Undo';
            undoBtn.innerHTML = `<i class="bi bi-arrow-counterclockwise"></i>`;
            undoBtn.onclick = undo;
            const redoBtn = document.createElement('button');
            redoBtn.id = 'redo-btn';
            redoBtn.className = 'btn btn-secondary btn-icon';
            redoBtn.title = 'Redo';
            redoBtn.innerHTML = `<i class="bi bi-arrow-clockwise"></i>`;
            redoBtn.onclick = redo;
            undoRedoContainer.appendChild(undoBtn);
            undoRedoContainer.appendChild(redoBtn);
            footer.insertBefore(undoRedoContainer, footer.firstChild);

            const regenButton = document.createElement('button');
            regenButton.id = 'modal-regen-btn';
            regenButton.className = 'btn btn-secondary dynamic-btn';
            regenButton.innerHTML = `<i class="bi bi-stars"></i> Generate New`;
            regenButton.onclick = handleRegenerateActionPlan;

            const printBtn = document.createElement('button');
            printBtn.id = 'modal-print-btn';
            printBtn.className = 'btn btn-secondary dynamic-btn';
            printBtn.innerHTML = `<i class="bi bi-printer-fill"></i> Print Plan`;
            printBtn.onclick = () => {
                const aiPlanContainer = document.getElementById('ai-printable-area');
                const activeTabPanel = aiPlanContainer.querySelector('.ai-tabs-content > div.active');
                const activeTabButton = aiPlanContainer.querySelector('.ai-tabs-nav .ai-tab-btn.active');
                if (!activeTabPanel || !activeTabButton) {
                    alert("Could not find the active month to print.");
                    return;
                }
                const monthTitle = `${activeTabButton.textContent}`;
                const printNode = activeTabPanel.cloneNode(true);
                printNode.querySelectorAll('.actions-cell, .btn-remove-row, tfoot').forEach(el => el.remove());
                const printableHTML = printNode.innerHTML;
                const printStyles = `
                    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Poppins:wght@700;900&display=swap');
                    @page { size: A4; margin: 25mm; }
                    body { font-family: 'DM Sans', sans-serif; color: #1F2937; }
                    .print-header { text-align: center; border-bottom: 2px solid #D10A11; padding-bottom: 15px; margin-bottom: 25px; }
                    .print-header h1 { font-family: 'Poppins', sans-serif; font-size: 24pt; color: #1F2937; margin: 0; }
                    .print-header h2 { font-family: 'Poppins', sans-serif; font-size: 16pt; color: #D10A11; margin-top: 5px; margin-bottom: 5px; font-weight: 700; }
                    .print-header p { font-size: 11pt; color: #6B7280; margin: 5px 0 0; }
                    table { width: 100%; border-collapse: collapse; font-size: 9pt; page-break-inside: auto; }
                    tr { page-break-inside: avoid; page-break-after: auto; }
                    th, td { border: 1px solid #E5E7EB; padding: 10px 12px; text-align: left; vertical-align: top; }
                    thead { display: table-header-group; }
                    th { background-color: #F9FAFB; font-weight: 600; color: #374151; }
                    th.actions-cell, td.actions-cell { display: none !important; }`;
                const printWindow = window.open('', '', 'height=800,width=1200');
                printWindow.document.write(`<html><head><title>Our Action Plan</title><style>${printStyles}</style></head><body>`);
                printWindow.document.write(`<div class="print-header"><h1>${monthTitle}</h1><h2>Our Bakery Action Plan</h2><p>${appState.planData.planName || 'Growth Plan'} | ${appState.planData.bakeryLocation || 'Your Bakery'}</p></div>`);
                printWindow.document.write(printableHTML);
                printWindow.document.write('</body></html>');
                printWindow.document.close();
                setTimeout(() => { printWindow.print(); }, 500);
            };

            DOMElements.modalActionBtn.textContent = "Save Changes";
            DOMElements.modalActionBtn.onclick = saveActionPlan;
            footer.insertBefore(regenButton, DOMElements.modalActionBtn);
            footer.insertBefore(printBtn, DOMElements.modalActionBtn);
            DOMElements.modalCancelBtn.style.display = 'none';
            updateUndoRedoButtons();
            break;
        }
        case 'confirmRegenerate':
            DOMElements.modalTitle.textContent = "Are you sure?";
            DOMElements.modalContent.innerHTML = `<p class="text-gray-600">Generating a new plan will overwrite your existing action plan and any edits you've made. This cannot be undone.</p>`;
            DOMElements.modalActionBtn.textContent = "Yes, Generate New";
            DOMElements.modalActionBtn.className = 'btn btn-primary bg-red-600 hover:bg-red-700';
            DOMElements.modalActionBtn.onclick = () => {
                delete appState.planData.aiActionPlan;
                saveData(true).then(() => { handleAIActionPlan(); });
            };
            DOMElements.modalCancelBtn.textContent = "Cancel";
            DOMElements.modalCancelBtn.onclick = () => {
                openModal('aiActionPlan_view');
                const modalContent = document.getElementById('modal-content');
                const lastUnsavedState = undoStack.length > 0 ? undoStack[undoStack.length - 1] : appState.planData.aiActionPlan || '';
                modalContent.innerHTML = `<div id="ai-printable-area" class="editable-action-plan">${lastUnsavedState}</div>`;
                setupAiModalInteractivity(modalContent.querySelector('#ai-printable-area'));
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
                const lastUnsavedState = undoStack[undoStack.length - 1];
                const modalContent = document.getElementById('modal-content');
                modalContent.innerHTML = `<div id="ai-printable-area" class="editable-action-plan">${lastUnsavedState}</div>`;
                setupAiModalInteractivity(modalContent.querySelector('#ai-printable-area'));
                updateUndoRedoButtons();
            };
            break;
    }
    DOMElements.modalOverlay.classList.remove('hidden');
}
