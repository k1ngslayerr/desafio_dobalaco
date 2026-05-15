import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authLimiter } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validators";

/**
 * POST /api/auth/login
 *
 * Server-side wrapper around supabase.auth.signInWithPassword so we can
 * apply our own rate-limit before hitting Supabase. Supabase has built-in
 * auth rate-limiting too, but it's coarse-grained and shared with email
 * verification flows; this gives us per-email control against credential
 * stuffing through the UI.
 *
 * [SECURITY]
 *  - Rate-limit key: lower-cased email. An attacker brute-forcing one
 *    account is bucketed; an attacker enumerating many accounts incurs
 *    Supabase's global limits as a second wall.
 *  - Errors are normalised to a single generic message to prevent user
 *    enumeration.
 *  - createClient() writes the httpOnly session cookie on success.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Email ou senha incorretos." }, { status: 400 });
  }

  const emailKey = parsed.data.email.trim().toLowerCase();
  const { success: rateOk } = await authLimiter.limit(`login:${emailKey}`);
  if (!rateOk) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente em alguns minutos." },
      { status: 429 }
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // [SECURITY] Single generic error — never echo Supabase's "invalid login
    // credentials" vs "email not confirmed" distinction, which leaks whether
    // an email is registered.
    return NextResponse.json({ error: "Email ou senha incorretos." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
