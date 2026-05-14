import { v4 as uuidv4 } from "uuid";

// [SECURITY] Never use the user-supplied filename; generate a UUID-based name
// to prevent path traversal and to avoid leaking user metadata
export function sanitizeFileName(originalName: string): string {
  const ext = originalName.split(".").pop()?.toLowerCase() ?? "bin";
  const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "bin";
  return `${uuidv4()}.${safeExt}`;
}

// [SECURITY] Build a safe storage path: userId/challengeId/<uuid>.ext
// Ensures users can only write under their own path (enforced by Storage RLS too)
export function buildStoragePath(
  userId: string,
  challengeId: string,
  originalName: string
): string {
  const fileName = sanitizeFileName(originalName);
  return `${userId}/${challengeId}/${fileName}`;
}

export function buildAvatarPath(userId: string, originalName: string): string {
  const fileName = sanitizeFileName(originalName);
  return `${userId}/${fileName}`;
}
