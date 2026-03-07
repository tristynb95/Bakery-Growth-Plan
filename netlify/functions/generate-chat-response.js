// netlify/functions/generate-chat-response.js

const { GoogleGenerativeAI } = require("@google/generative-ai");

function formatCalendarDataForAI(calendarData, daysToLookBack = 0) {
    if (!calendarData || Object.keys(calendarData).length === 0) {
        return "The user's calendar is currently empty.";
    }
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - daysToLookBack);
    
    let calendarString = "Here is a summary of the user's upcoming calendar events:\n";
    if (daysToLookBack > 0) {
        calendarString = `Here is a summary of the user's calendar events from the last ${daysToLookBack} days and onwards:\n`
    }
    const sortedDates = Object.keys(calendarData).sort();
    
    const parts = [calendarString];
    for (const dateKey of sortedDates) {
        const eventDate = new Date(dateKey);
        if (eventDate >= startDate) {
            const events = calendarData[dateKey];
            if (events && events.length > 0) {
                const formattedDate = eventDate.toLocaleDateString('en-GB', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
                parts.push(`\n**${formattedDate}:**\n`);

                events.forEach(event => {
                    parts.push(`* **Event:** "${event.title}"\n  **Type:** ${event.type}\n`);
                    if (!event.allDay) {
                        if (event.timeFrom && event.timeTo) {
                            parts.push(`  **Time:** ${event.timeFrom} - ${event.timeTo}\n\n`);
                        } else if (event.timeFrom) {
                            parts.push(`  **Time:** ${event.timeFrom}\n\n`);
                        }
                    } else {
                        parts.push(`\n`); // extra break for all-day events
                    }
                });
            }
        }
    }
    return parts.join('');
}


exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { planSummary, chatHistory, userMessage, calendarData } = JSON.parse(event.body);
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    const calendarContext = formatCalendarDataForAI(calendarData, 30);
    
    const today = new Date();
    const currentDateString = today.toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Extract manager's name from the plan summary
    const managerNameMatch = planSummary.match(/MANAGER: (.*)/);
    const manager_name = managerNameMatch ? managerNameMatch[1] : "Manager";

    // Define the System Instruction strictly for persona, modes, and aggressive formatting
    const systemInstruction = `
You are Gemini, an elite AI strategic partner for GAIL's Bakery Managers. Your mission is to help ${manager_name} excel by transforming ideas into actionable, brilliant strategies.
Current Date: ${currentDateString}

**CORE PERSONA & ALIGNMENT**
* **Tone:** Confident, clear, professional, and motivational. Tailored to inspire and manage a dynamic, predominantly young workforce (ages 17-33).
* **Language:** British English mandatory. Use GAIL's terminology natively (e.g., pars, cascades, NPS, on-boarding).
* **Pillars:** All strategic advice MUST connect to one of GAIL's pillars: People, Product, Customer, or Place.

**OPERATIONAL MODES (Auto-Detect based on user prompt)**

1.  **Conversational Mode (Greeting/Chatter)**
    * *Trigger:* Simple hellos, casual check-ins.
    * *Action:* Warm, very brief greeting. Pivot immediately to asking how you can support their shift or plan today.

2.  **Helpful/Retrieval Mode (Calendar & Plan Data)**
    * *Trigger:* Asking what's on the schedule, checking past 1-to-1s, asking about plan specifics.
    * *Action:* Retrieve facts directly from the provided data.
    * *Format constraint:* Use bulleted lists exclusively. 

3.  **Coaching & Strategic Mode (Brainstorming & Review)**
    * *Trigger:* Asking for ideas, feedback on goals, handling team challenges.
    * *Action:* Provide 2-3 highly actionable suggestions. 
    * *Format constraint:* Keep explanations to a maximum of two sentences per idea. Always tie back to a GAIL's Pillar.

**CRITICAL FORMATTING & SPACING RULES (MANDATORY)**
* **WHITESPACE IS REQUIRED:** You MUST insert a double line break (a blank line) between EVERY paragraph, EVERY header, and EVERY list item. Do not bunch text together.
* **Headers:** Use **Bold Text** for headers and key concepts to create visual hierarchy.
* **Scannability:** Never output a dense block of text. If you write more than three sentences, break it up.
* **Conciseness:** Get straight to the point. Eliminate introductory fluff like "Here are some ideas for your plan."
* **No Self-Reference:** Never mention you are an AI, a language model, or that you are "processing data."
* **Naming:** Use the manager's name (${manager_name}) sparingly. Use the first name only: "Tristen Bayley" becomes  "Tristen".

**CONTEXTUAL DATA**
--- [PLAN SUMMARY] ---
${planSummary}
--- [CALENDAR DATA] ---
${calendarContext}
`;

    // Initialise model with systemInstruction
    const model = genAI.getGenerativeModel({ 
        model: "gemini-3.1-flash-lite-preview",
        systemInstruction: {
            parts: [{ text: systemInstruction }]
        }
    });

    const generationConfig = {
      temperature: 0.6, 
      topP: 0.90,
      maxOutputTokens: 2048, 
    };

    const chat = model.startChat({
        history: chatHistory,
        generationConfig,
    });

    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    const aiText = response.text();

    return {
      statusCode: 200,
      body: JSON.stringify({ response: aiText }),
    };

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "The AI assistant is currently unavailable. Please try again later." }),
    };
  }
};
