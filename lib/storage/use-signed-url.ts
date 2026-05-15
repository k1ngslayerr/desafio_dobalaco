"use client";

import { useEffect, useMemo, useState } from "react";

// Buckets configured as public in Supabase — use getPublicUrl (no RLS, no expiry)
// [SECURITY] `submissions` MUST stay private: signed URLs scope access
// to the lifetime of the token and prevent anonymous internet enumeration.
const PUBLIC_BUCKETS = ["avatars"];

/**
 * Returns a URL for a Supabase Storage object.
 * - Public buckets (e.g. avatars): calls getPublicUrl via the browser client.
 * - Private buckets (e.g. submissions): calls GET /api/storage/sign, which
 *   runs server-side (where httpOnly cookies are readable) and uses the admin
 *   client to generate a signed URL — avoids the browser-client auth failure.
 * - Backward-compat: if `path` already starts with "https://", returns as-is.
 */
export function useSignedUrl(
  bucket: string,
  path: string | null | undefined,
  expiresIn = 3600
): string | null {
  // The sync portion: null path or already-resolved https URL.
  const syncUrl = useMemo<string | null>(() => {
    if (!path) return null;
    if (path.startsWith("https://")) return path;
    return null;
  }, [path]);

  // The async portion: signed URL fetched from /api/storage/sign or
  // public URL from the browser client. Keyed by `${bucket}|${path}` so
  // changes invalidate the previous fetch.
  const [asyncEntry, setAsyncEntry] = useState<{
    key: string;
    url: string | null;
  } | null>(null);

  const fetchKey = path && !path.startsWith("https://") ? `${bucket}|${path}` : null;

  useEffect(() => {
    if (!fetchKey || !path) return;

    let cancelled = false;

    (async () => {
      if (PUBLIC_BUCKETS.includes(bucket)) {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        if (!cancelled && data?.publicUrl) {
          setAsyncEntry({ key: fetchKey, url: data.publicUrl });
        }
      } else {
        // Private buckets: call the server-side sign endpoint.
        const params = new URLSearchParams({
          bucket,
          path,
          expiresIn: String(expiresIn),
        });
        const res = await fetch(`/api/storage/sign?${params}`);
        if (!cancelled && res.ok) {
          const json = await res.json();
          if (json.url) setAsyncEntry({ key: fetchKey, url: json.url as string });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchKey, bucket, path, expiresIn]);

  if (syncUrl !== null) return syncUrl;
  if (asyncEntry && asyncEntry.key === fetchKey) return asyncEntry.url;
  return null;
}
