// js/chat.js

import { getGeminiChatResponse } from './api.js';
import { summarizePlanForAI } from './plan-view.js';

let appState;
let chatHistory = [];

const DOMElements = {
    modal: document.getElementById('gemini-chat-modal'),
    conversationArea: document.getElementById('chat-conversation-area'),
    welcomeScreen: document.getElementById('chat-welcome-screen'),
    chatInput: document.getElementById('chat-input'),
    sendBtn: document.getElementById('chat-send-btn'),
};

function addMessageToHistory(sender, text, isLoading = false) {
    // Hide welcome screen on first message
    if (!DOMElements.welcomeScreen.classList.contains('hidden')) {
        DOMElements.welcomeScreen.classList.add('hidden');
    }
    
    const isUser = sender === 'user';
    
    // Add to JS history state for API calls
    chatHistory.push({ role: isUser ? 'user' : 'model', parts: [{ text }] });
    
    const wrapper = document.createElement('div');
    wrapper.className = 'chat-message-wrapper';
    wrapper.classList.add(isUser ? 'justify-end' : 'justify-start');

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.classList.add(isUser ? 'user-bubble' : 'ai-bubble');

    if (isLoading) {
        bubble.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
    } else {
        bubble.textContent = text;
    }
    
    wrapper.appendChild(bubble);
    DOMElements.conversationArea.appendChild(wrapper);
    DOMElements.conversationArea.scrollTop = DOMElements.conversationArea.scrollHeight;
}

function updateLastAiMessage(text) {
    const lastBubble = DOMElements.conversationArea.querySelector('.ai-bubble:last-child');
    if (lastBubble) {
        lastBubble.innerHTML = ''; // Remove typing indicator
        lastBubble.textContent = text;
        
        // Update the history state
        const lastEntry = chatHistory[chatHistory.length - 1];
        if (lastEntry && lastEntry.role === 'model') {
            lastEntry.parts[0].text = text;
        }
    }
}

async function handleSendMessage() {
    const message = DOMElements.chatInput.value.trim();
    if (!message) return;

    // 1. Display user message
    addMessageToHistory('user', message);

    // 2. Clear input and show loading state
    const initialHeight = DOMElements.chatInput.scrollHeight;
    DOMElements.chatInput.value = '';
    DOMElements.chatInput.style.height = `${initialHeight}px`;
    addMessageToHistory('ai', '', true);

    try {
        // 3. Get context and call API
        const planSummary = summarizePlanForAI(appState.planData);
        // Pass all but the last "loading" message to the API
        const historyForApi = chatHistory.slice(0, -1); 
        
        const responseText = await getGeminiChatResponse(planSummary, historyForApi, message);
        
        // 4. Update UI with response
        updateLastAiMessage(responseText);

    } catch (error) {
        console.error("Chat error:", error);
        updateLastAiMessage(error.message || 'Sorry, I encountered an error. Please try again.');
    }
}

function resetChat() {
    chatHistory = [];
    DOMElements.conversationArea.innerHTML = '';
    DOMElements.welcomeScreen.classList.remove('hidden');
    DOMElements.chatInput.value = '';
}

export function openChat() {
    if (DOMElements.modal) {
        resetChat();
        DOMElements.modal.classList.remove('hidden');
        DOMElements.chatInput.focus();
    }
}

export function initializeChat(_appState) {
    appState = _appState;

    if (!DOMElements.modal) return;

    DOMElements.sendBtn.addEventListener('click', handleSendMessage);
    DOMElements.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    
    // Add listeners for prompt starter cards
    DOMElements.welcomeScreen.addEventListener('click', (e) => {
        const card = e.target.closest('.prompt-starter-card');
        if (card) {
            const promptText = card.querySelector('p:last-child').textContent.replace(/"/g, '');
            DOMElements.chatInput.value = promptText;
            handleSendMessage();
        }
    });
}
