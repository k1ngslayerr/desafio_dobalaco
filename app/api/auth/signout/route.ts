import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/auth/signout
// Used by middleware and the layout to break redirect loops when a user exists
// in auth.users but has no corresponding row in public.users (trigger failure).
// Also used as a general-purpose sign-out endpoint.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const error = searchParams.get("error");

  const supabase = await createClient();
  await supabase.auth.signOut();

  const loginUrl = new URL("/login", origin);
  if (error) loginUrl.searchParams.set("error", error);

  const response = NextResponse.redirect(loginUrl.toString());
  // Clear the proxy-level role/status cache cookie so the next login
  // always does a fresh DB check instead of using stale cached values.
  response.cookies.delete("_s");
  return response;
}
