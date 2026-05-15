"use client";

import { useState, useEffect } from "react";

// Buckets configured as public in Supabase — use getPublicUrl (no RLS, no expiry)
const PUBLIC_BUCKETS = ["avatars", "submissions"];

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
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }

    // Backward-compat: already a resolved URL
    if (path.startsWith("https://")) {
      setUrl(path);
      return;
    }

    let cancelled = false;

    (async () => {
      if (PUBLIC_BUCKETS.includes(bucket)) {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        if (!cancelled && data?.publicUrl) setUrl(data.publicUrl);
      } else {
        // Private buckets: call the server-side sign endpoint.
        // The browser Supabase client has no auth session (cookies are httpOnly,
        // not accessible to JS), so createSignedUrl() always fails here.
        const params = new URLSearchParams({
          bucket,
          path,
          expiresIn: String(expiresIn),
        });
        const res = await fetch(`/api/storage/sign?${params}`);
        if (!cancelled) {
          if (res.ok) {
            const json = await res.json();
            console.debug("[useSignedUrl] signed url ok:", json.url?.slice(0, 60));
            if (json.url) setUrl(json.url as string);
          } else {
            const text = await res.text();
            console.error("[useSignedUrl] sign failed:", res.status, text);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bucket, path, expiresIn]);

  return url;
}
