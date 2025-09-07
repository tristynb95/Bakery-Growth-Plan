const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const planSummary = JSON.parse(event.body).planSummary;
    
    // Securely get the API key from the environment variables you set in Netlify
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash"});

    // --- ENHANCED PROMPT FOR CONSISTENCY ---
    const prompt = `
      You are an expert bakery operations manager. Your task is to create a best-practice, tactical action plan from a manager's 90-day growth plan summary.

      **Primary Goal:** Generate a clean, self-contained HTML structure with tabs and three tables (one for each month).

      **Core Instructions:**
      1.  **Language**: You MUST use British English spelling and grammar (e.g., 'organise', 'centre').
      2.  **Analyse & Group**: Analyse the provided plan for Month 1, Month 2, and Month 3. Group similar or related tasks into single, actionable steps. For instance, 'Izzy to complete kitchen training' and 'Izzy to go into kitchen' should become one action like 'Organise kitchen training for Izzy'.
      3.  **Assign Pillars**: For each action step, you MUST assign one of the following four pillars:
          - **People**: Staff training, development, scheduling, morale.
          - **Customer**: Customer experience, feedback, Net Promoter Score (NPS).
          - **Product**: Product quality, availability, waste, delivery.
          - **Place**: Bakery cleanliness, audits, presentation, maintenance, local marketing.
      4.  **Strict HTML Structure**: The final output MUST be ONLY the HTML code block. Do not include markdown formatting like \`\`\`html.
      5. **Managers Name**: When referring to the manager in the action plan, you will use the manager name found at the top of the tab titled 'Vision & Sprints'
      6. **Responses**: My responses will be clear, concise and actionable. 

      **Step-by-Step Thought Process (Chain-of-Thought):**
      1.  First, I will read the entire plan summary to understand the key objectives for each month.
      2.  Next, for each month, I will extract the specific tasks and goals.
      3.  I will then consolidate related tasks into concise, clear action steps.
      4.  For each action step, I will determine the most appropriate Pillar based on the definitions.
      5.  Finally, I will construct the complete HTML response according to the exact structure specified in the example below, ensuring every required class, attribute, and element is present. I will leave the cells for 'Status' empty so the user can fill it themselves.

      **Output Format Example:**
      <div class="ai-action-plan-container">
        <nav class="ai-tabs-nav">
          <button class="btn btn-secondary ai-tab-btn active" data-tab="month1">Month 1</button>
          <button class="btn btn-secondary ai-tab-btn" data-tab="month2">Month 2</button>
          <button class="btn btn-secondary ai-tab-btn" data-tab="month3">Month 3</button>
        </nav>
        <div class="ai-tabs-content">
          <div class="active" data-tab-panel="month1">
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
                  <td contenteditable="true">To Do</td>
                  <td class="actions-cell"><button class="btn-remove-row"><i class="bi bi-x-lg"></i></button></td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="7"><button class="btn-add-row"><i class="bi bi-plus-circle"></i> Add Row</button></td>
                </tr>
              </tfoot>
            </table>
          </div>
          </div>
      </div>

      Here is the plan to analyse:
      ---
      ${planSummary}
      ---
    `;

    // Added GenerationConfig for more predictable output
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

    // Clean the response on the server to remove markdown backticks
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
