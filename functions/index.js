const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const {
  ApiError,
  deleteGoogleDriveImage,
  GOOGLE_DRIVE_SECRETS,
  uploadGoogleDriveImage
} = require("./google-drive");
const { matchesImageContentType } = require("./image-validation");

const MAX_PHOTO_SIZE = 4 * 1024 * 1024;
const PRODUCT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const DRIVE_FILE_ID_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

initializeApp();

function requirePost(req, res) {
  if (req.method === "POST") return true;
  res.set("Allow", "POST");
  res.status(405).json({ error: "Método no permitido." });
  return false;
}

async function requireAdmin(req) {
  const authorization = req.get("authorization") || "";
  const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) throw new ApiError(401, "Iniciá sesión para continuar.");

  let decodedToken;
  try {
    decodedToken = await getAuth().verifyIdToken(tokenMatch[1], true);
  } catch (error) {
    if (typeof error?.code === "string" && error.code.startsWith("auth/")) {
      throw new ApiError(401, "La sesión venció. Iniciá sesión nuevamente.");
    }
    throw error;
  }

  const adminDocument = await getFirestore()
    .collection("admins")
    .doc(decodedToken.uid)
    .get();
  if (!adminDocument.exists) {
    throw new ApiError(403, "Esta cuenta no tiene acceso de administrador.");
  }
}

function sendApiError(res, error, operation, publicMessage) {
  if (error instanceof ApiError) {
    return res.status(error.status).json({ error: error.message });
  }

  console.error(`${operation} failed`, error);
  return res.status(500).json({ error: publicMessage });
}

const functionOptions = {
  cors: true,
  maxInstances: 10,
  region: "us-central1",
  secrets: GOOGLE_DRIVE_SECRETS
};

exports.uploadGoogleDrivePhoto = onRequest(functionOptions, async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!requirePost(req, res)) return;

  try {
    await requireAdmin(req);

    const productId = req.query.productId;
    if (typeof productId !== "string" || !PRODUCT_ID_PATTERN.test(productId)) {
      throw new ApiError(400, "El identificador del producto no es válido.");
    }

    const contentType = req.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (!ALLOWED_PHOTO_TYPES.has(contentType)) {
      throw new ApiError(400, "La foto debe ser JPG, PNG o WebP.");
    }

    const file = req.rawBody;
    if (!Buffer.isBuffer(file) || file.length === 0) {
      throw new ApiError(400, "No se recibió ninguna foto.");
    }
    if (file.length > MAX_PHOTO_SIZE) {
      throw new ApiError(413, "La foto no puede superar los 4 MB.");
    }
    if (!matchesImageContentType(file, contentType)) {
      throw new ApiError(400, "El contenido no coincide con el tipo de foto declarado.");
    }

    const uploaded = await uploadGoogleDriveImage(file, productId, contentType);
    return res.status(200).json(uploaded);
  } catch (error) {
    return sendApiError(
      res,
      error,
      "Google Drive photo upload",
      "No se pudo guardar la foto en Google Drive."
    );
  }
});

exports.deleteGoogleDrivePhoto = onRequest(functionOptions, async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!requirePost(req, res)) return;

  try {
    await requireAdmin(req);

    const { fileId, productId } = req.body || {};
    if (
      typeof fileId !== "string"
      || !DRIVE_FILE_ID_PATTERN.test(fileId)
      || typeof productId !== "string"
      || !PRODUCT_ID_PATTERN.test(productId)
    ) {
      throw new ApiError(400, "La referencia de la foto no es válida.");
    }

    const deleted = await deleteGoogleDriveImage(fileId, productId);
    return res.status(200).json({ deleted });
  } catch (error) {
    return sendApiError(
      res,
      error,
      "Google Drive photo deletion",
      "No se pudo quitar la foto de Google Drive."
    );
  }
});
