// js/chat.js

import { getGeminiChatResponse } from './api.js';
import { summarizePlanForAI } from './plan-view.js';

let appState;
let db;
let chatHistory = [];

const DOMElements = {
    modal: document.getElementById('gemini-chat-modal'),
    modalBox: document.querySelector('#gemini-chat-modal .chat-modal-box'),
    header: document.getElementById('chat-modal-header'),
    closeBtn: document.getElementById('chat-modal-close-btn'),
    optionsBtn: document.getElementById('chat-options-btn'),
    conversationView: document.getElementById('chat-conversation-area'),
    welcomeScreen: document.getElementById('chat-welcome-screen'),
    chatInput: document.getElementById('chat-input'),
    sendBtn: document.getElementById('chat-send-btn'),
    historyPanel: document.getElementById('chat-history-panel'),
    historyList: document.getElementById('history-list'),
    backToChatBtn: document.getElementById('back-to-chat-btn'),
};

function makeDraggable(modal, handle) {
    let offsetX, offsetY, isDragging = false;

    const onMouseDown = (e) => {
        if (e.button !== 0 || e.target.closest('button')) return;
        isDragging = true;
        const modalRect = modal.getBoundingClientRect();
        modal.style.position = 'absolute';
        modal.style.left = `${modalRect.left}px`;
        modal.style.top = `${modalRect.top}px`;
        modal.style.margin = '0';
        offsetX = e.clientX - modal.offsetLeft;
        offsetY = e.clientY - modal.offsetTop;
        modal.classList.add('is-dragging');
        document.body.style.userSelect = 'none';
    };
    const onMouseMove = (e) => {
        if (!isDragging) return;
        let newX = e.clientX - offsetX;
        let newY = e.clientY - offsetY;
        const parentRect = modal.offsetParent.getBoundingClientRect();
        newX = Math.max(0, Math.min(newX, parentRect.width - modal.offsetWidth));
        newY = Math.max(0, Math.min(newY, parentRect.height - modal.offsetHeight));
        modal.style.left = `${newX}px`;
        modal.style.top = `${newY}px`;
    };
    const onMouseUp = () => {
        isDragging = false;
        modal.classList.remove('is-dragging');
        document.body.style.userSelect = '';
    };
    handle.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function closeChatModal() {
    if (DOMElements.modal) {
        DOMElements.modal.classList.add('hidden');
        if (DOMElements.modalBox) {
            DOMElements.modalBox.removeAttribute('style');
        }
    }
}

/**
 * Adds a message bubble to the conversation UI. Purely a UI function.
 */
function addMessageToUI(sender, text, isLoading = false) {
    DOMElements.welcomeScreen.classList.add('hidden');
    DOMElements.historyPanel.classList.add('hidden');
    DOMElements.conversationView.classList.remove('hidden');

    const wrapper = document.createElement('div');
    wrapper.className = `chat-message-wrapper justify-${sender === 'user' ? 'end' : 'start'}`;
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender === 'user' ? 'user-bubble' : 'ai-bubble'}`;
    
    if (isLoading) {
        bubble.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
    } else {
        bubble.textContent = text;
    }
    
    wrapper.appendChild(bubble);
    DOMElements.conversationView.appendChild(wrapper);
    DOMElements.conversationView.scrollTop = DOMElements.conversationView.scrollHeight;
}

/**
 * Replaces the typing indicator with the final AI response text.
 */
function updateLastAiMessageInUI(text) {
    const lastBubble = DOMElements.conversationView.querySelector('.ai-bubble:last-child');
    if (lastBubble) {
        lastBubble.innerHTML = ''; // Remove typing indicator
        lastBubble.textContent = text;
    }
}

/**
 * Saves a single message object to the Firestore database.
 * @param {{role: string, text: string}} messageObject
 */
async function saveMessage(messageObject) {
    if (!appState.currentUser || !appState.currentPlanId || !db) return;

    try {
        const historyRef = db.collection('users').doc(appState.currentUser.uid)
                             .collection('plans').doc(appState.currentPlanId)
                             .collection('chatHistory');
        
        await historyRef.add({
            ...messageObject,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error("Error saving chat message:", error);
        // Optionally, add UI feedback that the message failed to save.
    }
}

/**
 * The main function to process sending a message from the user.
 */
async function handleSendMessage() {
    const messageText = DOMElements.chatInput.value.trim();
    if (!messageText) return;

    // 1. Optimistically update UI and local state
    const userMessage = { role: 'user', parts: [{ text: messageText }] };
    chatHistory.push(userMessage);
    addMessageToUI('user', messageText);
    saveMessage({ role: 'user', text: messageText }); // Save user message in the background

    // 2. Clear input and show loading indicator
    DOMElements.chatInput.value = '';
    DOMElements.chatInput.style.height = 'auto';
    addMessageToUI('model', '', true);

    try {
        // 3. Get context and call API
        const planSummary = summarizePlanForAI(appState.planData);
        const responseText = await getGeminiChatResponse(planSummary, chatHistory, messageText);
        
        // 4. Update UI and local state with response
        updateLastAiMessageInUI(responseText);
        const aiMessage = { role: 'model', parts: [{ text: responseText }] };
        chatHistory.push(aiMessage);
        saveMessage({ role: 'model', text: responseText }); // Save AI message in the background

    } catch (error) {
        console.error("Chat error:", error);
        const errorMessage = error.message || 'Sorry, I encountered an error. Please try again.';
        updateLastAiMessageInUI(errorMessage);
    }
}

/**
 * Loads previous messages from Firestore for the current plan.
 */
async function loadChatHistory() {
    if (!appState.currentUser || !appState.currentPlanId || !db) {
        showConversationView(); // Show welcome screen if no context
        return;
    }

    const historyRef = db.collection('users').doc(appState.currentUser.uid)
                         .collection('plans').doc(appState.currentPlanId)
                         .collection('chatHistory')
                         .orderBy('timestamp', 'asc'); // Fetch in chronological order
    
    try {
        const snapshot = await historyRef.get();
        if (snapshot.empty) {
            showConversationView(); // No history, show welcome screen
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            chatHistory.push({ role: data.role, parts: [{ text: data.text }] });
            addMessageToUI(data.role, data.text);
        });
    } catch (error) {
        console.error("Error loading chat history:", error);
        addMessageToUI('model', 'Could not load previous messages.');
    }
}


// --- View Management ---

function showConversationView() {
    DOMElements.historyPanel.classList.add('hidden');
    DOMElements.conversationView.classList.remove('hidden');
    if (chatHistory.length === 0) {
        DOMElements.welcomeScreen.classList.remove('hidden');
        DOMElements.conversationView.classList.add('hidden');
    }
}

function showHistoryView() {
    DOMElements.welcomeScreen.classList.add('hidden');
    DOMElements.conversationView.classList.add('hidden');
    DOMElements.historyPanel.classList.remove('hidden');
    
    DOMElements.historyList.innerHTML = '<div class="loading-spinner mx-auto mt-8"></div>';
    // Placeholder for actual history rendering from DB
    setTimeout(() => {
        DOMElements.historyList.innerHTML = `<div class="p-4 text-center text-gray-500">Feature to view and load past conversations is coming soon.</div>`;
    }, 500);
}

export function openChat() {
    if (DOMElements.modal) {
        // Reset local state and UI before loading new history
        chatHistory = [];
        DOMElements.conversationView.innerHTML = '';
        DOMElements.modal.classList.remove('hidden');
        DOMElements.chatInput.focus();
        loadChatHistory();
    }
}


export function initializeChat(_appState, _db) {
    appState = _appState;
    db = _db;

    if (!DOMElements.modal) return;

    makeDraggable(DOMElements.modalBox, DOMElements.header);
    DOMElements.closeBtn.addEventListener('click', closeChatModal);
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !DOMElements.modal.classList.contains('hidden')) {
            closeChatModal();
        }
    });

    DOMElements.sendBtn.addEventListener('click', handleSendMessage);
    DOMElements.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    DOMElements.welcomeScreen.addEventListener('click', (e) => {
        const card = e.target.closest('.prompt-starter-card');
        if (card) {
            const promptText = card.querySelector('p:last-child').textContent.replace(/"/g, '');
            DOMElements.chatInput.value = promptText;
            DOMElements.chatInput.focus();
            handleSendMessage();
        }
    });
    
    DOMElements.optionsBtn.addEventListener('click', showHistoryView);
    DOMElements.backToChatBtn.addEventListener('click', showConversationView);
}
