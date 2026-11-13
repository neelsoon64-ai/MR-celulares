import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import {
  ApiError,
  getCloudinaryCredentials,
  requireAdmin,
  requirePost,
  sendApiError
} from "../server/api-utils.js";

const PRODUCT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!requirePost(req, res)) return;

  try {
    await requireAdmin(req);

    const productId = req.body?.productId;
    if (typeof productId !== "string" || !PRODUCT_ID_PATTERN.test(productId)) {
      throw new ApiError(400, "El identificador del producto no es válido.");
    }

    const { cloudName, apiKey, apiSecret } = getCloudinaryCredentials();
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = `products/${productId}/${randomUUID()}`;
    const signature = cloudinary.utils.api_sign_request(
      { public_id: publicId, timestamp },
      apiSecret
    );

    return res.status(200).json({
      cloudName,
      apiKey,
      publicId,
      timestamp,
      signature
    });
  } catch (error) {
    return sendApiError(res, error, "Cloudinary upload signing", "No se pudo preparar la carga de la foto.");
  }
}
