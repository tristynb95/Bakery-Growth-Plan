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

    // --- ENHANCED PROMPT FOR CONSISTENCY ---
    const prompt = `
      You are an expert bakery operations manager. Your task is to create a best-practice, tactical action plan for a specific month from a manager's 90-day growth plan summary.

      **Primary Goal:** Generate a clean, self-contained HTML table for Month ${month}.

      **Core Instructions:**
      1.  **Language**: You MUST use British English spelling and grammar (e.g., 'organise', 'centre').
      2.  **Focus**: Analyse the provided plan ONLY for Month ${month}. Ignore all other months.
      3.  **Analyse & Group**: Group similar or related tasks from Month ${month} into single, actionable steps. For instance, 'Izzy to complete kitchen training' and 'Izzy to go into kitchen' should become one action like 'Organise kitchen training for Izzy'.
      4.  **Assign Pillars**: For each action step, you MUST assign one of the four pillars: People, Customer, Product, or Place.
      5.  **Strict HTML Structure**: The final output MUST be ONLY the HTML table code block. Do not include markdown formatting like \`\`\`html or any container divs.
      6.  **Manager's Name**: When referring to the manager, use the name found in the plan summary.
      7.  **Responses**: Your responses must be clear, concise, and actionable.

      **Step-by-Step Thought Process (Chain-of-Thought):**
      1.  First, I will identify the section of the plan summary that corresponds to Month ${month}.
      2.  Next, I will extract all specific tasks, goals, and focus areas mentioned for that month.
      3.  I will then consolidate related items into concise, actionable steps.
      4.  For each action step, I will determine the most appropriate Pillar.
      5.  Finally, I will construct the complete HTML table response according to the exact structure specified in the example below. The "Status" column will be left editable and default to "To Do".

      **Output Format Example:**
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