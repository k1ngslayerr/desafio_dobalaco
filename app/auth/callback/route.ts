import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// GET /auth/callback
// Supabase redirects here after Google OAuth with a `code` query param.
// We exchange it for a session and redirect the user to the dashboard.
//
// IMPORTANT: we bind the Supabase client directly to the NextResponse object
// so that the Set-Cookie headers from exchangeCodeForSession are included in
// the redirect response. Using createClient() (next/headers) would set cookies
// on next/headers' internal store, which is NOT propagated to a custom
// NextResponse.redirect() — causing the browser to arrive at /dashboard with
// no session cookies and getting bounced back to /login.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code  = searchParams.get("code");
  const next  = searchParams.get("next") ?? "/dashboard";
  const error = searchParams.get("error");

  // Provider returned an error (e.g. user cancelled Google consent)
  if (error) {
    console.error("[oauth callback] provider error:", error, searchParams.get("error_description"));
    return NextResponse.redirect(`${origin}/login?error=oauth_cancelled`);
  }

  if (code) {
    // Build the redirect response first so we can bind cookie writes to it
    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          // Write the session cookies directly onto our redirect response
          setAll: (toSet) => {
            toSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      // Response already has Set-Cookie headers — return it now
      return response;
    }

    console.error("[oauth callback] session exchange error:", exchangeError.message);
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
