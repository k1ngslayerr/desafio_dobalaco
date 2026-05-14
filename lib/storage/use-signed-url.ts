"use client";

import { useState, useEffect } from "react";

/**
 * Generates a temporary signed URL for a private Supabase Storage object.
 * Returns null while the URL is being fetched.
 *
 * Backward-compat: if `path` already starts with "https://", returns as-is
 * (handles any legacy rows that stored full public URLs).
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
      const { data } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);
      if (!cancelled && data?.signedUrl) {
        setUrl(data.signedUrl);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bucket, path, expiresIn]);

  return url;
}
