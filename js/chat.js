// js/chat.js

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
    chatModalContent: document.querySelector('#gemini-chat-modal .chat-modal-content'),
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

function parseMarkdownToHTML(text) {
    let processedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    const blocks = processedText.split(/\n\s*\n/);
    const htmlBlocks = blocks.map(block => {
        block = block.trim();
        if (!block) return '';
        const lines = block.split('\n');
        const isUnorderedList = lines.every(line => /^\s*\*/.test(line));
        const isOrderedList = lines.every(line => /^\s*\d+\./.test(line));
        if (isUnorderedList || isOrderedList) {
            const listTag = isUnorderedList ? 'ul' : 'ol';
            const items = lines.map(line => {
                const content = line.replace(/^\s*(\*|\d+\.)\s*/, '');
                return `<li>${content}</li>`;
            }).join('');
            return `<${listTag}>${items}</${listTag}>`;
        }
        return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    });
    return htmlBlocks.join('');
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
        if (sender === 'user') {
            bubble.textContent = text;
        } else {
            bubble.innerHTML = parseMarkdownToHTML(text);
        }
    }
    wrapper.appendChild(bubble);
    DOMElements.conversationView.appendChild(wrapper);
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateLastAiMessageInUI(text) {
    const allAiBubbles = DOMElements.conversationView.querySelectorAll('.ai-bubble');
    if (allAiBubbles.length > 0) {
        const lastBubble = allAiBubbles[allAiBubbles.length - 1];
        lastBubble.innerHTML = parseMarkdownToHTML(text);
        lastBubble.parentElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function startNewConversation() {
    currentConversationId = null;
    chatHistory = [];
    sessionStorage.removeItem('gails_lastConversationId'); // Clear the saved session
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
        // Save the new ID to the session so it's remembered on reopen
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
        const newHistory = [];
        const fragment = document.createDocumentFragment();
        snapshot.forEach(doc => {
            const data = doc.data();
            newHistory.push({ role: data.role, parts: [{ text: data.text }] });
            const wrapper = document.createElement('div');
            wrapper.className = `chat-message-wrapper justify-${data.role === 'user' ? 'end' : 'start'}`;
            const bubble = document.createElement('div');
            bubble.className = `chat-bubble ${data.role === 'user' ? 'user-bubble' : 'ai-bubble'}`;
            if (data.role === 'user') {
                bubble.textContent = data.text;
            } else {
                bubble.innerHTML = parseMarkdownToHTML(data.text);
            }
            wrapper.appendChild(bubble);
            fragment.appendChild(wrapper);
        });
        chatHistory = newHistory;
        DOMElements.conversationView.appendChild(fragment);
        showConversationView();
        const lastMessage = DOMElements.conversationView.lastElementChild;
        if (lastMessage) {
            lastMessage.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
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
    const conversationRef = db.collection('users').doc(appState.currentUser.uid)
                              .collection('plans').doc(appState.currentPlanId)
                              .collection('conversations').doc(conversationId);
    try {
        await conversationRef.delete();
        const historyItem = DOMElements.historyList.querySelector(`.history-item[data-id="${conversationId}"]`);
        if (historyItem) {
            historyItem.remove();
        }
        if (currentConversationId === conversationId) {
            startNewConversation();
        }
    } catch (error) {
        console.error("Error deleting conversation:", error);
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

        const lastConversationId = sessionStorage.getItem('gails_lastConversationId');

        if (lastConversationId && lastConversationId !== 'null') {
            // If we have a saved ID, load that history instead of starting fresh.
            if (currentConversationId !== lastConversationId) {
                loadChatHistory(lastConversationId);
            } else {
                // The chat is already loaded, just ensure it's visible.
                showConversationView();
            }
        } else {
            // No saved ID, so start a new conversation.
            startNewConversation();
        }
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
            e.stopPropagation();
            const conversationId = deleteBtn.dataset.id;
            openModal('confirmDeleteConversation', { planId: conversationId });
        } else if (item) {
            const conversationId = item.dataset.id;
            loadChatHistory(conversationId);
        }
    });
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
    document.addEventListener('logout-request', closeChatModal);
}
