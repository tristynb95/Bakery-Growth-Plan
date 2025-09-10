// js/chat.js AI MODAL

import { getGeminiChatResponse } from './api.js';
import { summarizePlanForAI } from './plan-view.js';
import { openModal } from './ui.js';

let appState;
let db;
let chatHistory = [];
let currentConversationId = null;

const DOMElements = {
    modal: document.getElementById('gemini-chat-modal'),
    modalBox: document.querySelector('#gemini-chat-modal .chat-modal-box'),
    header: document.getElementById('chat-modal-header'),
    closeBtn: document.getElementById('chat-modal-close-btn'),
    optionsBtn: document.getElementById('chat-options-btn'),
    newChatBtn: document.getElementById('chat-new-btn'),
    conversationView: document.getElementById('chat-conversation-area'),
    welcomeScreen: document.getElementById('chat-welcome-screen'),
    chatInput: document.getElementById('chat-input'),
    sendBtn: document.getElementById('chat-send-btn'),
    historyPanel: document.getElementById('chat-history-panel'),
    historyList: document.getElementById('history-list'),
};

function scrollToMessage() {
    const container = DOMElements.conversationView;
    container.scrollTop = container.scrollHeight;
}

function closeChatModal() {
    if (DOMElements.modal) {
        DOMElements.modal.classList.add('hidden');
    }
}

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
    scrollToMessage();
}

function updateLastAiMessageInUI(text) {
    const allAiBubbles = DOMElements.conversationView.querySelectorAll('.ai-bubble');
    if (allAiBubbles.length > 0) {
        const lastBubble = allAiBubbles[allAiBubbles.length - 1];
        lastBubble.innerHTML = '';
        lastBubble.textContent = text;
        scrollToMessage();
    }
}

function startNewConversation() {
    currentConversationId = null;
    chatHistory = [];
    sessionStorage.removeItem('gails_lastConversationId'); // Forget the last chat
    DOMElements.conversationView.innerHTML = '';
    showConversationView();
}

async function saveMessage(messageObject) {
    if (!appState.currentUser || !appState.currentPlanId || !db) return;
    
    const conversationsRef = db.collection('users').doc(appState.currentUser.uid)
                               .collection('plans').doc(appState.currentPlanId)
                               .collection('conversations');

    if (!currentConversationId) {
        const conversationDocRef = conversationsRef.doc();
        currentConversationId = conversationDocRef.id;
        // Save the new ID to the session so it's remembered on refresh
        sessionStorage.setItem('gails_lastConversationId', currentConversationId);
        await conversationDocRef.set({
            firstMessage: messageObject.text,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    const messageRef = conversationsRef.doc(currentConversationId).collection('messages');
    
    try {
        await messageRef.add({
            ...messageObject,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error("Error saving chat message:", error);
    }
}

async function handleSendMessage() {
    const messageText = DOMElements.chatInput.value.trim();
    if (!messageText) return;

    const userMessage = { role: 'user', parts: [{ text: messageText }] };
    chatHistory.push(userMessage);
    addMessageToUI('user', messageText);
    saveMessage({ role: 'user', text: messageText });

    const initialHeight = DOMElements.chatInput.scrollHeight;
    DOMElements.chatInput.value = '';
    DOMElements.chatInput.style.height = `${initialHeight}px`;
    addMessageToUI('model', '', true);

    try {
        const planSummary = summarizePlanForAI(appState.planData);
        const responseText = await getGeminiChatResponse(planSummary, chatHistory, messageText);
        
        updateLastAiMessageInUI(responseText);
        const aiMessage = { role: 'model', parts: [{ text: responseText }] };
        chatHistory.push(aiMessage);
        saveMessage({ role: 'model', text: responseText });

    } catch (error) {
        console.error("Chat error:", error);
        const errorMessage = error.message || 'Sorry, I encountered an error. Please try again.';
        updateLastAiMessageInUI(errorMessage);
    }
}

async function loadChatHistory(conversationId) {
    if (!appState.currentUser || !appState.currentPlanId || !db) return;

    // --- Start of Fix ---

    // 1. Immediately clear the UI to provide instant feedback.
    DOMElements.conversationView.innerHTML = '';
    
    currentConversationId = conversationId;
    sessionStorage.setItem('gails_lastConversationId', conversationId);

    const messagesRef = db.collection('users').doc(appState.currentUser.uid)
                          .collection('plans').doc(appState.currentPlanId)
                          .collection('conversations').doc(conversationId)
                          .collection('messages')
                          .orderBy('timestamp', 'asc');
    try {
        const snapshot = await messagesRef.get();

        // 2. Build the new history in a temporary local array first.
        const newHistory = [];
        const fragment = document.createDocumentFragment();

        snapshot.forEach(doc => {
            const data = doc.data();
            // Add to the temporary history array
            newHistory.push({ role: data.role, parts: [{ text: data.text }] });

            // Build the UI in an efficient off-screen fragment
            const wrapper = document.createElement('div');
            wrapper.className = `chat-message-wrapper justify-${data.role === 'user' ? 'end' : 'start'}`;
            const bubble = document.createElement('div');
            bubble.className = `chat-bubble ${data.role === 'user' ? 'user-bubble' : 'ai-bubble'}`;
            bubble.textContent = data.text;
            wrapper.appendChild(bubble);
            fragment.appendChild(wrapper);
        });

        // 3. Once complete, atomically update the global state and the DOM.
        chatHistory = newHistory;
        DOMElements.conversationView.appendChild(fragment);

        // --- End of Fix ---

        showConversationView();
        scrollToMessage(); // Scroll to the bottom after rendering
    } catch (error) {
        console.error("Error loading chat history:", error);
        addMessageToUI('model', 'Could not load previous messages.');
    }
}

function showConversationView() {
    DOMElements.historyPanel.classList.add('hidden');
    DOMElements.conversationView.classList.remove('hidden');

    const icon = DOMElements.optionsBtn.querySelector('i');
    icon.className = 'bi bi-clock-history';
    DOMElements.optionsBtn.title = 'View History';

    if (chatHistory.length === 0) {
        DOMElements.welcomeScreen.classList.remove('hidden');
        DOMElements.conversationView.classList.add('hidden');
    }
}

async function deleteConversation(conversationId) {
    if (!appState.currentUser || !appState.currentPlanId || !db) return;

    console.log(`Requesting deletion for conversation: ${conversationId}`);

    const conversationRef = db.collection('users').doc(appState.currentUser.uid)
                              .collection('plans').doc(appState.currentPlanId)
                              .collection('conversations').doc(conversationId);

    try {
        // NOTE: Firestore does not support recursive deletion from the client.
        // Deleting this document will orphan the 'messages' subcollection.
        // For a production app, a Cloud Function triggered on delete is the best practice.
        // For this implementation, orphaning is an acceptable trade-off.
        await conversationRef.delete();
        console.log(`Successfully deleted conversation ${conversationId} from Firestore.`);

        // Visually remove the item from the history list
        const historyItem = DOMElements.historyList.querySelector(`.history-item[data-id="${conversationId}"]`);
        if (historyItem) {
            historyItem.remove();
            console.log(`Removed conversation ${conversationId} from the UI.`);
        }

        // If the currently viewed chat is the one being deleted, reset the view
        if (currentConversationId === conversationId) {
            startNewConversation();
        }
    } catch (error) {
        console.error("Error deleting conversation:", error);
        // It might be good to show a more user-friendly error message here
        alert("Failed to delete conversation. Please try again.");
    }
}

async function showHistoryView() {
    DOMElements.welcomeScreen.classList.add('hidden');
    DOMElements.conversationView.classList.add('hidden');
    DOMElements.historyPanel.classList.remove('hidden');

    const icon = DOMElements.optionsBtn.querySelector('i');
    icon.className = 'bi bi-arrow-left';
    DOMElements.optionsBtn.title = 'Back to Chat';

    DOMElements.historyList.innerHTML = '<div class="loading-spinner mx-auto mt-8"></div>';

    if (!appState.currentUser || !appState.currentPlanId || !db) {
        DOMElements.historyList.innerHTML = '<p class="text-center text-gray-500 p-4">Could not load history.</p>';
        return;
    }

    const conversationsRef = db.collection('users').doc(appState.currentUser.uid)
                               .collection('plans').doc(appState.currentPlanId)
                               .collection('conversations')
                               .orderBy('createdAt', 'desc');
    try {
        const snapshot = await conversationsRef.get();
        if (snapshot.empty) {
            DOMElements.historyList.innerHTML = '<p class="text-center text-gray-500 p-4">No past conversations found.</p>';
            return;
        }

        DOMElements.historyList.innerHTML = '';
        snapshot.forEach(doc => {
            const conversation = doc.data();
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.dataset.id = doc.id;
            // Add a container for the text and a new delete button
            historyItem.innerHTML = `
                <div class="history-item-text">
                    <p class="history-item-title">${conversation.firstMessage}</p>
                    <p class="history-item-date">${conversation.createdAt.toDate().toLocaleDateString()}</p>
                </div>
                <button class="btn btn-secondary btn-icon delete-conversation-btn" title="Delete conversation" data-id="${doc.id}">
                    <i class="bi bi-trash3"></i>
                </button>
            `;
            DOMElements.historyList.appendChild(historyItem);
        });
    } catch (error) {
        console.error("Error fetching conversation list:", error);
        DOMElements.historyList.innerHTML = '<p class="text-center text-red-500 p-4">Failed to load conversation history.</p>';
    }
}

export function openChat() {
    if (DOMElements.modal) {
        DOMElements.modal.classList.remove('hidden');
        DOMElements.chatInput.focus();

        // Always start a new conversation view when opening the modal
        currentConversationId = null;
        chatHistory = [];
        DOMElements.conversationView.innerHTML = '';
        showConversationView(); // This will correctly show the welcome screen
    }
}

export function initializeChat(_appState, _db) {
    appState = _appState;
    db = _db;

    if (!DOMElements.modal) return;

    DOMElements.modal.addEventListener('click', (e) => {
        if (e.target === DOMElements.modal) {
            closeChatModal();
        }
    });

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
    
    DOMElements.newChatBtn.addEventListener('click', startNewConversation);

    DOMElements.historyList.addEventListener('click', (e) => {
        const item = e.target.closest('.history-item');
        const deleteBtn = e.target.closest('.delete-conversation-btn');

        if (deleteBtn) {
            // Handle delete button click
            e.stopPropagation(); // Prevent the item click from firing
            const conversationId = deleteBtn.dataset.id;
            openModal('confirmDeleteConversation', { planId: conversationId }); // Re-use planId to pass the ID
        } else if (item) {
            // Handle history item click to load conversation
            const conversationId = item.dataset.id;
            loadChatHistory(conversationId);
        }
    });

    // Add a listener for the global confirmation event
    document.addEventListener('conversation-deletion-confirmed', (e) => {
        const { conversationId } = e.detail;
        if (conversationId) {
            deleteConversation(conversationId);
        }
    });

    DOMElements.optionsBtn.addEventListener('click', () => {
        const isHistoryVisible = !DOMElements.historyPanel.classList.contains('hidden');
        if (isHistoryVisible) {
            showConversationView();
        } else {
            showHistoryView();
        }
    });

    // When a logout is triggered, ensure the chat modal is closed.
    document.addEventListener('logout-request', closeChatModal);
}
