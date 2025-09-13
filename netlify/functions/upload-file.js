const admin = require('firebase-admin');
const busboy = require('busboy');

// Initialize Firebase Admin SDK
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET
});

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: event.headers });
    const fields = {};
    const files = [];

    bb.on('file', (fieldname, file, filename, encoding, mimetype) => {
      const chunks = [];
      file.on('data', (chunk) => {
        chunks.push(chunk);
      });
      file.on('end', () => {
        files.push({
          fieldname,
          filename,
          mimetype,
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
          return resolve({ statusCode: 400, body: 'No file uploaded.' });
        }

        const fileToUpload = files[0];
        const { planId, userId } = fields;

        if (!planId || !userId) {
            return resolve({ statusCode: 400, body: 'Missing planId or userId.' });
        }

        const bucket = admin.storage().bucket();
        const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const storagePath = `users/${userId}/plans/${planId}/${fileId}-${fileToUpload.filename}`;

        const file = bucket.file(storagePath);
        await file.save(fileToUpload.content, {
          metadata: { contentType: fileToUpload.mimetype },
        });

        const downloadURL = await file.getSignedUrl({
            action: 'read',
            expires: '03-09-2491' // A long, long time in the future
        }).then(urls => urls[0]);


        // Save metadata to Firestore
        const db = admin.firestore();
        const filesCollectionRef = db.collection('users').doc(userId)
                                     .collection('plans').doc(planId)
                                     .collection('files');

        const docRef = await filesCollectionRef.add({
            name: fileToUpload.filename,
            size: fileToUpload.content.length,
            type: fileToUpload.mimetype,
            storagePath: storagePath,
            downloadURL: downloadURL,
            uploadedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        resolve({
          statusCode: 200,
          body: JSON.stringify({
            message: 'File uploaded successfully',
            fileId: docRef.id,
            downloadURL,
          }),
        });
      } catch (error) {
        console.error('Error uploading file:', error);
        resolve({ statusCode: 500, body: 'Error uploading file.' });
      }
    });

    bb.end(Buffer.from(event.body, 'base64'));
  });
};
