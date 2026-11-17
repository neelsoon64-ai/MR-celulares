
const { defineSecret } = require("firebase-functions/params");

const googleDriveAppsScriptSecret = defineSecret(
  "GOOGLE_DRIVE_APPS_SCRIPT_SECRET"
);

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxH-vRU-YkQXVZy6olkVzyhWXndNbiZTyk0pUeg8oeGtijOLUyaJaWPu-fAo5Jx7SPg/exec";

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function callGoogleDrive(payload) {
  const secret = googleDriveAppsScriptSecret.value()?.trim();

  if (!secret) {
    throw new Error("Google Drive Apps Script secret is not configured.");
  }

  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...payload,
      secret
    })
  });

  const responseText = await response.text();

  let result;

  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error(
      "Google Apps Script returned an invalid response."
    );
  }

  if (!response.ok || result.status !== "success") {
    throw new ApiError(
      502,
      result.message || "Google Drive could not complete the operation."
    );
  }

  return result;
}

async function uploadGoogleDriveImage(file, productId, contentType) {
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

async function deleteGoogleDriveImage(fileId, productId) {
  const result = await callGoogleDrive({
    action: "delete",
    fileId,
    productId
  });

  return result.deleted === true;
}

module.exports = {
  ApiError,
  GOOGLE_DRIVE_SECRETS: [
    googleDriveAppsScriptSecret
  ],
  deleteGoogleDriveImage,
  uploadGoogleDriveImage
};