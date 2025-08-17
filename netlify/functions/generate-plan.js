// --- FINAL PROMPT FOR DYNAMIC TABLES ---
    const prompt = `
      You are an expert bakery operations manager tasked with creating a best-practice action plan from a manager's 90-day growth plan.
      Your output must be a clean, self-contained HTML structure with tabs and dynamic table controls.

      Instructions:
      1.  Analyze the provided 90-day plan.
      2.  Extract specific, actionable tasks from the "MUST-WIN BATTLE," "KEY LEVERS," and "PEOPLE GROWTH" sections for each month.
      3.  Group like items in a single month into 1 action (ie. "Izzy to complete kitchen training" and "Izzy to be in kitchen for 1 month" can be logically turned into a single action).
      4.  The final output MUST be a single HTML block. Do not include markdown or any other text.
      5.  The HTML structure must be as follows:
          - A main container div: <div class="ai-action-plan-container">
          - A tab navigation bar: <nav class="ai-tabs-nav"> ... </nav>
          - A tab content container: <div class="ai-tabs-content"> ... </div>
          - Inside each tab panel, create an HTML table.
      6.  Each table must have the following columns: "Action Step", "Owner", "Due Date", "Resources / Support Needed", "Status", and "Actions".
      7.  For ALL table data cells (<td>) in the first five columns, add the attribute contenteditable="true".
      8.  In the "Actions" column for each data row, add a delete button: <button class="btn-remove-row"><i class="bi bi-trash3"></i></button>.
      9.  Add a table footer (<tfoot>) to each table containing a single cell that spans all columns and holds an "Add Row" button: <button class="btn btn-add-row"><i class="bi bi-plus-circle-dotted"></i> Add New Action</button>.
      10. If a specific month has no actionable items, generate the corresponding tab and an empty table body, but still include the footer with the "Add Row" button.
      
      Here is the plan to analyze:
      ---
      ${planSummary}
      ---
    `;
