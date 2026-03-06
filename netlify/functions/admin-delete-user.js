const admin = require("firebase-admin");

const ADMIN_EMAIL = "tristen_bayley@gailsbread.co.uk";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const authHeader = event.headers.authorization || "";
    const idToken = authHeader.replace("Bearer ", "");

    if (!idToken) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "No authentication token provided." }),
      };
    }

    // Verify the caller is the admin
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    if (decodedToken.email !== ADMIN_EMAIL) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Access denied." }),
      };
    }

    const { uid } = JSON.parse(event.body);
    if (!uid) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing user uid." }),
      };
    }

    // Prevent admin from deleting themselves
    if (uid === decodedToken.uid) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Cannot delete your own account." }),
      };
    }

    // Collect all document refs to delete
    const refsToDelete = [];

    // Delete user's plans subcollection
    const plansSnapshot = await db
      .collection("users")
      .doc(uid)
      .collection("plans")
      .get();
    plansSnapshot.forEach((doc) => refsToDelete.push(doc.ref));

    // Delete from top-level plans collection
    const topPlansSnapshot = await db
      .collection("plans")
      .where("userId", "==", uid)
      .get();
    topPlansSnapshot.forEach((doc) => refsToDelete.push(doc.ref));

    // Delete user document
    refsToDelete.push(db.collection("users").doc(uid));

    // Firestore batches are limited to 500 operations, so chunk if needed
    const BATCH_LIMIT = 500;
    for (let i = 0; i < refsToDelete.length; i += BATCH_LIMIT) {
      const chunk = refsToDelete.slice(i, i + BATCH_LIMIT);
      const batch = db.batch();
      chunk.forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

    // Delete the Firebase Auth account
    try {
      await admin.auth().deleteUser(uid);
    } catch (authErr) {
      // User may not exist in Auth (e.g. already deleted) - log but don't fail
      console.warn("Could not delete Auth user (may already be removed):", authErr.message);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error("Error deleting user:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to delete user." }),
    };
  }
};
