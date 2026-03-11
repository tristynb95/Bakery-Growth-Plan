const admin = require("firebase-admin");

function getFirebaseApp() {
  if (!admin.apps.length) {
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      const missing = [];
      if (!projectId) missing.push("VITE_FIREBASE_PROJECT_ID");
      if (!clientEmail) missing.push("FIREBASE_CLIENT_EMAIL");
      if (!privateKey) missing.push("FIREBASE_PRIVATE_KEY");
      throw new Error(
        `Missing required environment variables: ${missing.join(", ")}`
      );
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
    });
  }
  return admin;
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let app;
  try {
    app = getFirebaseApp();
  } catch (initError) {
    console.error("Firebase Admin init failed:", initError.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Server configuration error. Check function environment variables.",
      }),
    };
  }

  try {
    const db = app.firestore();

    const authHeader = event.headers.authorization || "";
    const idToken = authHeader.replace("Bearer ", "");

    if (!idToken) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "No authentication token provided." }),
      };
    }

    // Verify the caller's identity
    const decodedToken = await app.auth().verifyIdToken(idToken);
    const callerEmail = (decodedToken.email || "").trim().toLowerCase();

    // Check caller is an admin using Firestore-based roles
    const rolesDoc = await db
      .collection("settings")
      .doc("adminRoles")
      .get();
    const rolesData = rolesDoc.exists ? rolesDoc.data() : {};
    const admins = Array.isArray(rolesData.admins)
      ? rolesData.admins.map((e) => e.trim().toLowerCase())
      : [];

    if (!admins.includes(callerEmail)) {
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

    // Prevent deleting the owner
    const ownerEmail = (rolesData.ownerEmail || "").trim().toLowerCase();
    const targetUser = await app.auth().getUser(uid).catch(() => null);
    if (
      targetUser &&
      targetUser.email &&
      targetUser.email.trim().toLowerCase() === ownerEmail
    ) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "The owner account cannot be deleted." }),
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
      await app.auth().deleteUser(uid);
    } catch (authErr) {
      // User may not exist in Auth (e.g. already deleted) - log but don't fail
      console.warn(
        "Could not delete Auth user (may already be removed):",
        authErr.message
      );
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
