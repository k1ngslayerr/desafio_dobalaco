// ============================================================
// Centralised date helpers — keeps the "what is today?" question
// consistent across submission inserts, daily-uniqueness checks,
// dashboard filters and weekly views.
//
// [SECURITY] The submissions table has UNIQUE(challenge_id, user_id,
// submitted_date) to prevent duplicate daily submissions. Computing
// the date in UTC on a server in a different zone than the audience
// lets a user submit twice in the same local day (once before and
// once after the UTC day rollover) and double-collect XP.
//
// We pin all "today" computations to America/Sao_Paulo (BRT / UTC-3,
// no DST since 2019) — the target audience's timezone.
// ============================================================

export const APP_TIMEZONE = "America/Sao_Paulo";

// Cache the formatter — Intl.DateTimeFormat construction is non-trivial
const ymdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Returns "YYYY-MM-DD" for the given date (default: now) in APP_TIMEZONE.
 * Uses en-CA locale because its short-date format is the ISO YYYY-MM-DD.
 */
export function appDateStr(date: Date = new Date()): string {
  return ymdFormatter.format(date);
}

/**
 * Returns the Monday-anchored ISO day-of-week (Mon=0 … Sun=6) for the
 * given date in APP_TIMEZONE.
 */
function appDayOfWeekMon0(date: Date): number {
  // en-US "long" weekday name → map to 0..6
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    weekday: "long",
  });
  const name = fmt.format(date);
  const map: Record<string, number> = {
    Monday: 0,
    Tuesday: 1,
    Wednesday: 2,
    Thursday: 3,
    Friday: 4,
    Saturday: 5,
    Sunday: 6,
  };
  return map[name] ?? 0;
}

/**
 * Returns "YYYY-MM-DD" for the Monday of the week containing `date` in
 * APP_TIMEZONE.
 */
export function appWeekStartStr(date: Date = new Date()): string {
  const todayInApp = appDateStr(date);
  const daysFromMon = appDayOfWeekMon0(date);
  // Build a local-time date from todayInApp and subtract daysFromMon.
  // Using UTC arithmetic on the YYYY-MM-DD string is safe because we
  // never re-format with a timezone afterwards — we only read the
  // calendar parts.
  const [y, m, d] = todayInApp.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() - daysFromMon);
  const y2 = utc.getUTCFullYear();
  const m2 = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d2 = String(utc.getUTCDate()).padStart(2, "0");
  return `${y2}-${m2}-${d2}`;
}

/**
 * Day index (Mon=1 … Sun=7) for the given date in APP_TIMEZONE — used
 * by the weekly view to report "days elapsed this week".
 */
export function appDaysElapsedThisWeek(date: Date = new Date()): number {
  return appDayOfWeekMon0(date) + 1;
}
