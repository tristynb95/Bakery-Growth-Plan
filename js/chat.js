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

function scrollToMessage() {
    const container = DOMElements.conversationView;
    container.scrollTop = container.scrollHeight;
}

function closeChatModal() {
    if (DOMElements.modal) {
        // We add a class to trigger the slide-out animation
        if (DOMElements.modalBox) {
             DOMElements.modalBox.style.transform = 'translateX(100%)';
        }
        // Wait for the animation to finish before hiding the overlay
        setTimeout(() => {
            DOMElements.modal.classList.add('hidden');
             if (DOMElements.modalBox) {
                DOMElements.modalBox.removeAttribute('style');
            }
        }, 400); // Should match the transition duration in CSS
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
            historyItem.innerHTML = `
                <p class="history-item-title">${conversation.firstMessage}</p>
                <p class="history-item-date">${conversation.createdAt.toDate().toLocaleDateString()}</p>
            `;
            DOMElements.historyList.appendChild(historyItem);
        });
    } catch (error) {
        console.error("Error fetching conversation list:", error);
        DOMElements.historyList.innerHTML = '<p class="text-center text-red-500 p-4">Failed to load conversation history.</p>';
    }
}

export async function openChat() {
    if (DOMElements.modal) {
        DOMElements.modal.classList.remove('hidden');
        DOMElements.chatInput.focus();

        const conversationsRef = db.collection('users').doc(appState.currentUser.uid)
                               .collection('plans').doc(appState.currentPlanId)
                               .collection('conversations')
                               .orderBy('createdAt', 'desc')
                               .limit(1);
        try {
            const snapshot = await conversationsRef.get();
            if (snapshot.empty) {
                startNewConversation();
            } else {
                const lastConversationId = snapshot.docs[0].id;
                await loadChatHistory(lastConversationId);
            }
        } catch (error) {
            console.error("Error loading last conversation:", error);
            startNewConversation();
        }
    }
}

export function initializeChat(_appState, _db) {
    appState = _appState;
    db = _db;

    if (!DOMElements.modal) return;

    // Draggable functionality is removed
    // makeDraggable(DOMElements.modalBox, DOMElements.header);

    // Clicking the overlay (but not the modal box itself) closes it
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
        if (item) {
            const conversationId = item.dataset.id;
            loadChatHistory(conversationId);
        }
    });

    DOMElements.optionsBtn.addEventListener('click', showHistoryView);
    DOMElements.backToChatBtn.addEventListener('click', showConversationView);
}
