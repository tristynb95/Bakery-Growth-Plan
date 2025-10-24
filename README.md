# Bakery Growth Planner

**Version:** 1.0.0

## 📝 Overview

The **Bakery Growth Planner** is a web application designed specifically for Bakery Managers, serving as a centralised digital platform for **30-60-90 day operational planning and execution**. It aims to replace static documentation workflows with a dynamic, interactive system featuring AI integration for personalised support and reduced administrative overhead.

The core objective is to provide managers with tools to:
* Define and track quarterly strategic visions.
* Set measurable, actionable goals aligned with operational pillars.
* Monitor progress through regular check-ins.
* Facilitate team development and performance management.
* Ensure alignment with key pillars: **People**, **Product**, **Customer**, and **Place**.

---

## ✨ Key Features

* **Guided 30-60-90 Day Planning Module:** A structured workflow for creating comprehensive quarterly plans, encompassing high-level objectives down to weekly tactical reviews.
* **Centralised Dashboard:** Provides an aggregated view of all growth plans, highlighting key metadata like completion status and last modification time for quick access and oversight.
* **Integrated Scheduling Calendar:** Allows managers to schedule and categorise events (e.g., training, 1-to-1s, audits, deadlines) directly within the planning context.
* **AI-Generated Action Plans:** Utilises the Google Gemini API via a secure backend function to generate editable, tactical action plans derived from the manager's 90-day plan summary.
* **Real-time Cloud Synchronisation:** Employs Google Cloud Firestore to ensure data consistency and real-time updates across multiple devices or sessions.
* **Printable & Shareable Summaries:** Functionality to generate formatted plan summaries for printing or secure, read-only web link sharing.
* **User Profile Management:** Standard user account management features including profile details (name, bakery) and optional photo upload.

---

## 🛠️ Technical Architecture & Stack

The application utilises a decoupled architecture with a static frontend and a serverless backend, prioritising security, scalability, and maintainability.

* **Frontend:**
    * Vanilla JavaScript (ES Modules)
    * HTML5
    * Tailwind CSS (Utility-first CSS framework)
* **Backend:**
    * Netlify Functions (Serverless, Node.js runtime)
* **Database:**
    * Google Cloud Firestore (NoSQL, real-time capabilities)
* **Authentication:**
    * Firebase Authentication (Email/Password)
* **AI Integration:**
    * Google AI Gemini API (Accessed via secure Netlify function)
* **Build Tool:**
    * Vite (Frontend build tooling and development server)
* **Deployment & Hosting:**
    * Netlify (Static site hosting and serverless function deployment)

**Architectural Considerations:**

* **Security:** API keys and sensitive credentials (Firebase Admin SDK, Gemini API Key) are managed exclusively within the serverless backend functions, preventing client-side exposure. Communication between frontend and backend is over HTTPS.
* **Scalability:** Leverages serverless functions and Firestore, which scale automatically based on demand.
* **Real-time Data:** Firestore enables real-time updates in the UI without manual refreshing, crucial for collaborative or multi-device usage scenarios.

---

## ⚙️ Getting Started (Local Development Environment)

Instructions for setting up and running the project locally.

### Prerequisites

* **Node.js:** Version 20.x or later is recommended. Verify with node -v.
* **npm:** Version 9.x or later (usually included with Node.js). Verify with npm -v. (Or yarn if preferred).
* **Firebase Project:**
    * Access to a Google Cloud Firebase project.
    * **Firestore Database** enabled within the project.
    * **Firebase Authentication** enabled with the "Email/Password" sign-in provider.
* **Google AI (Gemini) API Key:**
    * Generated from Google AI Studio ([aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)).
* **Netlify CLI:**
    * Installation: npm install -g netlify-cli
    * Authentication: netlify login

### Installation and Configuration

1.  **Clone the Repository:**
    bash
    git clone [https://github.com/tristynb95/bakery-growth-plan.git](https://github.com/tristynb95/bakery-growth-plan.git)
    cd bakery-growth-plan
    

2.  **Install Dependencies:**
    bash
    npm install
    

3.  **Set Up Environment Variables:**
    * Create a .env file by duplicating the example:
        bash
        cp .env.example .env
        
    * Edit the .env file and populate it with your specific Firebase project configuration values (found in your Firebase project settings: apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId, measurementId) and your GEMINI_API_KEY.

4.  **Run the Local Development Server:**
    * Use the Netlify CLI to serve the application and emulate the serverless functions:
        bash
        netlify dev
        
    * The application will typically be available at http://localhost:8888 (confirm the URL provided in the terminal output). netlify dev handles proxying requests to your local functions.

---

## 📁 Project Structure

/
├── js/                  # Frontend JavaScript modules (ES Modules)
│   ├── api.js           # Client-side API call handlers (to Netlify functions)
│   ├── auth.js          # Authentication UI logic, session management
│   ├── calendar.js      # Calendar view rendering and interaction logic
│   ├── chat.js          # AI Chat companion UI and logic
│   ├── dashboard.js     # Dashboard view rendering and logic
│   ├── files.js         # File upload and management view logic
│   ├── main.js          # Main application entry point, initialization
│   ├── plan-view.js     # 30-60-90 day plan view rendering and interaction
│   ├── profile.js       # User profile page logic
│   ├── ui.js            # General UI components (modals, menus, etc.)
│   ├── utils.js         # Utility functions (date formatting, calculations)
│   └── view.js          # Logic for the public read-only shareable view
├── netlify/
│   └── functions/       # Serverless backend functions (Node.js)
│       ├── config.js    # Securely serves Firebase frontend config
│       ├── generate-chat-response.js # Handles calls to Gemini API for chat
│       └── generate-plan.js # Handles calls to Gemini API for action plan generation
├── index.html           # Main application shell (SPA entry)
├── profile.html         # User profile page HTML
├── view.html            # Public shareable plan page HTML
├── action.html          # Handles Firebase email actions (e.g., password reset)
├── privacy-policy.html  # Static privacy policy page
├── terms-and-conditions.html # Static terms page
├── style.css            # Custom CSS styles (including Tailwind directives)
├── vite.config.js       # Vite build configuration
├── netlify.toml         # Netlify deployment and function configuration
├── package.json         # Project dependencies and scripts
├── .env.example         # Example environment variables file
├── README.md            # This file
└── .gitignore           # Specifies intentionally untracked files



-----

## 🚀 Roadmap & Potential Future Enhancements

  * **MBTI-Informed AI:** Explore integration of Myers-Briggs Type Indicator frameworks to allow the AI to optionally tailor suggestions and action plan phrasing to a manager's personality profile.
  * **AI Chat Companion:** Implement an interactive chat interface allowing managers to query their plan data, ask for strategic advice, or brainstorm ideas conversationally using the Gemini API.
  * **Team Organisation Module:** Develop functionality to map team structures, associate team members with development goals (IDPs), and track training progress.

-----

## 🤝 Contributing

This project is currently maintained as proprietary software for Bakery internal use. Contributions are not open at this time. Bug reports or feature suggestions should be directed through the appropriate internal channels.

Should this project transition to an open contribution model, standard GitHub practices (Fork, Feature Branch, Pull Request) will apply.

-----

## 📄 License

Proprietary. All rights reserved. Intended solely for authorised use by Bakery managers.

-----

*Authored by Tristen Bayley*

