import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// [SECURITY] Server client reads cookies set by the auth callback;
// tokens live in httpOnly, SameSite=Strict cookies – never in localStorage
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                httpOnly: true,
                sameSite: "strict",
                secure: process.env.NODE_ENV === "production",
              })
            );
          } catch {
            // Server Components can't set cookies; the middleware handles refresh
          }
        },
      },
    }
  );
}

// [SECURITY] Admin client bypasses RLS – only use in trusted server-side code
export async function createAdminClient() {
  const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
