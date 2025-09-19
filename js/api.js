// js/api.js

/**
 * Fetches the Firebase configuration from the backend.
 * This is a secure way to get your secret keys to the browser.
 */
export async function getFirebaseConfig() {
    const response = await fetch('/.netlify/functions/config');
    if (!response.ok) {
        throw new Error('Could not fetch Firebase configuration.');
    }
    return response.json();
}

/**
 * Sends the plan summary to the backend to generate an AI Action Plan.
 * @param {string} planSummary - A text summary of the user's plan.
 * @param {AbortSignal} signal - Allows the request to be cancelled.
 * @returns {Promise<string>} The HTML for the action plan.
 */
export async function generateAiActionPlan(planSummary, signal) {
    const response = await fetch('/.netlify/functions/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planSummary }),
        signal: signal // This allows us to cancel the request if needed
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

    const data = await response.json();
    // Clean the response to remove any markdown backticks
    return data.actionPlan.replace(/^```(html)?\s*/, '').replace(/```$/, '').trim();
}

/**
 * Sends the current chat context to the backend for an AI response.
 * @param {string} planSummary - A text summary of the user's plan.
 * @param {Array} chatHistory - An array of previous chat messages.
 * @param {string} userMessage - The new message from the user.
 * @param {object} calendarData - The user's calendar data.
 * @param {Array} availableFiles - An array of available file metadata ({id, name, type}).
 * @returns {Promise<string>} The AI's text response.
 */
export async function getGeminiChatResponse(planSummary, chatHistory, userMessage, calendarData, availableFiles) {
    const response = await fetch('/.netlify/functions/generate-chat-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planSummary, chatHistory, userMessage, calendarData, availableFiles }),
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

    const data = await response.json();
    return data.response;
}