import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// ── Route classification ─────────────────────────────────────
// Anything matched by ROOT_MATCHER and NOT in PUBLIC_PATHS requires auth.
// ADMIN_PATHS additionally requires role=admin.
const PUBLIC_PATHS = ["/login", "/register", "/pending", "/auth/callback"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAdmin(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * [SECURITY] Root middleware
 *   - Refreshes the Supabase session on every request so httpOnly tokens
 *     stay fresh (recommended pattern from @supabase/ssr).
 *   - Bounces unauthenticated users away from protected pages to /login.
 *   - Bounces non-admin users away from /admin/* to /dashboard.
 *   - Server components and API routes also re-check (defense in depth).
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Refresh session FIRST so downstream auth checks see the fresh JWT
  const { supabaseResponse, user } = await updateSession(request);

  // Public routes: just return refreshed response
  if (isPublic(pathname)) return supabaseResponse;

  // Protected routes require an authenticated user
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Admin routes additionally require role=admin.
  // We re-query the DB here only for /admin/* paths to avoid a DB hit
  // on every request. The protected layout / route handlers re-verify.
  if (isAdmin(pathname)) {
    // Lazy import to keep middleware bundle small
    const { createServerClient } = await import("@supabase/ssr");
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {
            // no-op: cookies were already refreshed by updateSession()
          },
        },
      }
    );

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return supabaseResponse;
}

// Skip Next internals, static assets, and image optimization
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
