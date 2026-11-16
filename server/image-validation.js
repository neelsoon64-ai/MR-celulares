export function detectImageContentType(file) {
  if (!Buffer.isBuffer(file)) return "";

  if (
    file.length >= 3
    && file[0] === 0xff
    && file[1] === 0xd8
    && file[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    file.length >= 8
    && file.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }

  if (
    file.length >= 12
    && file.toString("ascii", 0, 4) === "RIFF"
    && file.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return "";
}

export function matchesImageContentType(file, contentType) {
  return detectImageContentType(file) === contentType;
}
