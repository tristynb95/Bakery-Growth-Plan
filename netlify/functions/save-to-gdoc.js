// File: netlify/functions/save-to-gdoc.js

const { google } = require('googleapis');

exports.handler = async (event) => {
    // We only want to handle POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { content } = JSON.parse(event.body);
        if (!content) {
            return { statusCode: 400, body: 'JSON body with a "content" key is required.' };
        }

        // Step 1: Authenticate with the Google API
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                // Ensure private key's newline characters are correctly formatted for authentication
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/documents'],
        });

        const authClient = await auth.getClient();

        // Step 2: Initialize the Google Docs API client with authentication
        const docs = google.docs({
            version: 'v1',
            auth: authClient,
        });

        // Step 3: Create a new Google Doc with a title
        const createResponse = await docs.documents.create({
            resource: {
                title: 'Your Bakery Growth Plan',
            },
        });

        const documentId = createResponse.data.documentId;

        // Step 4: Add the plan content to the newly created document
        await docs.documents.batchUpdate({
            documentId,
            resource: {
                requests: [
                    {
                        insertText: {
                            // Insert the text at the beginning of the document body
                            location: {
                                index: 1,
                            },
                            text: content,
                        },
                    },
                ],
            },
        });
        
        // Step 5: Construct the URL for the new document to send back to the user
        const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                message: 'Successfully created Google Doc!',
                url: docUrl
            }),
        };

    } catch (error) {
        // Log the error for debugging and return a user-friendly error message
        console.error('Error creating Google Doc:', error.response ? error.response.data : error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to create Google Doc.',
                details: error.response ? error.response.data.error.message : error.message,
            }),
        };
    }
};
