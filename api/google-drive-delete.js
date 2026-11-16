import {
  ApiError,
  requireAdmin,
  requirePost,
  sendApiError
} from "../server/api-utils.js";
import { deleteGoogleDriveImage } from "../server/google-drive.js";

const PRODUCT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const DRIVE_FILE_ID_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
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
    return sendApiError(res, error, "Google Drive photo deletion", "No se pudo quitar la foto de Google Drive.");
  }
}
