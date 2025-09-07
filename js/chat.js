// js/chat.js

import { getGeminiChatResponse } from './api.js';
import { summarizePlanForAI } from './plan-view.js';

let appState;
let db;
let chatHistory = [];
let currentConversationId = null;

const DOMElements = {
    modal: document.getElementById('gemini-chat-modal'),
    modalBox: document.querySelector('.chat-modal-box'),
    closeBtn: document.getElementById('chat-modal-close-btn'),
    historyBtn: document.getElementById('chat-history-btn'),
    newChatBtn: document.getElementById('chat-new-btn'),
    
    conversationPanel: document.getElementById('chat-conversation-panel'),
    conversationView: document.getElementById('chat-conversation-area'),
    welcomeScreen: document.getElementById('chat-welcome-screen'),
    chatInput: document.getElementById('chat-input'),
    sendBtn: document.getElementById('chat-send-btn'),

    historyPanel: document.getElementById('chat-history-panel'),
    historyList: document.getElementById('history-list'),
    backToChatBtn: document.getElementById('back-to-chat-btn'),
};

function scrollToBottom() {
    DOMElements.conversationView.scrollTop = DOMElements.conversationView.scrollHeight;
}

function openChatModal() {
    DOMElements.modal.classList.remove('hidden');
    DOMElements.chatInput.focus();
}

function closeChatModal() {
    DOMElements.modal.classList.add('hidden');
    // Ensure the history panel is closed for the next time it opens
    DOMElements.modalBox.classList.remove('history-is-open');
}

function addMessageToUI(sender, text, isLoading = false) {
    DOMElements.welcomeScreen.classList.add('hidden');
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
    scrollToBottom();
}

function updateLastAiMessageInUI(text) {
    const lastBubble = DOMElements.conversationView.querySelector('.ai-bubble:last-child');
    if (lastBubble && lastBubble.querySelector('.typing-indicator')) {
        lastBubble.innerHTML = '';
        lastBubble.textContent = text;
        scrollToBottom();
    }
}

function startNewConversation() {
    currentConversationId = null;
    chatHistory = [];
    sessionStorage.removeItem('gails_lastConversationId');
    DOMElements.conversationView.innerHTML = '';
    DOMElements.conversationView.classList.add('hidden');
    DOMElements.welcomeScreen.classList.remove('hidden');
    // Make sure we are viewing the conversation panel
    DOMElements.modalBox.classList.remove('history-is-open');
}

async function saveMessage(messageObject) {
    if (!appState.currentUser || !appState.currentPlanId || !db) return;
    
    const conversationsRef = db.collection('users').doc(appState.currentUser.uid)
                               .collection('plans').doc(appState.currentPlanId)
                               .collection('conversations');

    if (!currentConversationId) {
        const conversationDocRef = conversationsRef.doc();
        currentConversationId = conversationDocRef.id;
        sessionStorage.setItem('gails_lastConversationId', currentConversationId);
        await conversationDocRef.set({
            firstMessage: messageObject.text,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    const messageRef = conversationsRef.doc(currentConversationId).collection('messages');
    await messageRef.add({
        ...messageObject,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function handleSendMessage() {
    const messageText = DOMElements.chatInput.value.trim();
    if (!messageText) return;

    const userMessage = { role: 'user', parts: [{ text: messageText }] };
    chatHistory.push(userMessage);
    addMessageToUI('user', messageText);
    saveMessage({ role: 'user', text: messageText });

    DOMElements.chatInput.value = '';
    DOMElements.chatInput.style.height = 'auto';
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
        updateLastAiMessageInUI(error.message || 'Sorry, I encountered an error. Please try again.');
    }
}

async function loadChatHistory(conversationId) {
    if (!appState.currentUser || !appState.currentPlanId || !db) return;

    DOMElements.conversationView.innerHTML = '';
    DOMElements.modalBox.classList.remove('history-is-open');
    
    currentConversationId = conversationId;
    sessionStorage.setItem('gails_lastConversationId', conversationId);

    const messagesRef = db.collection('users').doc(appState.currentUser.uid)
                          .collection('plans').doc(appState.currentPlanId)
                          .collection('conversations').doc(conversationId)
                          .collection('messages').orderBy('timestamp', 'asc');
    try {
        const snapshot = await messagesRef.get();
        const newHistory = [];
        const fragment = document.createDocumentFragment();

        snapshot.forEach(doc => {
            const data = doc.data();
            newHistory.push({ role: data.role, parts: [{ text: data.text }] });
            
            const wrapper = document.createElement('div');
            wrapper.className = `chat-message-wrapper justify-${data.role === 'user' ? 'end' : 'start'}`;
            const bubble = document.createElement('div');
            bubble.className = `chat-bubble ${data.role === 'user' ? 'user-bubble' : 'ai-bubble'}`;
            bubble.textContent = data.text;
            wrapper.appendChild(bubble);
            fragment.appendChild(wrapper);
        });

        chatHistory = newHistory;
        DOMElements.conversationView.appendChild(fragment);

        if (chatHistory.length > 0) {
            DOMElements.conversationView.classList.remove('hidden');
            DOMElements.welcomeScreen.classList.add('hidden');
        } else {
             DOMElements.conversationView.classList.add('hidden');
            DOMElements.welcomeScreen.classList.remove('hidden');
        }
        
        scrollToBottom();
    } catch (error) {
        console.error("Error loading chat history:", error);
        addMessageToUI('model', 'Could not load previous messages.');
    }
}

async function showHistoryView() {
    DOMElements.modalBox.classList.add('history-is-open');
    DOMElements.historyList.innerHTML = '<div class="loading-spinner mx-auto mt-8"></div>';

    if (!appState.currentUser || !appState.currentPlanId || !db) {
        DOMElements.historyList.innerHTML = '<p class="text-center text-gray-500 p-4">Could not load history.</p>';
        return;
    }

    const conversationsRef = db.collection('users').doc(appState.currentUser.uid)
                               .collection('plans').doc(appState.currentPlanId)
                               .collection('conversations').orderBy('createdAt', 'desc');
    try {
        const snapshot = await conversationsRef.get();
        if (snapshot.empty) {
            DOMElements.historyList.innerHTML = '<p class="text-center text-gray-500 p-4">No past conversations found.</p>';
            return;
        }

        DOMElements.historyList.innerHTML = '';
        snapshot.forEach(doc => {
            const { firstMessage, createdAt } = doc.data();
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.dataset.id = doc.id;
            historyItem.innerHTML = `
                <p class="history-item-title">${firstMessage}</p>
                <p class="history-item-date">${createdAt.toDate().toLocaleDateString()}</p>`;
            DOMElements.historyList.appendChild(historyItem);
        });
    } catch (error) {
        console.error("Error fetching conversation list:", error);
        DOMElements.historyList.innerHTML = '<p class="text-center text-red-500 p-4">Failed to load conversation history.</p>';
    }
}

export async function openChat() {
    openChatModal();

    const lastConversationId = sessionStorage.getItem('gails_lastConversationId');
    if (lastConversationId) {
        await loadChatHistory(lastConversationId);
    } else {
        const conversationsRef = db.collection('users').doc(appState.currentUser.uid)
                                   .collection('plans').doc(appState.currentPlanId)
                                   .collection('conversations').orderBy('createdAt', 'desc').limit(1);
        try {
            const snapshot = await conversationsRef.get();
            if (snapshot.empty) {
                startNewConversation();
            } else {
                await loadChatHistory(snapshot.docs[0].id);
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

    DOMElements.modal.addEventListener('click', (e) => {
        if (e.target === DOMElements.modal) closeChatModal();
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
     DOMElements.chatInput.addEventListener('input', () => {
        DOMElements.chatInput.style.height = 'auto';
        DOMElements.chatInput.style.height = `${DOMElements.chatInput.scrollHeight}px`;
    });

    DOMElements.welcomeScreen.addEventListener('click', (e) => {
        const card = e.target.closest('.prompt-starter-card');
        if (card) {
            DOMElements.chatInput.value = card.querySelector('p:last-child').textContent.replace(/"/g, '');
            handleSendMessage();
        }
    });
    
    DOMElements.newChatBtn.addEventListener('click', startNewConversation);
    DOMElements.historyBtn.addEventListener('click', showHistoryView);
    DOMElements.backToChatBtn.addEventListener('click', () => {
        DOMElements.modalBox.classList.remove('history-is-open');
    });

    DOMElements.historyList.addEventListener('click', (e) => {
        const item = e.target.closest('.history-item');
        if (item) {
            loadChatHistory(item.dataset.id);
        }
    });
}
