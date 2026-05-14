import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/Navbar";
import type { ReactNode } from "react";

// Sign-out route that clears the session before redirecting to /login.
// Used when the auth session exists but the public.users profile is missing
// (trigger failure), which would otherwise cause an infinite redirect loop.
const SIGNOUT_URL = "/api/auth/signout?error=account_error";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // [SECURITY] Select only safe fields for nav rendering
  const { data: profile } = await supabase
    .from("users")
    .select("id, username, avatar_url, level, role, status")
    .eq("id", user.id)
    .single();

  // No profile row despite a valid session → trigger failed during signup.
  // Redirect to signout (not /login directly) to clear the session cookie first,
  // otherwise middleware will immediately bounce them back to /dashboard.
  if (!profile) redirect(SIGNOUT_URL);

  // [SECURITY] Defense-in-depth: pending users must not access protected pages
  // (middleware handles this too, but server components are a second line of defense)
  if (profile.status === "pending") redirect("/pending");

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={profile} />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
