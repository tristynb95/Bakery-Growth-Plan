<h2>GAIL's Bakery Growth Planner</h2><br>

An all-in-one digital hub for the planning and execution of bakery operations, built for Bakery Managers at GAIL's.

The Bakery Growth Planner is a modern web application designed to empower GAIL's Bakery Managers by streamlining the 30-60-90 day planning process. It replaces static documents with a dynamic, interactive, and intelligent platform, integrating AI to provide personalised support and reduce administrative overhead.

This tool serves as a central hub for managers to define their vision, set actionable goals, track progress, and foster team development, ensuring alignment with GAIL's core pillars: People, Product, Customer, and Place.

<br>
<h3>✨ Key Features:</h3>

📝 Guided 30-60-90 Day Plan: An intuitive, step-by-step template that walks managers through creating a comprehensive quarterly plan, from high-level vision to weekly check-ins.

📊 Interactive Dashboard: A central view of all growth plans, showcasing completion progress and last-edited status for quick access and management.

🗓️ Integrated Calendar: A full-featured calendar to schedule key dates, training sessions, 1-to-1s, and operational deadlines, directly linked to your growth plan.

🤖 AI-Generated Action Plans: Leverage the power of Google's Gemini AI to automatically generate a tactical, editable action plan from your completed 90-day summary, saving time and ensuring best practices.

☁️ Real-time Cloud Sync: All data is saved instantly and continuously to the cloud via Firebase, allowing you to access and edit your plans from any device.

🖨️ Printable & Shareable Summaries: Generate clean, professional summaries of your plan, perfect for printing or sharing a secure, read-only link with your line manager.

👤 User Profiles: A dedicated space for managers to manage their account details and profile photo.

<br>
<h3>🚀 Roadmap & Future Features</h3>
🧠 Myers-Briggs Integration: AI-generated action plans tailored to a manager's specific Myers-Briggs personality type for more effective strategies.

💬 AI Companion Chatbot: An intelligent assistant to support managers with real-time planning, execution advice, and data analysis.

👨‍👩‍👧‍👦 Team "Family Tree": A module to visualise your team structure, track individual development goals, and manage training schedules.

<br>
<h3>🛠️ Tech Stack & Architecture</h3>
This application is built with a modern, scalable, and secure architecture, prioritising performance and maintainability.

- Frontend: Vanilla JavaScript (ES Modules), HTML5, Tailwind CSS

- Backend: Netlify Serverless Functions (Node.js)

- Database: Google Cloud Firestore (Real-time NoSQL)

- Authentication: Firebase Authentication

- AI Integration: Google AI Gemini API

- Deployment & Hosting: Netlify

- Build Tool: Vite

The architecture is decoupled, with a static frontend that communicates with a secure serverless backend. This approach ensures that sensitive API keys (for Firebase and Google AI) are never exposed on the client-side. Firestore provides real-time data synchronisation, which is essential for a seamless user experience across devices.

<br>
<h3>⚙️ Getting Started**</h3>
Follow these instructions to set up and run the project locally for development.

<h4>Prerequisites</h4>
- Node.js (v18 or later recommended)

- npm or yarn

- A Firebase project with Firestore and Authentication enabled.

- A Google AI API Key for Gemini.

- Netlify CLI

<br>
<h4>Local Development Setup</h4>
Clone the repository:

git clone [https://github.com/tristynb95/bakery-growth-plan.git](https://github.com/tristynb95/bakery-growth-plan.git)
cd bakery-growth-plan

Install dependencies:

npm install

Set up environment variables:
Create a .env file in the root of the project by copying the example file:

cp .env.example .env

Now, fill in the .env file with your credentials from your Firebase project and Google AI Studio.

Run the development server:
This project uses the Netlify CLI to correctly serve the application and its serverless functions locally.

netlify dev

This command will start the Vite development server and the Netlify functions emulator. You can access the application at the URL provided in the terminal (usually http://localhost:8888).

<br>
<h3>📁 Folder Structure</h3>
/
├── js/                  # Frontend JavaScript modules
│   ├── api.js           # Handles API calls to Netlify functions
│   ├── auth.js          # Authentication logic and UI
│   ├── calendar.js      # Interactive calendar functionality
│   ├── dashboard.js     # Dashboard view logic
│   ├── main.js          # Main application entry point
│   ├── plan-view.js     # Logic for the 30-60-90 plan view
│   ├── profile.js       # User profile page logic
│   ├── ui.js            # General UI components (modals, menus)
│   └── view.js          # Logic for the public shareable view
├── netlify/
│   └── functions/       # Serverless backend functions
│       ├── config.js    # Securely serves Firebase config
│       └── generate-plan.js # Handles calls to the Gemini AI API
├── index.html           # Main application shell
├── profile.html         # User profile page
├── view.html            # Public shareable plan page
├── style.css            # Custom CSS styles with Tailwind directives
├── vite.config.js       # Vite build configuration
└── netlify.toml         # Netlify deployment configuration

<br>
<h3>🤝 Contributing**</h3>
Contributions are welcome! Please follow these steps to contribute:

Fork the repository.

Create a new branch (git checkout -b feature/your-feature-name).

Make your changes and commit them (git commit -m 'Add some feature').

Push to the branch (git push origin feature/your-feature-name).

Open a Pull Request.

<br>
<h3>📄 License**</h3>
This project is proprietary and intended for use by GAIL's Bakery managers. All rights reserved.

<br>
<br>
Created with ❤️ by Tristen Bayley
