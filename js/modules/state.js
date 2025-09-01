export const appState = {
    planData: {},
    currentUser: null,
    currentPlanId: null,
    currentView: 'vision',
    saveTimeout: null,
    sessionTimeout: null,
    planUnsubscribe: null,
    calendarUnsubscribe: null,
    aiPlanGenerationController: null,
    calendar: {
        currentDate: new Date(),
        data: {},
        editingEventIndex: null
    }
};

export let undoStack = [];
export let redoStack = [];

// Functions to modify the stacks, because direct import and reassignment of 'let' variables won't work.
export function setUndoStack(newStack) {
    undoStack = newStack;
}

export function setRedoStack(newStack) {
    redoStack = newStack;
}
