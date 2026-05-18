import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authLimiter } from "@/lib/rate-limit";
import { forgotPasswordSchema } from "@/lib/validators";

/**
 * POST /api/auth/forgot-password
 *
 * Triggers a Supabase password-reset email. The email contains a magic link
 * that goes to /auth/callback?next=/reset-password, which exchanges the PKCE
 * code for a session and drops the user on the reset-password form.
 *
 * [SECURITY]
 *  - Always returns 200 — never reveals whether the email is registered.
 *  - Rate-limited per email (same authLimiter used by login).
 *  - redirectTo is validated to our own origin (assembled server-side).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);

  // Even on invalid input, return 200 to avoid email enumeration.
  if (!parsed.success) {
    return NextResponse.json({ ok: true });
  }

  const emailKey = parsed.data.email.trim().toLowerCase();
  const { success: rateOk } = await authLimiter.limit(`forgot:${emailKey}`);
  if (!rateOk) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente em alguns minutos." },
      { status: 429 }
    );
  }

  const supabase = await createClient();
  const origin = new URL(request.url).origin;

  // Fire-and-forget: we intentionally don't surface errors to the client.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  return NextResponse.json({ ok: true });
}
