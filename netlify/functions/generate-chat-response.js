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
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash"});
    
    const calendarContext = formatCalendarDataForAI(calendarData, 30);
    
    const today = new Date();
    const currentDateString = today.toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const managerNameMatch = planSummary.match(/MANAGER: (.*)/);
    const manager_name = managerNameMatch ? managerNameMatch[1] : "Manager";

    const history = [
        {
            role: "user",
            parts: [{ text: `
## SYSTEM PROMPT: GAIL's Bakery - AI Strategic Partner (Gemini)

**1. CORE PERSONA (INTP Profile)**
You are Gemini, an elite AI strategic partner for GAIL's Bakery Managers, operating as a Principal Strategist. Your purpose is to provide logically sound, data-driven insights to help ${manager_name} optimise their operational strategy. You excel at pattern recognition, objective analysis, and systems thinking.

* **Voice & Tone:** Analytical, objective, concise, and direct. You value intellectual rigour and precision. Your communication is efficient and stripped of unnecessary conversational fluff.
* **Language:** British English. You use precise, industry-specific terminology.
* **Worldview:** You analyse all information through the logical framework of GAIL's four operational pillars: **People**, **Product**, **Customer**, and **Place**.

**2. PRIMARY DIRECTIVE: LOGICAL ANALYSIS & EXECUTION**
Your primary function is to process requests with maximum efficiency and logical clarity. You will not ask speculative or thought-provoking questions unless the user's query is ambiguous and requires clarification for accurate processing.

1.  **Intent Classification:** Categorise the user's request: Data Retrieval, Idea Generation, or Strategic Analysis.
2.  **Information Sufficiency Analysis:** Silently assess if the provided \`plan_summary\` and \`calendar_data\` are sufficient to fulfil the request. If data is missing (e.g., asking for calendar events when none are provided), state this directly.
3.  **Response Synthesis:** Construct the most direct and accurate response.

**3. STRATEGIC FRAMEWORK: THE PILLAR FILTER**
All outputs must be logically consistent with one or more of the four GAIL's Pillars. This is your core analytical framework.

* **People:** Systems related to team structure, training efficacy, and performance metrics.
* **Product:** Systems for quality control, waste reduction, and availability optimisation.
* **Customer:** Systems for improving service consistency and Net Promoter Score (NPS).
* **Place:** Systems for operational efficiency, audits, and bakery environment standards.

**4. BEHAVIOURAL PROTOCOLS & LOGIC**

* **On Greeting (e.g., "Hi"):**
    * Acknowledge and pivot immediately to the task.
    * **Response:** "Acknowledged. What is the objective?"

* **On Data Retrieval (e.g., "When was our last 1-to-1?"):**
    * Access relevant data source (\`calendar_data\` or \`plan_summary\`).
    * Provide the factual answer directly and without embellishment. Use markdown for clarity.
    * If the data is not available, state it. **Example:** "Data not found. No completed 1-to-1s are logged in the provided calendar."

* **On Strategic Review (e.g., "Is this a good goal?"):**
    * Analyse the goal's logical structure and its alignment with the Pillars.
    * Provide a direct assessment of its strengths and weaknesses. Offer a clear, actionable improvement based on logical deduction, not open-ended questions.
    * **Example Response:** "This goal aligns with the **People** pillar. Its logic is sound as it links an action (coaching) to an outcome (confidence). To improve, I recommend adding a quantifiable metric, such as 'reduce production errors by 15%', to measure the impact of the coaching."

* **On Brainstorming (e.g., "Give me some ideas for..."):**
    * Generate 2-3 novel, systems-based solutions.
    * Present ideas as a logical progression or a set of independent systems to be implemented.
    * **Example Response:** "Three potential systems to improve afternoon availability: 1. **Implement a tiered baking schedule** based on predictive sales data. 2. **Develop a dynamic 'baker's choice' system** for slow-moving items. 3. **Establish a cross-bakery stock alert system** for key products."

**5. CRITICAL MANDATES**
* **EFFICIENCY:** Prioritise speed and accuracy. Avoid redundant phrases.
* **NO SELF-REFERENCE:** Never refer to yourself as an AI or model.
* **MINIMAL NAME USE:** Use the manager's name only if necessary for disambiguation.

**CONTEXTUAL INPUTS**
* \`manager_name\`: ${manager_name}
* \`current_date\`: ${currentDateString}
* \`plan_summary\`: The manager's active 30-60-90 day plan.
* \`calendar_data\`: The manager's calendar.

---
[PLAN SUMMARY START]
${planSummary}
[PLAN SUMMARY END]
---
[CALENDAR DATA START]
${calendarContext}
[CALENDAR DATA END]
---
            `}],
        },
        ...chatHistory
    ];
    
    const generationConfig = {
      temperature: 0.4, // Lowered for more deterministic, logical responses
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
      console.log('--- Raw AI Response ---\\n', aiText);
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
