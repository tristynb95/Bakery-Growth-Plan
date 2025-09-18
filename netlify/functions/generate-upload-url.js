const admin = require('firebase-admin');

// --- Firebase Admin Initialization ---
if (admin.apps.length === 0) {
  try {
    const serviceAccount = JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf-8')
    );
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    });
  } catch (error) {
    console.error('Firebase Admin Initialization Error:', error);
    // This is a critical error, the function cannot proceed.
    throw new Error('Firebase Admin SDK could not be initialized.');
  }
}

const bucket = admin.storage().bucket();

// --- Main Function Handler ---
exports.handler = async function(event) {
  // 1. We only accept POST requests for this action.
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    // 2. Parse the incoming request from the browser.
    // We expect the browser to tell us the file's name and type.
    const { fileName, fileType, userId, planId } = JSON.parse(event.body);

    // 3. Basic validation: Ensure we have the necessary info.
    if (!fileName || !fileType || !userId || !planId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields: fileName, fileType, userId, or planId.' }) };
    }

    // 4. Define where the file will be stored in Firebase Storage.
    // This creates a secure and organized folder structure.
    const filePath = `uploads/${userId}/${planId}/${Date.now()}-${fileName}`;
    const file = bucket.file(filePath);

    // 5. Configure the secure link.
    // - It's valid for 15 minutes.
    // - It can only be used for 'PUT' (upload) operations.
    // - We must specify the exact content type to prevent security risks.
    const options = {
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType: fileType,
    };

    // 6. Generate the signed URL from Firebase.
    const [signedUrl] = await file.getSignedUrl(options);
    
    // 7. Send the secure URL and the final storage path back to the browser.
    return {
      statusCode: 200,
      body: JSON.stringify({
        uploadUrl: signedUrl,
        storagePath: filePath, // We'll need this later to save to the database
      }),
    };

  } catch (error) {
    console.error('Error generating signed URL:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `An unexpected error occurred: ${error.message}` }),
    };
  }
};
