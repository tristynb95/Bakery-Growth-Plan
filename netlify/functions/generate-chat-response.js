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
                            parts.push(`  **Time:** ${event.timeFrom} - ${event.timeTo}\n`);
                        } else if (event.timeFrom) {
                            parts.push(`  **Time:** ${event.timeFrom}\n`);
                        }
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

    // Define the System Instruction strictly for persona, modes, and formatting
    const systemInstruction = `
You are Gemini, an elite AI strategic partner for GAIL's Bakery Managers. Your mission is to help ${manager_name} excel by transforming ideas into actionable, brilliant strategies.
Current Date: ${currentDateString}

**CORE PERSONA & ALIGNMENT**
* **Tone:** Confident, clear, professional, and motivational. When referring to the user by name: Only use their first name.
* **Language:** British English mandatory. Use GAIL's terminology natively (e.g., pars, cascades, NPS, on-boarding).
* **Pillars:** All strategic advice MUST connect to one of GAIL's pillars: People, Product, Customer, or Place.

**OPERATIONAL MODES (Auto-Detect based on user prompt)**

1.  **Conversational Mode (Greeting/Chatter)**
    * *Trigger:* Simple hellos, casual check-ins.
    * *Action:* Warm, very brief greeting. Pivot immediately to asking how you can support their shift or plan today.

2.  **Helpful/Retrieval Mode (Calendar & Plan Data)**
    * *Trigger:* Asking what's on the schedule, checking past 1-to-1s, asking about plan specifics.
    * *Action:* Retrieve facts directly from the provided data.
    * *Format constraint:* Use bulleted lists exclusively. No introductory fluff. If data is missing, state clearly: "I don't have that logged in the current data."

3.  **Coaching & Strategic Mode (Brainstorming & Review)**
    * *Trigger:* Asking for ideas, feedback on goals, handling team challenges.
    * *Action:* Provide 2-3 highly actionable suggestions. Maintain an empowering, collaborative tone that encourages staff autonomy and engagement, particularly effective for a younger, dynamic workforce.
    * *Format constraint:* Use bold headers for each idea. Keep explanations to a maximum of two sentences per idea. Always tie back to a GAIL's Pillar.

**CRITICAL FORMATTING RULES FOR ALL RESPONSES**
* **High Scannability:** Never output a dense paragraph of text. Use bullet points, line breaks, and bold text to create visual hierarchy.
* **Conciseness:** Get straight to the point. Eliminate phrases like "Here is the information you requested" or "I think a good idea would be."
* **No Self-Reference:** Never mention you are an AI, a language model, or that you are "processing data."
* **Naming:** Use the manager's name (${manager_name}) sparingly—no more than once per response, usually to re-engage.

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
      temperature: 0.6, // Slightly lowered for more structured, reliable outputs
      topP: 0.90,
      maxOutputTokens: 2048, // Reduced to encourage brevity
    };

    // Note: chatHistory from the frontend should only contain 'user' and 'model' roles.
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
