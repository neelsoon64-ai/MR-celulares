import test from "node:test";
import assert from "node:assert/strict";
import { uploadGoogleDriveImage } from "../server/google-drive.js";

test("sends the Apps Script upload JSON and returns its photo details", async () => {
  const previousFetch = globalThis.fetch;
  const previousApiSecret = process.env.API_SECRET;
  let request;

  process.env.API_SECRET = "test-apps-script-secret";
  globalThis.fetch = async (url, options) => {
    request = { url, ...options };
    return new Response(JSON.stringify({
      status: "success",
      fileId: "drive-file-id",
      photoUrl: "https://drive.google.com/photo"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    const result = await uploadGoogleDriveImage(
      Buffer.from("photo-bytes"),
      "product-123",
      "image/jpeg"
    );

    assert.equal(request.method, "POST");
    assert.equal(request.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(request.body), {
      secret: "test-apps-script-secret",
      action: "upload",
      productId: "product-123",
      mimeType: "image/jpeg",
      base64: Buffer.from("photo-bytes").toString("base64")
    });
    assert.deepEqual(result, {
      fileId: "drive-file-id",
      photoUrl: "https://drive.google.com/photo"
    });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousApiSecret === undefined) {
      delete process.env.API_SECRET;
    } else {
      process.env.API_SECRET = previousApiSecret;
    }
  }
});
