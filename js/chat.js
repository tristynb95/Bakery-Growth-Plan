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

function updateLastAiMessageInUI(text) {
    const lastBubble = DOMElements.conversationView.querySelector('.ai-bubble:last-child');
    if (lastBubble) {
        lastBubble.innerHTML = '';
        lastBubble.textContent = text;
    }
}

async function fetchAndRenderHistory() {
    DOMElements.historyList.innerHTML = '<div class="loading-spinner mx-auto mt-8"></div>';
    
    // In a real implementation, you would fetch from Firestore here.
    // For now, we will simulate with a placeholder.
    setTimeout(() => {
        DOMElements.historyList.innerHTML = `
            <div class="p-4 text-center text-gray-500">
                Chat history is not yet connected to the database.
            </div>
        `;
    }, 1000);
}

async function handleSendMessage() {
    const message = DOMElements.chatInput.value.trim();
    if (!message) return;

    chatHistory.push({ role: 'user', parts: [{ text: message }] });
    addMessageToUI('user', message);

    const initialHeight = DOMElements.chatInput.scrollHeight;
    DOMElements.chatInput.value = '';
    DOMElements.chatInput.style.height = `${initialHeight}px`;
    addMessageToUI('ai', '', true);

    try {
        const planSummary = summarizePlanForAI(appState.planData);
        const responseText = await getGeminiChatResponse(planSummary, chatHistory, message);
        chatHistory.push({ role: 'model', parts: [{ text: responseText }] });
        updateLastAiMessageInUI(responseText);
        // Here you would save the updated chatHistory to Firestore
    } catch (error) {
        console.error("Chat error:", error);
        const errorMessage = error.message || 'Sorry, I encountered an error. Please try again.';
        chatHistory.push({ role: 'model', parts: [{ text: errorMessage }] });
        updateLastAiMessageInUI(errorMessage);
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

function showHistoryView() {
    DOMElements.welcomeScreen.classList.add('hidden');
    DOMElements.conversationView.classList.add('hidden');
    DOMElements.historyPanel.classList.remove('hidden');
    fetchAndRenderHistory();
}

export function openChat() {
    if (DOMElements.modal) {
        chatHistory = [];
        DOMElements.conversationView.innerHTML = '';
        showConversationView();
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
    
    DOMElements.optionsBtn.addEventListener('click', showHistoryView);
    DOMElements.backToChatBtn.addEventListener('click', showConversationView);
}
