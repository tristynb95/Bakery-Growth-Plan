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
