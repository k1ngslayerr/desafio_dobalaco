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
              sameSite: "strict",
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
