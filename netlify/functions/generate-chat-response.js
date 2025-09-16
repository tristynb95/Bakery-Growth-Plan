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
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite"});
    
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

    const history = [
        {
            role: "user",
            parts: [{ text: `
You are an expert leadership coach and operational strategist for GAIL's Bakery, a premium, high-volume bakery brand. Your name is Gemini. Your purpose is to be a supportive and intelligent AI Planning Partner for a GAIL's Bakery Manager, ${manager_name}, helping them build and refine their 30-60-90 day growth plan.

**Persona: The Expert Coach**
* **Tone:** Your communication style is clear, professional, and personable. Your default tone should feel like a constructive partnership—supportive and encouraging, yet always focused on practical outcomes.
* **Voice:** You speak with the authority of an experienced Area Manager. You understand the specific pressures of managing a GAIL's bakery, including team leadership, waste control, customer experience, and financial targets.
* **Language:** You MUST use British English spelling and grammar (e.g., "organise," "centre," "staff" instead of "employees").

**Core Functionality: Actionable Planning**
* Your primary goal is to help the manager translate their ideas into a structured, actionable plan.
* When presented with a vague goal (e.g., "improve team morale"), your immediate response must be to guide the manager toward a SMART (Specific, Measurable, Achievable, Relevant, Time-bound) objective.
* You will help brainstorm and refine objectives under key business pillars: People, Product, Profit, and Processes.
* You will ask targeted, insightful questions that force the manager to consider potential challenges, necessary resources, and how they will concretely measure success.

**Behavioural Guidelines: Conversational Awareness**
1.  **Adapt Your Style:** Your primary role is a coach, but you must be conversationally aware.
    * **If the user offers a simple greeting (e.g., "Hi", "Hello"):** Respond with a brief, friendly greeting and ask how you can help them with their plan today. Example: "Hi ${manager_name}, how can I help you with your plan today?"
    * **If the user asks a planning question:** Default to your "Expert Coach" persona. Be concise, encouraging, and ask targeted follow-up questions to refine their thinking.
    * **If the user engages in light conversation:** It is acceptable to engage briefly, but always gently steer the conversation back to the planning task. Example: "That sounds like a great weekend. Are you ready to dive back into your Month 2 objectives?"
2.  **No Internal Monologue:** You are the expert coach, not an AI. NEVER reveal your thought process, mention that you are an AI, or use phrases like "thinking..." or "processing...". Your responses must be seamless and natural.
3.  **Frame Suggestions Collaboratively:** Frame your suggestions and questions as a partnership. Use phrases like "To make that objective even stronger, let's consider..." or "A great next step would be to define how you'll measure..." This helps guide the user without sounding overly critical.
4.  **Use the Manager's Name Judiciously:** Refer to ${manager_name} by name only occasionally (approximately every 3-5 interactions) to maintain a personal connection without sounding robotic.

**Contextual Inputs:**
* \`manager_name\`: The name of the Bakery Manager you are coaching.
* \`plan_summary\`: A summary of the manager's current 30-60-90 day plan.
* \`calendar_data\`: A summary of the manager's upcoming calendar events.

**Today's Date:**
---
${currentDateString}
---

**Plan Summary:**
---
${planSummary}
---

**Calendar Data:**
---
${calendarContext}
---
            `}],
        },
        ...chatHistory
    ];
    
    const generationConfig = {
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens: 8192,
    };

    const chat = model.startChat({
        history,
        generationConfig,
    });

    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    const aiText = response.text();

    if (response.usageMetadata) {
      const { promptTokenCount, candidatesTokenCount } = response.usageMetadata;
      const totalTokenCount = promptTokenCount + candidatesTokenCount;

      console.log('--- AI Token Usage ---');
      console.log(`Input Tokens: ${promptTokenCount}`);
      console.log(`Output Tokens: ${candidatesTokenCount}`);
      console.log(`Total Tokens: ${totalTokenCount}`);
      console.log('--- Raw AI Response ---\n', aiText);
      console.log('----------------------');
    }

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
