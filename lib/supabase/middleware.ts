import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// [SECURITY] Called by middleware.ts to refresh the session token silently
// so the browser never holds a stale JWT past its expiry
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              httpOnly: true,
              // [SECURITY] "lax" (not "strict") is required for Safari/iOS:
              // SameSite=Strict blocks cookies on top-level navigations from
              // external origins (bookmarks, links from other apps), making
              // Safari users appear logged-out on every revisit. Lax still
              // blocks cookies on cross-site sub-requests and non-safe methods,
              // which is sufficient CSRF protection. Our proxy.ts origin check
              // adds a second layer for all mutating API calls.
              sameSite: "lax",
              // [SECURITY] Always Secure. Browsers exempt localhost for dev.
              secure: true,
            })
          );
        },
      },
    }
  );

  // Refresh session – do NOT remove this call
  const { data: { user } } = await supabase.auth.getUser();

  return { supabaseResponse, user };
}
