const { google } = require('googleapis');

exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { docTitle, monthTitle, bakeryInfo, headers, rows, userEmail } = JSON.parse(event.body);

        // 1. AUTHENTICATION
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GCP_CLIENT_EMAIL,
                project_id: process.env.GCP_PROJECT_ID,
                private_key: process.env.GCP_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: [
                'https://www.googleapis.com/auth/documents',
                'https://www.googleapis.com/auth/drive.file'
            ],
        });

        const docs = google.docs({ version: 'v1', auth });
        const drive = google.drive({ version: 'v3', auth });

        // 2. CREATE THE GOOGLE DOC
        const createResponse = await docs.documents.create({
            requestBody: {
                title: docTitle,
            },
        });

        const documentId = createResponse.data.documentId;

        // 3. BUILD THE DOCUMENT CONTENT REQUESTS
        const requests = [
            // Insert Header
            {
                insertText: {
                    location: { index: 1 },
                    text: `${docTitle}\n`,
                },
            },
            {
                updateParagraphStyle: {
                    range: { startIndex: 1, endIndex: docTitle.length + 1 },
                    paragraphStyle: { namedStyleType: 'TITLE' },
                    fields: 'namedStyleType',
                },
            },
            {
                insertText: {
                    location: { index: docTitle.length + 1 },
                    text: `${monthTitle}\n`,
                },
            },
            {
                updateParagraphStyle: {
                    range: { startIndex: docTitle.length + 1, endIndex: docTitle.length + monthTitle.length + 2 },
                    paragraphStyle: { namedStyleType: 'SUBTITLE' },
                    fields: 'namedStyleType',
                },
            },
             {
                insertText: {
                    location: { index: docTitle.length + monthTitle.length + 2 },
                    text: `${bakeryInfo}\n\n`,
                },
            },
            // Create Table
            {
                insertTable: {
                    location: { index: docTitle.length + monthTitle.length + bakeryInfo.length + 4 },
                    rows: rows.length + 1, // +1 for header row
                    columns: headers.length,
                },
            },
        ];

        // 4. POPULATE TABLE
        let currentIndex = docTitle.length + monthTitle.length + bakeryInfo.length + 4 + 4; // Start index inside the first cell
        
        // Populate Header Row
        headers.forEach(header => {
            requests.push({ insertText: { location: { index: currentIndex }, text: header } });
            requests.push({
                updateTextStyle: {
                    range: { startIndex: currentIndex, endIndex: currentIndex + header.length },
                    textStyle: { bold: true },
                    fields: 'bold',
                },
            });
            currentIndex += header.length + 2; // Move to next cell
        });

        // Populate Data Rows
        rows.forEach(row => {
            row.forEach(cellText => {
                requests.push({ insertText: { location: { index: currentIndex }, text: cellText } });
                currentIndex += cellText.length + 2; // Move to next cell
            });
        });


        // 5. EXECUTE BATCH UPDATE
        await docs.documents.batchUpdate({
            documentId: documentId,
            requestBody: {
                requests: requests,
            },
        });

        // 6. SHARE THE DOCUMENT WITH THE USER
        await drive.permissions.create({
            fileId: documentId,
            requestBody: {
                role: 'writer',
                type: 'user',
                emailAddress: userEmail,
            },
        });


        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Document created successfully!',
                docUrl: `https://docs.google.com/document/d/${documentId}/edit`,
            }),
        };

    } catch (error) {
        console.error('Error creating Google Doc:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'An internal error occurred while creating the Google Doc.' }),
        };
    }
};
