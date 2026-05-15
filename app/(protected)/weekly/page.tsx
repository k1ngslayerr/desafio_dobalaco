"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2, CalendarDays, AlertTriangle, RotateCcw,
  CheckCircle2, XCircle, Clock, Gavel, ShieldAlert, FileCheck, Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Challenge {
  id: string;
  title: string;
  frequency: "daily" | "weekly" | "streak";
  weekly_target: number;
  xp_reward: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string; // ISO timestamp — used as lower bound when starts_at is null
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
  excuse_date: string; // YYYY-MM-DD
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

interface CellData {
  count: number;
  target: number;
  isComplete: boolean;
  isOnTrack: boolean;
}

// Count excuse dates for a user that fall on given active days
function excusedOnDays(userId: string, excuses: Excuse[], days: string[]): number {
  return excuses.filter((e) => e.user_id === userId && days.includes(e.excuse_date)).length;
}

// Returns the YYYY-MM-DD strings within the current week that fall inside [startsAt, endsAt] and ≤ today
function streakDaysThisWeek(weekStart: string, today: string, startsAt: string | null, endsAt: string | null): string[] {
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart + "T12:00:00");
    d.setDate(d.getDate() + i);
    const dayStr = d.toISOString().split("T")[0];
    if (dayStr > today) break;
    if (startsAt && dayStr < startsAt) continue;
    if (endsAt && dayStr > endsAt) continue;
    days.push(dayStr);
  }
  return days;
}

function computeCell(
  challengeId: string,
  userId: string,
  challenge: Challenge,
  submissions: Submission[],
  excuses: Excuse[],
  today: string,
  weekStart: string
): CellData {
  let count: number;
  let target: number;

  if (challenge.frequency === "weekly") {
    target = challenge.weekly_target;
    count = submissions.filter((s) => s.challenge_id === challengeId && s.user_id === userId).length;
  } else if (challenge.frequency === "streak") {
    const days = streakDaysThisWeek(weekStart, today, challenge.starts_at, challenge.ends_at);
    const excusedInPeriod = excusedOnDays(userId, excuses, days);
    target = Math.max(0, days.length - excusedInPeriod);
    count = submissions.filter((s) => s.challenge_id === challengeId && s.user_id === userId && days.includes(s.submitted_date)).length;
  } else {
    // Daily: respect starts_at and, when absent, fall back to created_at so a
    // challenge created mid-week only demands submissions from its creation day
    // onward — not retroactively from Monday.
    const effectiveStart =
      challenge.starts_at ??
      challenge.created_at.split("T")[0]; // created_at is an ISO timestamp
    const days = streakDaysThisWeek(weekStart, today, effectiveStart, challenge.ends_at);
    const excusedInPeriod = excusedOnDays(userId, excuses, days);
    target = Math.max(0, days.length - excusedInPeriod);
    count = submissions.filter(
      (s) => s.challenge_id === challengeId && s.user_id === userId && days.includes(s.submitted_date)
    ).length;
  }

  return {
    count,
    target,
    isComplete: target === 0 || count >= target,
    isOnTrack: target === 0 || count >= Math.ceil(target / 2),
  };
}

function CellBadge({ cell }: { cell: CellData }) {
  const { count, target, isComplete, isOnTrack } = cell;
  if (isComplete) return (
    <div className="flex flex-col items-center gap-0.5">
      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      <span className="text-xs text-emerald-400 font-medium">{count}/{target}</span>
    </div>
  );
  if (isOnTrack) return (
    <div className="flex flex-col items-center gap-0.5">
      <Clock className="h-4 w-4 text-amber-400" />
      <span className="text-xs text-amber-400 font-medium">{count}/{target}</span>
    </div>
  );
  return (
    <div className="flex flex-col items-center gap-0.5">
      <XCircle className="h-4 w-4 text-red-400" />
      <span className="text-xs text-red-400 font-medium">{count}/{target}</span>
    </div>
  );
}

function formatWeekRange(start: string, end: string) {
  try {
    return `${format(parseISO(start), "d MMM", { locale: ptBR })} – ${format(parseISO(end), "d MMM yyyy", { locale: ptBR })}`;
  } catch { return `${start} – ${end}`; }
}

export default function WeeklyPage() {
  const [data, setData] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (!data) return (
    <div className="py-20 text-center text-muted-foreground">Erro ao carregar dados semanais.</div>
  );

  const { weekStart, weekEnd, today, daysElapsed, challenges, users, submissions, excuses, groupPenalty } = data;

  // Users with active individual punishment
  const penalizedUsers = users.filter((u) => u.current_penalty);

  // Who is behind this week (submission-wise), accounting for excuses
  const behindUsers = users
    .map((u) => {
      let totalMissed = 0;
      for (const ch of challenges) {
        const cell = computeCell(ch.id, u.id, ch, submissions, excuses, today, weekStart);
        totalMissed += Math.max(0, cell.target - cell.count);
      }
      return { user: u, totalMissed };
    })
    .filter((r) => r.totalMissed > 0)
    .sort((a, b) => b.totalMissed - a.totalMissed);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-violet-400" />
          Semana atual
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {formatWeekRange(weekStart, weekEnd)} · Dia {daysElapsed} de 7
        </p>
      </div>

      {/* ── Group penalty banner ─────────────────────────────── */}
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

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />Em dia</span>
        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-amber-400" />Atrasado</span>
        <span className="flex items-center gap-1"><XCircle className="h-3.5 w-3.5 text-red-400" />Muito atrasado</span>
        <span className="flex items-center gap-1"><RotateCcw className="h-3.5 w-3.5 text-amber-400" />Semanal</span>
        <span className="flex items-center gap-1"><Flame className="h-3.5 w-3.5 text-orange-400" />Sequência</span>
        <span className="flex items-center gap-1"><FileCheck className="h-3.5 w-3.5 text-sky-400" />Atestado</span>
      </div>

      {/* ── Matrix ──────────────────────────────────────────── */}
      {challenges.length === 0 || users.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {challenges.length === 0 ? "Nenhum desafio ativo." : "Nenhum usuário ativo."}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="sticky left-0 z-10 bg-muted/70 backdrop-blur px-4 py-3 text-left font-semibold text-muted-foreground min-w-[160px]">
                  Desafio
                </th>
                {users.map((u) => {
                  // Does this user have an excuse today?
                  const excusedToday = excuses.some(
                    (e) => e.user_id === u.id && e.excuse_date === today
                  );
                  // How many excused days does this user have this week (elapsed)?
                  const excusedCount = excuses.filter(
                    (e) => e.user_id === u.id && e.excuse_date <= today
                  ).length;
                  return (
                    <th key={u.id} className="px-4 py-3 text-center font-medium min-w-[90px]">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="font-semibold">{u.username}</span>
                        <span className="text-xs text-muted-foreground font-normal">Nv {u.level}</span>
                        <div className="flex gap-1 items-center justify-center">
                          {u.current_penalty && (
                            <span title={u.current_penalty}>
                              <Gavel className="h-3 w-3 text-red-400" />
                            </span>
                          )}
                          {excusedCount > 0 && (
                            <span title={excusedToday ? "Atestado hoje" : `${excusedCount} dia(s) com atestado`}>
                              <FileCheck className={`h-3 w-3 ${excusedToday ? "text-sky-400" : "text-sky-600"}`} />
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {challenges.map((ch, idx) => (
                <tr
                  key={ch.id}
                  className={cn(
                    "border-b border-border/50 hover:bg-muted/20",
                    idx % 2 === 1 && "bg-muted/10"
                  )}
                >
                  <td className="sticky left-0 z-10 bg-background/95 backdrop-blur px-4 py-3 font-medium">
                    <div className="flex flex-col gap-0.5">
                      <span className="line-clamp-1">{ch.title}</span>
                      {ch.frequency === "weekly" && (
                        <span className="text-xs text-amber-400 flex items-center gap-0.5">
                          <RotateCcw className="h-2.5 w-2.5" />{ch.weekly_target}×/sem
                        </span>
                      )}
                      {ch.frequency === "streak" && (
                        <span className="text-xs text-orange-400 flex items-center gap-0.5">
                          <Flame className="h-2.5 w-2.5" />Sequência
                        </span>
                      )}
                    </div>
                  </td>
                  {users.map((u) => {
                    const cell = computeCell(ch.id, u.id, ch, submissions, excuses, today, weekStart);
                    // For daily/streak challenges, check if today specifically is excused
                    const excusedToday = (ch.frequency === "daily" || ch.frequency === "streak") && excuses.some(
                      (e) => e.user_id === u.id && e.excuse_date === today
                    );
                    return (
                      <td key={u.id} className="px-4 py-3 text-center">
                        {excusedToday && cell.target === 0 ? (
                          // All elapsed days are excused — show special state
                          <div className="flex flex-col items-center gap-0.5">
                            <FileCheck className="h-4 w-4 text-sky-400" />
                            <span className="text-xs text-sky-400 font-medium">Atestado</span>
                          </div>
                        ) : (
                          <CellBadge cell={cell} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Who is behind this week ──────────────────────────── */}
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
                      <Badge variant="outline" className="text-red-400 border-red-500/30 bg-red-500/10 gap-1 text-xs max-w-[180px] truncate">
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

      {/* ── Active individual punishments ────────────────────── */}
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

      {/* ── Active excuses this week ─────────────────────────── */}
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
                                  className={`text-xs gap-1 ${
                                    isPast
                                      ? "text-sky-400 border-sky-500/40"
                                      : "text-muted-foreground border-border"
                                  }`}
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

      {/* All good state */}
      {behindUsers.length === 0 && penalizedUsers.length === 0 && !groupPenalty.group_penalty_active && challenges.length > 0 && (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
            <p className="font-semibold text-emerald-400">Grupo em dia! 🎉</p>
            <p className="text-xs text-muted-foreground mt-1">Ninguém atrasado e sem punições ativas.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
