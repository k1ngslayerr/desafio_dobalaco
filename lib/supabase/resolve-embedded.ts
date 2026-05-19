/**
 * Supabase returns embedded many-to-one joins as single objects at runtime,
 * but its TypeScript types infer them as arrays. This helper normalises both
 * so callers don't need to guess which form they'll receive.
 */
export function resolveEmbedded<T>(val: T | T[] | null | undefined): T | undefined {
  if (val == null) return undefined;
  return Array.isArray(val) ? val[0] : val;
}

/** Shorthand for extracting { username, avatar_url } from a Supabase user join. */
export function resolveReactionUser(
  raw: unknown
): { username: string; avatar_url: string | null } {
  const u = resolveEmbedded(raw as Record<string, unknown> | Record<string, unknown>[]);
  return {
    username:   (u?.["username"]   as string  | undefined) ?? "",
    avatar_url: (u?.["avatar_url"] as string  | null | undefined) ?? null,
  };
}
