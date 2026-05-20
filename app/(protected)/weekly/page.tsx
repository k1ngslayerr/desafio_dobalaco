"use client";

export const dynamic = "force-dynamic";

import { Fragment, useEffect, useState, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2, CalendarDays, AlertTriangle, CheckCircle2, XCircle,
  Gavel, ShieldAlert, FileCheck, ChevronDown, ChevronRight,
  Flame, RotateCcw, Minus, AlertOctagon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Interfaces ────────────────────────────────────────────────────────────────

interface Challenge {
  id: string;
  title: string;
  frequency: "daily" | "weekly" | "streak";
  weekly_target: number;
  xp_reward: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string; // ISO timestamp — lower bound when starts_at is null
}

interface AppUser {
  id: string;
  username: string;
  xp: number;
  level: number;
  current_penalty: string | null;
}

interface Submission {
  challenge_id: string;
  user_id: string;
  submitted_date: string;
  status: string;
}

interface GroupPenalty {
  group_penalty_text: string;
  group_penalty_active: boolean;
}

interface Excuse {
  id: string;
  user_id: string;
  excuse_date: string;
  reason: string | null;
}

interface WeeklyData {
  weekStart: string;
  weekEnd: string;
  today: string;
  daysElapsed: number;
  challenges: Challenge[];
  users: AppUser[];
  submissions: Submission[];
  excuses: Excuse[];
  groupPenalty: GroupPenalty;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Monday = S, Tuesday = T, ... Sunday = D
const DAY_INITIALS = ["S", "T", "Q", "Q", "S", "S", "D"];

function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + "T12:00:00");
    d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

/**
 * Strict active check — no grace period.
 * The weekly grid shows the intended schedule; grace period is for
 * the submission form only (allows late submission), not for display.
 */
function isChallengeActiveOnDay(ch: Challenge, day: string): boolean {
  if (ch.starts_at && day < ch.starts_at) return false;
  if (ch.ends_at && day > ch.ends_at) return false;
  return true;
}

function formatWeekRange(start: string, end: string) {
  try {
    return `${format(parseISO(start), "d MMM", { locale: ptBR })} – ${format(parseISO(end), "d MMM yyyy", { locale: ptBR })}`;
  } catch { return `${start} – ${end}`; }
}

// ── Challenge grouping ────────────────────────────────────────────────────────
// Challenges named "Foo - Seg", "Foo - Ter" etc. are the same recurring
// challenge split into per-day DB records. Strip the suffix to unify them.

function baseName(title: string): string {
  return title.replace(/ - (Seg|Ter|Qua|Qui|Sex|Sáb|Dom)$/, "");
}

interface ChallengeGroup {
  key: string;                         // display title (base name)
  frequency: Challenge["frequency"];
  weekly_target: number;
  xp_reward: number;
  challenges: Challenge[];             // one DB record per applicable day
}

function buildGroups(challenges: Challenge[]): ChallengeGroup[] {
  const map = new Map<string, ChallengeGroup>();
  for (const ch of challenges) {
    const key = baseName(ch.title);
    const existing = map.get(key);
    if (existing) {
      existing.challenges.push(ch);
    } else {
      map.set(key, {
        key,
        frequency: ch.frequency,
        weekly_target: ch.weekly_target,
        xp_reward: ch.xp_reward,
        challenges: [ch],
      });
    }
  }
  return Array.from(map.values());
}

// ── Per-group compliance cell ─────────────────────────────────────────────────

interface CellData { count: number; target: number; isComplete: boolean; isOnTrack: boolean; }

function computeGroupCell(
  group: ChallengeGroup,
  userId: string,
  submissions: Submission[],
  excuses: Excuse[],
  today: string,
  weekStart: string,
): CellData {
  if (group.frequency === "weekly") {
    const ids = new Set(group.challenges.map((c) => c.id));
    const target = group.weekly_target;
    // Exclude failed submissions — they don't count toward the weekly target
    const count = submissions.filter((s) => s.user_id === userId && ids.has(s.challenge_id) && s.status !== "failed").length;
    return { count, target, isComplete: target === 0 || count >= target, isOnTrack: target === 0 || count >= Math.ceil(target / 2) };
  }

  // daily / streak — build a map: dayStr → challengeId (strict, no grace)
  const dayToChId = new Map<string, string>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart + "T12:00:00");
    d.setDate(d.getDate() + i);
    const dayStr = d.toISOString().split("T")[0];
    if (dayStr > today) break;
    const ch = group.challenges.find((c) => isChallengeActiveOnDay(c, dayStr));
    if (ch) dayToChId.set(dayStr, ch.id);
  }

  const activeDays = Array.from(dayToChId.keys());
  const excusedInPeriod = excuses.filter(
    (e) => e.user_id === userId && activeDays.includes(e.excuse_date)
  ).length;
  const target = Math.max(0, activeDays.length - excusedInPeriod);
  // Only approved submissions count as done (contested = not valid)
  const count = activeDays.filter((day) => {
    const chId = dayToChId.get(day)!;
    return submissions.some((s) => s.user_id === userId && s.challenge_id === chId && s.status === "approved");
  }).length;

  return { count, target, isComplete: target === 0 || count >= target, isOnTrack: target === 0 || count >= Math.ceil(target / 2) };
}

// ── Collapsed day cell: X/Y challenge groups done on a given day ─────────────

function CollapsedCell({
  userId, day, today, groups, submissions, excuses,
}: {
  userId: string; day: string; today: string;
  groups: ChallengeGroup[]; submissions: Submission[]; excuses: Excuse[];
}) {
  if (day > today) {
    return <span className="text-muted-foreground/25 text-xs select-none">—</span>;
  }

  // Only count groups that have a challenge strictly active on this day (no grace)
  const activeGroups = groups.filter((g) =>
    g.challenges.some((ch) => isChallengeActiveOnDay(ch, day))
  );
  const total = activeGroups.length;
  if (total === 0) {
    return <span className="text-muted-foreground/25 text-xs select-none">—</span>;
  }

  const isExcused = excuses.some((e) => e.user_id === userId && e.excuse_date === day);
  const done = activeGroups.filter((g) => {
    const ch = g.challenges.find((c) => isChallengeActiveOnDay(c, day));
    if (!ch) return false;
    // Only approved submissions count — contested does not clear the requirement.
    // For weekly challenges, also match submitted_date so a submission on one
    // day doesn't appear as done on every other day of the week.
    return submissions.some((s) =>
      s.user_id === userId &&
      s.challenge_id === ch.id &&
      s.status === "approved" &&
      (g.frequency !== "weekly" || s.submitted_date === day)
    );
  }).length;

  if (isExcused && done === 0) {
    return <FileCheck className="h-3.5 w-3.5 text-sky-400 mx-auto" />;
  }

  return (
    <span className={cn(
      "text-xs font-bold tabular-nums",
      done >= total  ? "text-emerald-400" :
      done > 0       ? "text-amber-400"   :
                       "text-red-400"
    )}>
      {done}/{total}
    </span>
  );
}

// ── Expanded sub-row cell: ✓ / ✗ / — for one group on one day ───────────────
// Finds the challenge in the group that was due on this day and checks submission.

function ExpandedGroupCell({
  userId, group, day, today, submissions, excuses,
}: {
  userId: string; group: ChallengeGroup; day: string; today: string;
  submissions: Submission[]; excuses: Excuse[];
}) {
  const isFuture = day > today;
  // Find the challenge in this group strictly active on this day
  const ch = group.challenges.find((c) => isChallengeActiveOnDay(c, day));

  if (isFuture || !ch) {
    return <Minus className="h-3 w-3 text-muted-foreground/20 mx-auto" />;
  }

  // For weekly challenges a single DB record spans the whole week, so we must
  // additionally filter by submitted_date to avoid showing ✓ on every day once
  // the user submits once. Daily/streak challenges have a distinct record per
  // day so ch.id already disambiguates correctly.
  const sub = group.frequency === "weekly"
    ? submissions.find((s) => s.user_id === userId && s.challenge_id === ch.id && s.submitted_date === day)
    : submissions.find((s) => s.user_id === userId && s.challenge_id === ch.id);
  const isExcused = excuses.some((e) => e.user_id === userId && e.excuse_date === day);

  if (sub?.status === "approved")  return <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" />;
  if (sub?.status === "contested") return <AlertOctagon className="h-4 w-4 text-orange-400 mx-auto" />;
  if (sub?.status === "pending")   return <CheckCircle2 className="h-4 w-4 text-amber-400/70 mx-auto" />;
  if (sub?.status === "failed")    return <XCircle      className="h-4 w-4 text-rose-500 mx-auto" />;
  if (isExcused)                   return <FileCheck    className="h-4 w-4 text-sky-400 mx-auto" />;
  return                                  <XCircle      className="h-3.5 w-3.5 text-red-400/60 mx-auto" />;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WeeklyPage() {
  const [data, setData]       = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/weekly");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleUser(userId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (!data) return (
    <div className="py-20 text-center text-muted-foreground">Erro ao carregar dados semanais.</div>
  );

  const {
    weekStart, weekEnd, today, daysElapsed,
    challenges, users, submissions, excuses, groupPenalty,
  } = data;

  const days = weekDays(weekStart);
  const groups = buildGroups(challenges);
  const penalizedUsers = users.filter((u) => u.current_penalty);

  const behindUsers = users
    .map((u) => {
      let totalMissed = 0;
      for (const group of groups) {
        const cell = computeGroupCell(group, u.id, submissions, excuses, today, weekStart);
        totalMissed += Math.max(0, cell.target - cell.count);
      }
      return { user: u, totalMissed };
    })
    .filter((r) => r.totalMissed > 0)
    .sort((a, b) => b.totalMissed - a.totalMissed);

  return (
    <div className="space-y-6">

      {/* ── Header ────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-violet-400" />
          Semana atual
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {formatWeekRange(weekStart, weekEnd)} · Dia {daysElapsed} de 7
        </p>
      </div>

      {/* ── Group penalty banner ───────────────────────────────── */}
      {groupPenalty.group_penalty_active && groupPenalty.group_penalty_text && (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-400 text-sm">Punição do grupo em vigor</p>
                <p className="text-sm mt-0.5">{groupPenalty.group_penalty_text}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Legend ────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />Completo
        </span>
        <span className="flex items-center gap-1">
          <XCircle className="h-3.5 w-3.5 text-red-400/70" />Faltou
        </span>
        <span className="flex items-center gap-1">
          <AlertOctagon className="h-3.5 w-3.5 text-orange-400" />Contestado
        </span>
        <span className="flex items-center gap-1">
          <FileCheck className="h-3.5 w-3.5 text-sky-400" />Atestado
        </span>
        <span className="flex items-center gap-1">
          <RotateCcw className="h-3.5 w-3.5 text-amber-400" />Semanal
        </span>
        <span className="flex items-center gap-1">
          <Flame className="h-3.5 w-3.5 text-orange-400" />Sequência
        </span>
      </div>

      {/* ── Main grid ─────────────────────────────────────────── */}
      {groups.length === 0 || users.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {groups.length === 0 ? "Nenhum desafio ativo." : "Nenhum usuário ativo."}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {/* sticky name column */}
                <th className="sticky left-0 z-10 bg-muted/70 backdrop-blur px-4 py-3 text-left font-semibold text-muted-foreground min-w-[160px]">
                  Participante
                </th>
                {days.map((day, i) => {
                  const isToday  = day === today;
                  const isFuture = day > today;
                  return (
                    <th
                      key={day}
                      className={cn(
                        "px-2 py-3 text-center font-semibold w-11",
                        isToday  ? "text-violet-400"           :
                        isFuture ? "text-muted-foreground/30"  :
                                   "text-muted-foreground"
                      )}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span>{DAY_INITIALS[i]}</span>
                        {isToday && (
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {users.map((u) => {
                const isExpanded = expanded.has(u.id);
                return (
                  <Fragment key={u.id}>

                    {/* ── Collapsed user row ────────────────── */}
                    <tr
                      className={cn(
                        "border-b border-border hover:bg-muted/20 cursor-pointer transition-colors select-none",
                        isExpanded && "bg-muted/10"
                      )}
                      onClick={() => toggleUser(u.id)}
                    >
                      <td className="sticky left-0 z-10 bg-background/95 backdrop-blur px-4 py-3 font-medium">
                        <div className="flex items-center gap-2 min-w-0">
                          {isExpanded
                            ? <ChevronDown  className="h-4 w-4 text-muted-foreground shrink-0" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          }
                          <span className="font-semibold truncate">{u.username}</span>
                          <span className="text-xs text-muted-foreground font-normal shrink-0">
                            Nv {u.level}
                          </span>
                          {u.current_penalty && (
                            <span title={u.current_penalty}>
                              <Gavel className="h-3 w-3 text-red-400 shrink-0" />
                            </span>
                          )}
                        </div>
                      </td>
                      {days.map((day) => (
                        <td key={day} className="px-2 py-3 text-center">
                          <CollapsedCell
                            userId={u.id}
                            day={day}
                            today={today}
                            groups={groups}
                            submissions={submissions}
                            excuses={excuses}
                          />
                        </td>
                      ))}
                    </tr>

                    {/* ── Expanded: one sub-row per challenge group ── */}
                    {isExpanded && groups.map((group, gi) => (
                      <tr
                        key={`${u.id}__${group.key}`}
                        className={cn(
                          "border-b border-border/30",
                          gi % 2 === 0 ? "bg-muted/5" : "bg-muted/[0.08]"
                        )}
                      >
                        {/* group name, indented */}
                        <td className="sticky left-0 z-10 bg-background/90 backdrop-blur pl-11 pr-4 py-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {group.frequency === "weekly" && (
                              <RotateCcw className="h-3 w-3 text-amber-400 shrink-0" />
                            )}
                            {group.frequency === "streak" && (
                              <Flame className="h-3 w-3 text-orange-400 shrink-0" />
                            )}
                            <span className="truncate">{group.key}</span>
                          </div>
                        </td>
                        {days.map((day) => (
                          <td key={day} className="px-2 py-2 text-center">
                            <ExpandedGroupCell
                              userId={u.id}
                              group={group}
                              day={day}
                              today={today}
                              submissions={submissions}
                              excuses={excuses}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}

                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Who is behind ─────────────────────────────────────── */}
      {behindUsers.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            Atrasados esta semana
          </h2>
          <div className="space-y-2">
            {behindUsers.map((r, i) => (
              <Card key={r.user.id}>
                <CardContent className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground font-mono text-sm w-5">#{i + 1}</span>
                      <div>
                        <p className="font-semibold text-sm">{r.user.username}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.totalMissed} submissão{r.totalMissed !== 1 ? "ões" : ""} em falta
                        </p>
                      </div>
                    </div>
                    {r.user.current_penalty && (
                      <Badge
                        variant="outline"
                        className="text-red-400 border-red-500/30 bg-red-500/10 gap-1 text-xs max-w-[180px] truncate"
                      >
                        <Gavel className="h-3 w-3 shrink-0" />
                        <span className="truncate">{r.user.current_penalty}</span>
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ── Active individual punishments ─────────────────────── */}
      {penalizedUsers.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Gavel className="h-5 w-5 text-red-400" />
            Punições ativas
          </h2>
          <div className="space-y-2">
            {penalizedUsers.map((u) => (
              <Card key={u.id} className="border-red-500/30 bg-red-500/5">
                <CardContent className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <Gavel className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm">{u.username}</p>
                      <p className="text-sm text-red-400">{u.current_penalty}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ── Active excuses ────────────────────────────────────── */}
      {excuses.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-sky-400" />
            Atestados desta semana
          </h2>
          <div className="space-y-2">
            {users
              .filter((u) => excuses.some((e) => e.user_id === u.id))
              .map((u) => {
                const userExcuses = excuses
                  .filter((e) => e.user_id === u.id)
                  .sort((a, b) => a.excuse_date.localeCompare(b.excuse_date));
                return (
                  <Card key={u.id} className="border-sky-500/30 bg-sky-500/5">
                    <CardContent className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <FileCheck className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{u.username}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {userExcuses.map((e) => {
                              const d = new Date(e.excuse_date + "T12:00:00");
                              const label = format(d, "EEE dd/MM", { locale: ptBR });
                              const isPast = e.excuse_date <= today;
                              return (
                                <Badge
                                  key={e.id}
                                  variant="outline"
                                  className={cn(
                                    "text-xs gap-1",
                                    isPast
                                      ? "text-sky-400 border-sky-500/40"
                                      : "text-muted-foreground border-border"
                                  )}
                                  title={e.reason ?? undefined}
                                >
                                  {label}
                                  {e.reason && " · " + e.reason}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </section>
      )}

      {/* ── All good state ────────────────────────────────────── */}
      {behindUsers.length === 0 &&
        penalizedUsers.length === 0 &&
        !groupPenalty.group_penalty_active &&
        groups.length > 0 && (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
            <p className="font-semibold text-emerald-400">Grupo em dia! 🎉</p>
            <p className="text-xs text-muted-foreground mt-1">
              Ninguém atrasado e sem punições ativas.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
