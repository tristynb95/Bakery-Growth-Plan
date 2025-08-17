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

    // --- FINAL PROMPT FOR DYNAMIC, SORTABLE TABLES ---
    // --- PROMPT FOR BUTTON-BASED TABS ---
    const prompt = `
      You are an expert bakery operations manager tasked with creating a best-practice action plan from a manager's 90-day growth plan.
      Your output must be a clean, self-contained HTML structure with tabs and dynamic, sortable tables.

      Instructions:
      1.  Analyze the provided 90-day plan.
      2.  The final output MUST be a single HTML block. Do not include markdown or any other text.
      3.  The HTML structure must be as follows:
          - A main container div: <div class="ai-action-plan-container">
          - A tab navigation bar: <nav class="ai-tabs-nav">
          - Three button elements inside the nav for the tabs: "Month 1", "Month 2", and "Month 3".
              - Each button should have the classes "btn btn-secondary ai-tab-btn".
              - The first tab button should also have the class "active".
              - Each tab button should have a "data-tab" attribute: "month1", "month2", "month3".
          - A tab content container: <div class="ai-tabs-content"> ... </div>
          - Inside each tab panel, create an HTML table with a <thead>, <tbody>, and <tfoot>.
      4.  The table header (<thead>) must contain the columns: "Action Step", "Owner", "Due Date", "Resources / Support Needed", "Status", and "Actions".
      5.  For ALL table data cells (<td>) in the first five columns, add the attribute contenteditable="true".
      6.  In the "Actions" column for each data row, add a delete button: <button class="btn-remove-row"><i class="bi bi-trash3"></i></button>.
      7.  Add a table footer (<tfoot>) to each table containing an "Add Row" button: <button class="btn btn-add-row"><i class="bi bi-plus-circle-dotted"></i> Add New Action</button>.
      
      Here is the plan to analyze:
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
