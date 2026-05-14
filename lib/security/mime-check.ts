// [SECURITY] Validate MIME type from actual file bytes (magic bytes), not file extension
// Prevents attackers from renaming a malicious file as .jpg to bypass extension checks

type AllowedMime = "image/jpeg" | "image/png" | "image/webp";

interface MagicSignature {
  mime: AllowedMime;
  offset: number;
  bytes: number[];
}

const SIGNATURES: MagicSignature[] = [
  // JPEG: FF D8 FF
  { mime: "image/jpeg", offset: 0, bytes: [0xff, 0xd8, 0xff] },
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  { mime: "image/png", offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // WebP: RIFF????WEBP
  { mime: "image/webp", offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
];

const WEBP_MARKER = [0x57, 0x45, 0x42, 0x50]; // "WEBP" at bytes 8-11

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface MimeCheckResult {
  valid: boolean;
  mime?: AllowedMime;
  error?: string;
}

export async function checkImageMime(buffer: ArrayBuffer): Promise<MimeCheckResult> {
  if (buffer.byteLength > MAX_SIZE_BYTES) {
    return { valid: false, error: "File exceeds 5 MB limit" };
  }

  const bytes = new Uint8Array(buffer);

  for (const sig of SIGNATURES) {
    const slice = bytes.slice(sig.offset, sig.offset + sig.bytes.length);
    const matches = sig.bytes.every((b, i) => slice[i] === b);

    if (matches) {
      if (sig.mime === "image/webp") {
        // Extra check: bytes 8-11 must be "WEBP"
        const webpMarker = bytes.slice(8, 12);
        const isWebp = WEBP_MARKER.every((b, i) => webpMarker[i] === b);
        if (!isWebp) continue;
      }
      return { valid: true, mime: sig.mime };
    }
  }

  return { valid: false, error: "Unsupported or invalid image format" };
}
