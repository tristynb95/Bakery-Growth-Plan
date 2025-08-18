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
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro"});

    // --- UPDATED PROMPT TO ENFORCE BRITISH ENGLISH ---
    const prompt = `
      You are an expert bakery operations manager tasked with creating a best-practice action plan from a manager's 90-day growth plan.
      Your output must be a clean, self-contained HTML structure with tabs and three tables.

      **Language Requirement:** You MUST write all responses and action steps using British English spelling and grammar (e.g., 'organise' instead of 'organize', 'centre' instead of 'center').

      **Primary Goal:** Your main task is to generate three complete tables, one for each month of the 90-day plan, including a "Pillar" column populated with the correct value.

      **Pillar Definitions:**
      You MUST assign one of the following four pillars to each action step:
      - **People**: Use for anything related to staff, training, development, scheduling, or team morale.
      - **Customer**: Use for anything directly relating to customers, customer experience, feedback, or Net Promoter Score (NPS).
      - **Product**: Use for anything related to our products, quality, availability, waste, or delivery.
      - **Place**: Use for anything related to the physical bakery, including cleanliness, audits, presentation, maintenance, or local marketing.

      **Instructions:**
      1.  Analyze the provided 90-day plan to find actions for Month 1, Month 2, and Month 3.
      2.  The final output MUST be a single HTML block containing the full tabbed structure as described below.
      3.  The HTML structure must be:
          - A main container div: <div class="ai-action-plan-container">
          - A tab navigation bar: <nav class="ai-tabs-nav">
          - Three button elements for the tabs: "Month 1", "Month 2", and "Month 3".
              - Each button should have the classes "btn btn-secondary ai-tab-btn", a "data-tab" attribute ("month1", "month2", "month3"), and the first button should also have the class "active".
          - A tab content container: <div class="ai-tabs-content">
          - Three tab panel divs, one for each month, with corresponding "data-tab-panel" attributes. The first panel should have the class "active".
      4.  **Inside each of the three tab panels, you MUST create a complete HTML table (with <thead>, <tbody>, and <tfoot>).**
      5.  The table header (<thead>) must contain the columns in this specific order: "Action Step", "Pillar", "Owner", "Due Date", "Resources / Support Needed", "Status", and "Actions".
      6.  Populate the table body (<tbody>) with the action items for that specific month. For each row, you MUST assign the most appropriate pillar based on the definitions above.
      7.  If a particular month has no actions, you must still generate the full table structure for that month, just with an empty <tbody>.
      8.  For ALL table data cells (<td>) in the first six columns, add the attribute contenteditable="true".
      9.  In the "Actions" column for each data row, add a delete button: <button class="btn-remove-row"><i class="bi bi-trash3"></i></button>.
      10. Add a table footer (<tfoot>) to each of the three tables containing an "Add Row" button.
      
      Here is the plan to analyse:
      ---
      ${planSummary}
      ---
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const aiText = response.text();

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
