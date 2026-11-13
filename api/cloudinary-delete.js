import { v2 as cloudinary } from "cloudinary";
import {
  ApiError,
  configureCloudinary,
  requireAdmin,
  requirePost,
  sendApiError
} from "../server/api-utils.js";

const CLOUDINARY_PRODUCT_ID_PATTERN =
  /^products\/[A-Za-z0-9_-]{1,128}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!requirePost(req, res)) return;

  try {
    await requireAdmin(req);

    const publicId = req.body?.publicId;
    if (typeof publicId !== "string" || !CLOUDINARY_PRODUCT_ID_PATTERN.test(publicId)) {
      throw new ApiError(400, "La referencia de la foto no es válida.");
    }

    configureCloudinary();
    const result = await cloudinary.uploader.destroy(publicId, { invalidate: true });
    if (result.result !== "ok" && result.result !== "not found") {
      throw new Error(`Cloudinary returned an unexpected delete result: ${result.result}`);
    }

    return res.status(200).json({ deleted: result.result === "ok" });
  } catch (error) {
    return sendApiError(res, error, "Cloudinary photo deletion", "No se pudo quitar la foto de Cloudinary.");
  }
}
