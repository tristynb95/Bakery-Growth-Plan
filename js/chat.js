// js/chat.js

import { getGeminiChatResponse } from './api.js';
import { summarizePlanForAI } from './plan-view.js';

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
    backToChatBtn: document.getElementById('back-to-chat-btn'),
};

/**
 * Scrolls the conversation container to the bottom.
 */
function scrollToMessage() {
    const container = DOMElements.conversationView;
    // This is the most reliable method to scroll a container to its absolute bottom
    container.scrollTop = container.scrollHeight;
}

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
 * Adds a message bubble to the conversation UI.
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
    scrollToMessage(); // Scroll after adding new message/indicator
}

/**
 * Replaces the typing indicator with the final AI response text.
 */
function updateLastAiMessageInUI(text) {
    const lastBubble = DOMElements.conversationView.querySelector('.ai-bubble:last-child');
    if (lastBubble) {
        lastBubble.innerHTML = ''; // Remove typing indicator
        lastBubble.textContent = text;
        scrollToMessage(); // Re-scroll after content is added, as height may have changed
    }
}

/**
 * Starts a new, empty conversation.
 */
function startNewConversation() {
    currentConversationId = null;
    chatHistory = [];
    DOMElements.conversationView.innerHTML = '';
    showConversationView();
}

/**
 * Saves a single message object to the Firestore database under a specific conversation.
 * @param {{role: string, text: string}} messageObject
 */
async function saveMessage(messageObject) {
    if (!appState.currentUser || !appState.currentPlanId || !db) return;

    if (!currentConversationId) {
        const conversationRef = db.collection('users').doc(appState.currentUser.uid)
                                   .collection('plans').doc(appState.currentPlanId)
                                   .collection('conversations').doc();
        currentConversationId = conversationRef.id;
    }

    const messageRef = db.collection('users').doc(appState.currentUser.uid)
                         .collection('plans').doc(appState.currentPlanId)
                         .collection('conversations').doc(currentConversationId)
                         .collection('messages');

    try {
        await messageRef.add({
            ...messageObject,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error("Error saving chat message:", error);
    }
}

/**
 * The main function to process sending a message from the user.
 */
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

/**
 * Loads a specific conversation from Firestore.
 * @param {string} conversationId The ID of the conversation to load.
 */
async function loadChatHistory(conversationId) {
    if (!appState.currentUser || !appState.currentPlanId || !db) return;

    chatHistory = [];
    DOMElements.conversationView.innerHTML = '';
    currentConversationId = conversationId;

    const messagesRef = db.collection('users').doc(appState.currentUser.uid)
                          .collection('plans').doc(appState.currentPlanId)
                          .collection('conversations').doc(conversationId)
                          .collection('messages')
                          .orderBy('timestamp', 'asc');

    try {
        const snapshot = await messagesRef.get();
        if (snapshot.empty) {
            console.warn("No messages found for this conversation.");
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            chatHistory.push({ role: data.role, parts: [{ text: data.text }] });
            addMessageToUI(data.role, data.text);
        });
        showConversationView();
    } catch (error) {
        console.error("Error loading chat history:", error);
        addMessageToUI('model', 'Could not load previous messages.');
    }
}

function showConversationView() {
    DOMElements.historyPanel.classList.add('hidden');
    DOMElements.conversationView.classList.remove('hidden');
    if (chatHistory.length === 0) {
        DOMElements.welcomeScreen.classList.remove('hidden');
        DOMElements.conversationView.classList.add('hidden');
    }
}

async function showHistoryView() {
    DOMElements.welcomeScreen.classList.add('hidden');
    DOMElements.conversationView.classList.add('hidden');
    DOMElements.historyPanel.classList.remove('hidden');
    DOMElements.historyList.innerHTML = '<div class="loading-spinner mx-auto mt-8"></div>';

    if (!appState.currentUser || !appState.currentPlanId || !db) {
        DOMElements.historyList.innerHTML = '<p class="text-center text-gray-500 p-4">Could not load history.</p>';
        return;
    }

    const conversationsRef = db.collection('users').doc(appState.currentUser.uid)
                               .collection('plans').doc(appState.currentPlanId)
                               .collection('conversations');
    try {
        const snapshot = await conversationsRef.get();
        if (snapshot.empty) {
            DOMElements.historyList.innerHTML = '<p class="text-center text-gray-500 p-4">No past conversations found.</p>';
            return;
        }

        DOMElements.historyList.innerHTML = '';
        for (const doc of snapshot.docs) {
            const firstMessageSnapshot = await doc.ref.collection('messages').orderBy('timestamp', 'asc').limit(1).get();
            if (!firstMessageSnapshot.empty) {
                const firstMessage = firstMessageSnapshot.docs[0].data();
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                historyItem.dataset.id = doc.id;
                historyItem.innerHTML = `
                    <p class="history-item-title">${firstMessage.text}</p>
                    <p class="history-item-date">${firstMessage.timestamp.toDate().toLocaleDateString()}</p>
                `;
                DOMElements.historyList.appendChild(historyItem);
            }
        }
    } catch (error) {
        console.error("Error fetching conversation list:", error);
        DOMElements.historyList.innerHTML = '<p class="text-center text-red-500 p-4">Failed to load conversation history.</p>';
    }
}

export function openChat() {
    if (DOMElements.modal) {
        startNewConversation();
        DOMElements.modal.classList.remove('hidden');
        DOMElements.chatInput.focus();
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
    
    DOMElements.newChatBtn.addEventListener('click', startNewConversation);

    DOMElements.historyList.addEventListener('click', (e) => {
        const item = e.target.closest('.history-item');
        if (item) {
            const conversationId = item.dataset.id;
            loadChatHistory(conversationId);
        }
    });

    DOMElements.optionsBtn.addEventListener('click', showHistoryView);
    DOMElements.backToChatBtn.addEventListener('click', showConversationView);
}
