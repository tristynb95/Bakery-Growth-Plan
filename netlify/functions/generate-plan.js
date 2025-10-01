const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { planSummary, month } = JSON.parse(event.body);
    
    // Securely get the API key from the environment variables you set in Netlify
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest"});

    // --- ENHANCED, MONTH-FOCUSED PROMPT ---
    const prompt = `
      You are an expert bakery operations manager. Your task is to create a best-practice, tactical action plan for a single month based on a manager's provided summary.

      **Primary Goal:** Generate a clean, self-contained HTML structure containing a single table for the specified month. Do NOT include navigation tabs or tables for other months.

      **Core Instructions:**
      1.  **Language**: You MUST use British English spelling and grammar (e.g., 'organise', 'centre').
      2.  **Analyse & Group**: Analyse the provided plan for the given month. Group similar or related tasks into single, actionable steps. For instance, 'Izzy to complete kitchen training' and 'Izzy to go into kitchen' should become one action like 'Organise kitchen training for Izzy'.
      3.  **Assign Pillars**: For each action step, you MUST assign one of the following four pillars:
          - **People**: Staff training, development, scheduling, morale.
          - **Customer**: Customer experience, feedback, Net Promoter Score (NPS).
          - **Product**: Product quality, availability, waste, delivery.
          - **Place**: Bakery cleanliness, audits, presentation, maintenance, local marketing.
      4.  **Strict HTML Structure**: The final output MUST be ONLY the HTML code block. Do not include markdown formatting like \`\`\`html.
      5.  **Manager's Name**: Refer to the manager by the name provided in the summary.
      6.  **Responses**: Your responses will be clear, concise, and actionable.
      7.  **Exclusive Focus**: You must only use the information given to you in the plan summary for the specified month. Do not add any extra information or make up any new actions.

      **Step-by-Step Thought Process (Chain-of-Thought):**
      1.  First, I will read the provided summary to understand the key objectives for the specified month.
      2.  Next, I will extract the specific tasks and goals only for that month.
      3.  I will then consolidate related tasks into concise, clear action steps.
      4.  For each action step, I will determine the most appropriate Pillar based on the definitions.
      5.  Finally, I will construct the complete HTML response with a single table as specified in the example below. I will leave the 'Status' cells empty.

      **Output Format Example (Single Table Only):**
      <table>
        <thead>
          <tr>
            <th>Action Step</th>
            <th>Pillar</th>
            <th>Owner</th>
            <th>Due Date</th>
            <th>Resources / Support Needed</th>
            <th>Status</th>
            <th class="actions-cell">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td contenteditable="true">Review daily waste reports and adjust production pars.</td>
            <td contenteditable="true">Product</td>
            <td contenteditable="true">Manager</td>
            <td contenteditable="true">Ongoing</td>
            <td contenteditable="true">Waste reports, Production planning tool</td>
            <td contenteditable="true"></td>
            <td class="actions-cell"><button class="btn-remove-row"><i class="bi bi-x-lg"></i></button></td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="7"><button class="btn-add-row"><i class="bi bi-plus-circle"></i> Add Row</button></td>
          </tr>
        </tfoot>
      </table>

      Here is the plan to analyse for Month ${month}:
      ---
      ${planSummary}
      ---
    `;

    const generationConfig = {
      temperature: 0.2,
      topK: 1,
      topP: 1,
      maxOutputTokens: 8192,
    };

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    });

    const response = await result.response;
    let aiText = response.text();

    aiText = aiText.replace(/^```(html)?\s*/, '').replace(/```$/, '').trim();

    return {
      statusCode: 200,
      body: JSON.stringify({ actionPlan: aiText }),
    };

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to generate AI plan." }),
    };
  }
};
