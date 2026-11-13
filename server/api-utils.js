import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { v2 as cloudinary } from "cloudinary";

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function getFirebaseAdminApp() {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin server credentials are not configured.");
  }

  const existingApp = getApps().find(app => app.name === "mr-celulares-cloudinary");
  if (existingApp) return existingApp;

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId
  }, "mr-celulares-cloudinary");
}

export async function requireAdmin(req) {
  const authorization = req.headers.authorization || "";
  const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) throw new ApiError(401, "Iniciá sesión para continuar.");

  const app = getFirebaseAdminApp();
  let decodedToken;
  try {
    decodedToken = await getAuth(app).verifyIdToken(tokenMatch[1], true);
  } catch (error) {
    if (typeof error?.code === "string" && error.code.startsWith("auth/")) {
      throw new ApiError(401, "La sesión venció. Iniciá sesión nuevamente.");
    }
    throw error;
  }

  const adminDocument = await getFirestore(app)
    .collection("admins")
    .doc(decodedToken.uid)
    .get();
  if (!adminDocument.exists) {
    throw new ApiError(403, "Esta cuenta no tiene acceso de administrador.");
  }

  return decodedToken.uid;
}

export function getCloudinaryCredentials() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary server credentials are not configured.");
  }

  return { cloudName, apiKey, apiSecret };
}

export function configureCloudinary() {
  const credentials = getCloudinaryCredentials();
  cloudinary.config({
    cloud_name: credentials.cloudName,
    api_key: credentials.apiKey,
    api_secret: credentials.apiSecret,
    secure: true
  });
  return credentials;
}

export function requirePost(req, res) {
  if (req.method === "POST") return true;
  res.setHeader("Allow", "POST");
  res.status(405).json({ error: "Método no permitido." });
  return false;
}

export function sendApiError(res, error, operation, publicMessage) {
  if (error instanceof ApiError) {
    return res.status(error.status).json({ error: error.message });
  }

  console.error(`${operation} failed`, error);
  return res.status(500).json({ error: publicMessage });
}
