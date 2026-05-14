import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/weekly
// Returns challenges × users submission matrix for the current week.
// Used by the /weekly page to render the checklist view.
export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // ── Current week bounds (Monday–Sunday) ───────────────────
  const now = new Date();
  const dow = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysFromMon);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const weekStartStr = weekStart.toISOString().split("T")[0];
  const weekEndStr   = weekEnd.toISOString().split("T")[0];
  const todayStr     = now.toISOString().split("T")[0];
  const daysElapsed  = daysFromMon + 1; // Mon=1 ... Sun=7

  // ── Parallel fetches ─────────────────────────────────────
  const [
    { data: challenges },
    { data: users },
    { data: submissions },
    { data: settings },
    { data: excuses },
  ] = await Promise.all([
    supabase
      .from("challenges")
      .select("id, title, frequency, weekly_target, xp_reward, starts_at, ends_at")
      .eq("is_active", true)
      .or(`starts_at.is.null,starts_at.lte.${todayStr}`)
      .or(`ends_at.is.null,ends_at.gte.${todayStr}`)
      .order("title"),
    supabase
      .from("users")
      .select("id, username, avatar_url, xp, level, status, current_penalty")
      .eq("status", "active")
      .order("xp", { ascending: false }),
    supabase
      .from("submissions")
      .select("challenge_id, user_id, submitted_date, status")
      .gte("submitted_date", weekStartStr)
      .lte("submitted_date", weekEndStr),
    supabase
      .from("app_settings")
      .select("group_penalty_text, group_penalty_active")
      .single(),
    supabase
      .from("user_excuses")
      .select("id, user_id, excuse_date, reason")
      .gte("excuse_date", weekStartStr)
      .lte("excuse_date", weekEndStr),
  ]);

  return NextResponse.json({
    weekStart: weekStartStr,
    weekEnd:   weekEndStr,
    today:     todayStr,
    daysElapsed,
    challenges:   challenges  ?? [],
    users:        users       ?? [],
    submissions:  submissions ?? [],
    excuses:      excuses     ?? [],
    groupPenalty: settings    ?? { group_penalty_text: "", group_penalty_active: false },
  });
}
