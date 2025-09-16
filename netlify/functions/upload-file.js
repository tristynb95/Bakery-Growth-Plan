const admin = require('firebase-admin');
const busboy = require('busboy');

// Initialize Firebase Admin SDK
// Check if the app is already initialized to prevent errors during hot-reloads
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET
  });
}


exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // FIX: Make headers case-insensitive for busboy
  const headers = Object.fromEntries(
    Object.entries(event.headers).map(([key, value]) => [key.toLowerCase(), value])
  );


  return new Promise((resolve, reject) => {
    // FIX: Pass the lowercase headers to busboy
    const bb = busboy({ headers: headers });
    const fields = {};
    const files = [];

    bb.on('file', (fieldname, file, filenameInfo) => {
      // FIX: Use the 'filenameInfo' object which contains filename, encoding, mimetype
      const { filename, encoding, mimeType } = filenameInfo;
      const chunks = [];
      file.on('data', (chunk) => {
        chunks.push(chunk);
      });
      file.on('end', () => {
        files.push({
          fieldname,
          filename,
          mimeType, // FIX: Correct property name
          content: Buffer.concat(chunks),
        });
      });
    });

    bb.on('field', (fieldname, val) => {
      fields[fieldname] = val;
    });

    bb.on('finish', async () => {
      try {
        if (files.length === 0) {
          return resolve({ statusCode: 400, body: JSON.stringify({ error: 'No file uploaded.' }) });
        }

        const fileToUpload = files[0];
        const { planId, userId } = fields;

        if (!planId || !userId) {
            return resolve({ statusCode: 400, body: JSON.stringify({ error: 'Missing planId or userId.' }) });
        }

        const bucket = admin.storage().bucket();
        // FIX: Sanitize filename to prevent security issues and errors
        const sanitizedFilename = fileToUpload.filename.replace(/[^a-zA-Z0-9._-]/g, '');
        const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const storagePath = `users/${userId}/plans/${planId}/${fileId}-${sanitizedFilename}`;

        const file = bucket.file(storagePath);
        await file.save(fileToUpload.content, {
          metadata: { contentType: fileToUpload.mimeType }, // FIX: Correct property name
        });

        // This long expiry is okay for internal tools, but for public apps, consider shorter-lived URLs.
        const downloadURL = await file.getSignedUrl({
            action: 'read',
            expires: '03-09-2491'
        }).then(urls => urls[0]);


        // Save metadata to Firestore
        const db = admin.firestore();
        const filesCollectionRef = db.collection('users').doc(userId)
                                     .collection('plans').doc(planId)
                                     .collection('files');

        const docRef = await filesCollectionRef.add({
            name: fileToUpload.filename,
            size: fileToUpload.content.length,
            type: fileToUpload.mimeType, // FIX: Correct property name
            storagePath: storagePath,
            downloadURL: downloadURL,
            uploadedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        resolve({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'File uploaded successfully',
            fileId: docRef.id,
            downloadURL,
          }),
        });
      } catch (error) {
        console.error('Error in upload finish handler:', error);
        resolve({
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'An internal error occurred during file processing.' })
        });
      }
    });
    
    // Add error handling for busboy parsing
    bb.on('error', err => {
        console.error('Busboy parsing error:', err);
        resolve({
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Failed to parse the uploaded file.' })
        });
    });

    // FIX: Check if body is base64 encoded before decoding
    const bodyBuffer = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;
    bb.end(bodyBuffer);
  });
};
