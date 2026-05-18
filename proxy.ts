import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";

// [SECURITY] Route protection matrix:
// - Public paths: accessible without a session (/login, /register, /auth/callback)
// - Pending page (/pending): accessible only to authenticated-but-unapproved users
// - Protected paths: require an active (approved) session
// - Admin paths: additionally require role = "admin"

const PUBLIC_PATHS = ["/login", "/register", "/api/auth", "/auth/callback", "/forgot-password", "/reset-password"];
const ADMIN_PATHS  = ["/admin", "/api/admin"];
const PENDING_PAGE = "/pending";

// ── Cookie cache ─────────────────────────────────────────────────────────────
// To avoid hitting the DB on every page request (which adds ~400ms in dev due
// to network RTT to Supabase), we cache the user's role + status in a short-
// lived httpOnly cookie. The layout and API routes still do their own DB checks
// as a security backstop — the cache is a performance optimisation only.
const CACHE_COOKIE  = "_s";
const CACHE_TTL_MS  = 60_000; // 60 seconds

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

function isAdminPath(pathname: string) {
  return ADMIN_PATHS.some((p) => pathname.startsWith(p));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let static assets and Next.js internals pass through immediately
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // ── 1. Refresh session token and retrieve current user ──────
  const { supabaseResponse, user } = await updateSession(request);

  // ── 2. CSRF check for state-mutating API requests ───────────
  if (request.method !== "GET" && request.method !== "HEAD" && pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin");
    const host   = request.headers.get("host");
    if (origin && host && !origin.includes(host)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  // ── 3. Unauthenticated user ──────────────────────────────────
  if (!user) {
    if (isPublic(pathname) || pathname.startsWith("/api/")) return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // ── 4. API routes: skip expensive DB check (RLS + handlers protect them)
  if (pathname.startsWith("/api/")) return supabaseResponse;

  // ── 5. Page routes: get role + status, using cookie cache ───
  let status = "active"; // fail-open: DB outage won't lock everyone out
  let role   = "user";
  let fromCache = false;

  // Check cache cookie first
  const cached = request.cookies.get(CACHE_COOKIE)?.value;
  if (cached) {
    const parts = cached.split(":");
    if (parts.length === 3) {
      const age = Date.now() - Number(parts[2]);
      if (!isNaN(age) && age < CACHE_TTL_MS) {
        role      = parts[0] ?? "user";
        status    = parts[1] ?? "active";
        fromCache = true;
      }
    }
  }

  if (!fromCache) {
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll()  { return request.cookies.getAll(); },
            setAll()  { /* read-only snapshot — auth cookies already handled by updateSession */ },
          },
        }
      );

      const { data: userRow, error: dbError } = await supabase
        .from("users")
        .select("role, status")
        .eq("id", user.id)
        .single();

      if (dbError) {
        if (dbError.code === "PGRST116") {
          // No profile row — trigger failed at signup. Sign out to break the loop.
          console.error("[proxy] no public.users row for", user.id, "— signing out");
          return NextResponse.redirect(
            new URL("/api/auth/signout?error=account_error", request.url)
          );
        }
        // Other DB error — fail-open (don't lock out users due to transient issues)
        console.error("[proxy] DB check error (failing open):", dbError.message);
      } else if (userRow) {
        role   = userRow.role   ?? "user";
        status = userRow.status ?? "active";
        // Write to cache cookie so subsequent requests skip this DB call
        supabaseResponse.cookies.set(
          CACHE_COOKIE,
          `${role}:${status}:${Date.now()}`,
          { maxAge: 60, httpOnly: true, sameSite: "lax", path: "/" }
        );
      }
    } catch (err) {
      console.error("[proxy] unexpected error (failing open):", err);
    }
  }

  // ── 6. Pending user ──────────────────────────────────────────
  if (status === "pending") {
    if (pathname === PENDING_PAGE) return supabaseResponse;
    return NextResponse.redirect(new URL(PENDING_PAGE, request.url));
  }

  // ── 7. Active (approved) user ────────────────────────────────
  if (pathname === PENDING_PAGE) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (isPublic(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (isAdminPath(pathname) && role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
