import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { appDateStr, appWeekStartStr } from "@/lib/date";

// GET /api/challenges
// Returns active challenges + user's weekly submissions + current penalty + scheduled (agenda).
// All fetched server-side so httpOnly session cookies are read correctly.
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // [SECURITY] Use the app timezone so the "is this challenge active today?"
  // and "did the user submit this week?" filters match what submissions/route.ts
  // writes as `submitted_date`. See lib/date.ts.
  const todayStr = appDateStr();
  const weekStartStr = appWeekStartStr();

  const adminClient = await createAdminClient();

  const [
    { data: challenges },
    { data: submissions },
    { data: profile },
    { data: scheduled },
  ] = await Promise.all([
    supabase
      .from("challenges")
      .select("id, title, description, xp_reward, requires_photo, frequency, weekly_target, quantity_label, xp_per_unit, max_quantity")
      .eq("is_active", true)
      .or(`starts_at.is.null,starts_at.lte.${todayStr}`)
      .or(`ends_at.is.null,ends_at.gte.${todayStr}`)
      .order("created_at", { ascending: false }),
    supabase
      .from("submissions")
      .select("challenge_id, submitted_date")
      .eq("user_id", user.id)
      .gte("submitted_date", weekStartStr),
    supabase
      .from("users")
      .select("current_penalty")
      .eq("id", user.id)
      .single(),
    // Admin client bypasses RLS to show future challenges in the agenda
    adminClient
      .from("challenges")
      .select("id, title, description, xp_reward, frequency, weekly_target, starts_at, ends_at")
      .eq("is_active", true)
      .gt("starts_at", todayStr)
      .order("starts_at", { ascending: true }),
  ]);

  return NextResponse.json({
    todayStr,
    weekStartStr,
    challenges:     challenges ?? [],
    submissions:    submissions ?? [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentPenalty: (profile as any)?.current_penalty ?? null,
    scheduled:      scheduled ?? [],
  });
}
