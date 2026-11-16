import test from "node:test";
import assert from "node:assert/strict";
import {
  detectImageContentType,
  matchesImageContentType
} from "../server/image-validation.js";

test("detects JPEG, PNG, and WebP signatures", () => {
  assert.equal(
    detectImageContentType(Buffer.from([0xff, 0xd8, 0xff, 0x00])),
    "image/jpeg"
  );
  assert.equal(
    detectImageContentType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "image/png"
  );
  assert.equal(
    detectImageContentType(Buffer.from("RIFF0000WEBP")),
    "image/webp"
  );
});

test("rejects content with an unknown or incomplete signature", () => {
  assert.equal(detectImageContentType(Buffer.from("not an image")), "");
  assert.equal(detectImageContentType(Buffer.from([0xff, 0xd8])), "");
  assert.equal(detectImageContentType("image/jpeg"), "");
});

test("requires the declared MIME type to match the image signature", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  assert.equal(matchesImageContentType(jpeg, "image/jpeg"), true);
  assert.equal(matchesImageContentType(jpeg, "image/png"), false);
});
