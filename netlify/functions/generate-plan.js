const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { planSummary, managerName } = JSON.parse(event.body);

    if (!planSummary || !managerName) {
      return { statusCode: 400, body: JSON.stringify({ error: "Request must include planSummary and managerName." }) };
    }
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // For highest quality, consider switching to a more powerful model if your budget allows.
    // For now, we will optimise the prompt for the current model.
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 

    // --- NEW PROMPT FOCUSED ON OUTPUT QUALITY ---
    const prompt = `
      **Your Persona:** You are a world-class Operations Manager for a premium artisanal bakery brand like GAIL's. You are an expert at translating a manager's high-level notes into a formal, actionable, and professional tactical plan.

      **Your Task:** Transform the provided 'Plan Summary' into a structured HTML action plan. Do not just rephrase the input; synthesize it into concrete, professional operational tasks.

      **Guiding Principles:**
      1.  **Strategic Synthesis:** Look beyond the literal tasks. What is the underlying goal? Formulate actions that strategically achieve that goal. For instance, if the note says "check waste," your action should be "Implement and monitor a daily waste tracking system to identify trends and adjust production pars."
      2.  **Actionability & Clarity:** Every action step must be a specific, verifiable task. Use strong, active verbs (e.g., "Implement," "Schedule," "Analyse," "Develop").
      3.  **Professional Language:** Use industry-standard, professional British English. The output should sound like it comes from an experienced senior manager.

      **High-Quality Transformation Example:**
      * **IF THE INPUT IS:** "Month 1 Goal: Get better at afternoons. Izzy kitchen training. Check waste."
      * **YOUR OUTPUT SHOULD BE (like this):**
          <tr>
            <td contenteditable="true">Develop and implement a new afternoon bake schedule to ensure 90% availability of key products between 2 PM and 4 PM.</td>
            <td contenteditable="true">Product</td>
            <td contenteditable="true">${managerName}</td>
            <td contenteditable="true">Wk 2</td>
            <td contenteditable="true">Sales data, Production capacity charts</td>
            <td contenteditable="true"></td>
            <td class="actions-cell"><button class="btn-remove-row"><i class="bi bi-trash3"></i></button></td>
          </tr>
          <tr>
            <td contenteditable="true">Schedule and conduct a comprehensive kitchen skills assessment for Izzy to identify and bridge any training gaps.</td>
            <td contenteditable="true">People</td>
            <td contenteditable="true">${managerName}</td>
            <td contenteditable="true">Wk 1</td>
            <td contenteditable="true">Training checklist, Senior Baker's time</td>
            <td contenteditable="true"></td>
            <td class="actions-cell"><button class="btn-remove-row"><i class="bi bi-trash3"></i></button></td>
          </tr>

      **Strict Rules:**
      - **Pillar Assignment:** You MUST assign one pillar to each action: **People**, **Customer**, **Product**, or **Place**.
      - **HTML Only:** The entire output MUST be only the HTML code block, starting with \`<div class="ai-action-plan-container">\` and ending with \`</div>\`. Do not include \`\`\`html markdown.
      - **Manager's Name:** The 'Owner' column must be filled with the manager's name: **${managerName}**.

      ---
      **Manager's Name for this Plan:** ${managerName}
      **Plan Summary to Transform:**
      ${planSummary}
      ---

      Now, generate the complete, high-quality HTML action plan.
    `;

    // Increased temperature slightly to allow for more nuanced, professional language
    const generationConfig = {
      temperature: 0.4,
      topK: 32,
      topP: 1,
      maxOutputTokens: 8192,
    };

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    });

    const response = result.response;
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
