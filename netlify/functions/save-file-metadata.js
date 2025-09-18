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
    throw new Error('Firebase Admin SDK could not be initialized.');
  }
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

// --- Main Function Handler ---
exports.handler = async function(event) {
  // 1. We only accept POST requests.
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    // 2. Parse the incoming data from the browser.
    // This includes all the details we need to create the database record.
    const { fileName, fileType, storagePath, userId, planId } = JSON.parse(event.body);

    // 3. Validate the data.
    if (!fileName || !fileType || !storagePath || !userId || !planId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required metadata fields.' }) };
    }

    // 4. Get a reference to the file in Firebase Storage to get its public URL.
    const file = bucket.file(storagePath);
    const publicUrl = file.publicUrl();

    // 5. Define the reference to the 'files' collection in Firestore.
    // This is where we will store the record of the uploaded file.
    const fileMetadataRef = db.collection('users').doc(userId)
                              .collection('plans').doc(planId)
                              .collection('files');

    // 6. Add the new document to the collection.
    await fileMetadataRef.add({
      name: fileName,
      url: publicUrl,
      storagePath: storagePath,
      contentType: fileType,
      uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 7. Send a success response back to the browser.
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'File metadata saved successfully.' }),
    };

  } catch (error) {
    console.error('Error saving file metadata:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `An unexpected error occurred: ${error.message}` }),
    };
  }
};
