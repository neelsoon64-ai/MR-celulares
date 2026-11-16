import {
  ApiError,
  requireAdmin,
  requirePost,
  sendApiError
} from "../server/api-utils.js";
import { matchesImageContentType } from "../server/image-validation.js";
import { uploadGoogleDriveImage } from "../server/google-drive.js";

const MAX_PHOTO_SIZE = 4 * 1024 * 1024;
const PRODUCT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const config = {
  api: {
    bodyParser: false
  }
};

async function readImage(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_PHOTO_SIZE) {
      throw new ApiError(413, "La foto no puede superar los 4 MB.");
    }
    chunks.push(buffer);
  }

  if (size === 0) throw new ApiError(400, "No se recibió ninguna foto.");
  return Buffer.concat(chunks, size);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!requirePost(req, res)) return;

  try {
    await requireAdmin(req);

    const productId = req.query?.productId;
    if (typeof productId !== "string" || !PRODUCT_ID_PATTERN.test(productId)) {
      throw new ApiError(400, "El identificador del producto no es válido.");
    }

    const contentType = req.headers["content-type"]
      ?.split(";")[0]
      .trim()
      .toLowerCase();
    if (!ALLOWED_PHOTO_TYPES.has(contentType)) {
      throw new ApiError(400, "La foto debe ser JPG, PNG o WebP.");
    }

    const file = await readImage(req);
    if (!matchesImageContentType(file, contentType)) {
      throw new ApiError(400, "El contenido no coincide con el tipo de foto declarado.");
    }

    const uploaded = await uploadGoogleDriveImage(file, productId, contentType);
    return res.status(200).json(uploaded);
  } catch (error) {
    return sendApiError(res, error, "Google Drive photo upload", "No se pudo guardar la foto en Google Drive.");
  }
}
