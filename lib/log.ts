// Minimal log shim.
//
// [SECURITY] In production we never want to surface raw DB / storage errors
// to clients. We *do* want them in the Vercel server logs so on-call can
// triage. This helper is intentionally tiny so callers don't have to think
// about the production flag — just use logError() and forget.

export function logError(scope: string, err: unknown, meta?: Record<string, unknown>) {
  // We always log (the server logs are private), but include scope for
  // grep-ability. Extra fields go in a single trailing object to avoid
  // accidental string concatenation of sensitive values.
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[${scope}] ${message}`, meta ?? {});
}
