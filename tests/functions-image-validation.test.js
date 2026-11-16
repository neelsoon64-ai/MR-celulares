import test from "node:test";
import assert from "node:assert/strict";
import imageValidation from "../functions/image-validation.js";

test("Firebase Functions image validation matches supported signatures", () => {
  const { matchesImageContentType } = imageValidation;
  assert.equal(
    matchesImageContentType(Buffer.from([0xff, 0xd8, 0xff]), "image/jpeg"),
    true
  );
  assert.equal(
    matchesImageContentType(Buffer.from([0xff, 0xd8, 0xff]), "image/png"),
    false
  );
  assert.equal(
    matchesImageContentType(Buffer.from("RIFF0000WEBP"), "image/webp"),
    true
  );
});
