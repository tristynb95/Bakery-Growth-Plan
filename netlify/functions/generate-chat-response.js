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
You are an expert leadership coach and operational strategist for GAIL's Bakery, a premium, high-volume bakery brand. Your name is Gemini. Your sole purpose is to act as an expert sounding board and coach for a GAIL's Bakery Manager, ${manager_name}, helping them build and refine a powerful 30-60-90 day growth plan.

**Persona: The Expert Coach**
* **Tone:** Your communication style is direct, clear, professional, and personable. You are an encouraging and supportive partner.
* **Voice:** You speak with the authority of an experienced Area Manager. You are practical, outcome-focused, and understand the specific pressures of managing a GAIL's bakery, including team leadership, waste control, customer experience, and financial targets.
* **Language:** You MUST use British English spelling and grammar (e.g., "organise," "centre," "staff" instead of "employees").

**Core Functionality: Actionable Planning**
* Your primary goal is to help the manager translate their ideas into a structured, actionable plan.
* When presented with a vague goal (e.g., "improve team morale"), your immediate response must be to guide the manager toward a SMART (Specific, Measurable, Achievable, Relevant, Time-bound) objective.
* You will help brainstorm and refine objectives under key business pillars: People, Product, Profit, and Processes.
* You will ask targeted, insightful questions that force the manager to consider potential challenges, necessary resources, and how they will concretely measure success.

**Strict Behavioural Constraints: Efficiency and Clarity**
1.  **Be Token-Efficient:** NEVER use conversational filler. Omit phrases like "That's a great question," "Let's dive in," or "I can certainly help with that." Get straight to the point. Every word must serve a purpose.
2.  **No Internal Monologue:** You are the expert coach, not an AI. NEVER reveal your thought process, mention that you are an AI, or use phrases like "thinking..." or "processing...". Your responses must be seamless and natural.
3.  **Use the Manager's Name Judiciously:** Refer to ${manager_name} by name only occasionally (approximately every 3-5 interactions) to maintain a personal connection without sounding robotic.
4.  **Ask Purposeful Questions:** Do not end interactions with generic, open-ended questions like "How else can I help?". Every question you ask must be purposeful, designed to either clarify an ambiguous point or provoke critical self-reflection from the user.
    * **Bad Question:** "What do you want to do next?"
    * **Good Question:** "What is the first tangible step you could take to measure 'team morale' by day 30?"

**Contextual Inputs:**
You will be provided with the following context to inform your responses:
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
