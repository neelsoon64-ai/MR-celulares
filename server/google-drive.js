
import { ApiError } from "./api-utils.js";

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxH-vRU-YkQXVZy6olkVzyhWXndNbiZTyk0pUeg8oeGtijOLUyaJaWPu-fAo5Jx7SPg/exec";

async function callGoogleDrive(payload) {
  const secret = process.env.GOOGLE_DRIVE_APPS_SCRIPT_SECRET?.trim();

  if (!secret) {
    throw new Error("Google Drive Apps Script secret is not configured.");
  }

  let response;

  try {
    response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...payload,
        secret
      }),
      redirect: "follow"
    });
  } catch (error) {
    console.error("Google Apps Script connection failed:", error);
    throw new ApiError(502, "No se pudo conectar con Google Drive.");
  }

  const responseText = await response.text();

  let result;

  try {
    result = JSON.parse(responseText);
  } catch {
    console.error(
      "Invalid Google Apps Script response:",
      responseText.slice(0, 500)
    );
    throw new ApiError(502, "Google Drive devolvió una respuesta no válida.");
  }

  if (!response.ok || result.status !== "success") {
    console.error("Google Apps Script operation failed:", result.message);
    throw new ApiError(
      502,
      result.message || "No se pudo completar la operación en Google Drive."
    );
  }

  return result;
}

export async function uploadGoogleDriveImage(file, productId, contentType) {
  if (!Buffer.isBuffer(file) || file.length === 0) {
    throw new ApiError(400, "No se recibió ninguna foto.");
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
    throw new ApiError(400, "Formato de imagen no permitido.");
  }

  const result = await callGoogleDrive({
    action: "upload",
    productId,
    mimeType: contentType,
    base64: file.toString("base64")
  });

  if (
    typeof result.fileId !== "string" ||
    typeof result.photoUrl !== "string"
  ) {
    throw new Error("Google Drive did not return valid photo information.");
  }

  return {
    fileId: result.fileId,
    photoUrl: result.photoUrl
  };
}

export async function deleteGoogleDriveImage(fileId, productId) {
  const result = await callGoogleDrive({
    action: "delete",
    fileId,
    productId
  });

  return result.deleted === true;
}
