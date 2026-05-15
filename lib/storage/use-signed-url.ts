"use client";

import { useState, useEffect } from "react";

// Buckets configured as public in Supabase — use getPublicUrl (no RLS, no expiry)
const PUBLIC_BUCKETS = ["avatars"];

/**
 * Returns a URL for a Supabase Storage object.
 * Public buckets (e.g. avatars) use getPublicUrl so any user can see any avatar.
 * Private buckets use createSignedUrl (expires after expiresIn seconds).
 * Backward-compat: if `path` already starts with "https://", returns as-is.
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
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      if (PUBLIC_BUCKETS.includes(bucket)) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        if (!cancelled && data?.publicUrl) setUrl(data.publicUrl);
      } else {
        const { data } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, expiresIn);
        if (!cancelled && data?.signedUrl) setUrl(data.signedUrl);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bucket, path, expiresIn]);

  return url;
}
