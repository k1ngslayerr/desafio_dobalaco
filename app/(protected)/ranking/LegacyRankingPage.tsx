"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LevelArt } from "@/components/LevelArt";
import { SignedAvatar } from "@/components/SignedAvatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, Trophy, AlertTriangle, Gavel, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RankEntry {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  xp: number;
  level: number;
  art_tier: number;
  approvedCount: number;
  contestedCount: number;
  weeklyXp: number;
  current_penalty: string | null;
}

type Tab = "geral" | "semanal";

// ── Helpers ────────────────────────────────────────────────────────────────────

function addWeeks(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + n * 7);
  return [
    utc.getUTCFullYear(),
    String(utc.getUTCMonth() + 1).padStart(2, "0"),
    String(utc.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function formatWeekRange(weekStart: string): string {
  const s = new Date(weekStart + "T12:00:00");
  const e = new Date(weekStart + "T12:00:00");
  e.setDate(e.getDate() + 6);
  const fmt = (dt: Date) =>
    dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `${fmt(s)} – ${fmt(e)}`;
}

// ── Config ─────────────────────────────────────────────────────────────────────

const medalConfig = [
  { label: "🥇", className: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
  { label: "🥈", className: "text-slate-300 bg-slate-300/10 border-slate-300/30" },
  { label: "🥉", className: "text-amber-600 bg-amber-600/10 border-amber-600/30" },
];

// Polling cadence: a Postgres-Realtime subscription on `users` would be
// blocked by RLS (TO authenticated) since the browser client runs as anon
// — cookies are httpOnly. Polling /api/ranking every 20s keeps the
// leaderboard near-live without a websocket.
const POLL_INTERVAL_MS = 20_000;

// ── Component ──────────────────────────────────────────────────────────────────

export default function RankingPage() {
  const [ranking, setRanking]                 = useState<RankEntry[]>([]);
  // selectedWeekStart: null until first API response sets it to the current week
  const [selectedWeekStart, setSelectedWeekStart] = useState<string | null>(null);
  // currentWeekStart: the actual current week (BRT) — set once from the API
  const [currentWeekStart, setCurrentWeekStart]   = useState<string | null>(null);
  // Ref mirrors currentWeekStart so the polling closure can read it without
  // triggering a stale-closure re-render cycle.
  const currentWeekRef = useRef<string | null>(null);

  const [loading, setLoading]         = useState(true);
  const [weekLoading, setWeekLoading] = useState(false);
  const [tab, setTab]                 = useState<Tab>("geral");

  // ── Polling effect: re-runs whenever selectedWeekStart changes ─────────────
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const url = selectedWeekStart
        ? `/api/ranking?week=${selectedWeekStart}`
        : "/api/ranking";
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (cancelled) return;

        setRanking(json.ranking ?? []);

        // On first load the API tells us the real current week in BRT.
        // Store it once (via ref to avoid a stale-closure in subsequent polls).
        if (json.weekStart && !currentWeekRef.current) {
          currentWeekRef.current = json.weekStart;
          setCurrentWeekStart(json.weekStart);
          // Initialize selectedWeekStart to the current week — this triggers a
          // re-run of the effect, but the second fetch uses the same ?week= and
          // returns identical data (harmless double-fetch on first load only).
          setSelectedWeekStart(json.weekStart);
        }
      } catch {
        // network blip — try again on the next tick
      } finally {
        if (!cancelled) {
          setLoading(false);
          setWeekLoading(false);
        }
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [selectedWeekStart]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived state ──────────────────────────────────────────────────────────

  const isCurrentWeek = selectedWeekStart === currentWeekStart;

  const list: RankEntry[] =
    tab === "geral"
      ? ranking
      : [...ranking]
          .filter((u) => u.weeklyXp > 0)
          .sort((a, b) => b.weeklyXp - a.weeklyXp);

  // ── Week navigation ────────────────────────────────────────────────────────

  function prevWeek() {
    if (!selectedWeekStart) return;
    setWeekLoading(true);
    setSelectedWeekStart(addWeeks(selectedWeekStart, -1));
  }

  function nextWeek() {
    if (!selectedWeekStart || isCurrentWeek) return;
    setWeekLoading(true);
    const next = addWeeks(selectedWeekStart, +1);
    // Clamp to current week
    setSelectedWeekStart(
      currentWeekStart && next >= currentWeekStart ? currentWeekStart : next
    );
  }

  const weekRangeLabel = selectedWeekStart ? formatWeekRange(selectedWeekStart) : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="h-6 w-6 text-yellow-400" /> Ranking
        </h1>
        <p className="text-muted-foreground mt-1">
          {tab === "geral"
            ? "Top jogadores por XP acumulado"
            : isCurrentWeek
              ? "XP conquistado esta semana"
              : weekRangeLabel
                ? `Semana de ${weekRangeLabel}`
                : "Carregando…"}
        </p>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────── */}
      <div className="flex rounded-lg border border-border overflow-hidden w-fit">
        {(["geral", "semanal"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-5 py-2 text-sm font-medium transition-colors",
              tab === t
                ? "bg-violet-600 text-white"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {t === "geral" ? "Geral" : "Semanal"}
          </button>
        ))}
      </div>

      {/* ── Week navigator (Semanal tab only) ─────────────────────── */}
      {tab === "semanal" && (
        <div className="flex items-center gap-3">
          <button
            onClick={prevWeek}
            disabled={!selectedWeekStart}
            className="flex items-center justify-center h-8 w-8 rounded-md border border-border
              text-muted-foreground hover:text-foreground hover:border-violet-500/50
              disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Semana anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex-1 text-center">
            <p className="text-sm font-semibold">
              {isCurrentWeek ? "Semana atual" : weekRangeLabel ?? "—"}
            </p>
            {!isCurrentWeek && weekRangeLabel && (
              <button
                onClick={() => {
                  setWeekLoading(true);
                  setSelectedWeekStart(currentWeekStart);
                }}
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors mt-0.5"
              >
                Voltar para atual
              </button>
            )}
          </div>

          <button
            onClick={nextWeek}
            disabled={!selectedWeekStart || isCurrentWeek}
            className="flex items-center justify-center h-8 w-8 rounded-md border border-border
              text-muted-foreground hover:text-foreground hover:border-violet-500/50
              disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Próxima semana"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── List ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className={cn("space-y-2 transition-opacity duration-150", weekLoading && "opacity-40 pointer-events-none")}>
          {list.length === 0 && tab === "semanal" ? (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <Trophy className="h-8 w-8 opacity-30" />
              <p className="text-sm">Nenhum XP registrado nessa semana.</p>
            </div>
          ) : (
            list.map((user, index) => {
              const pos = index + 1;
              const medal = pos <= 3 ? medalConfig[pos - 1] : null;
              const xpDisplay = tab === "geral" ? user.xp : user.weeklyXp;

              return (
                <Link key={user.id} href={`/u/${user.username}`}>
                  <Card
                    className={cn(
                      "p-3 transition-colors cursor-pointer hover:border-violet-500/40 hover:bg-violet-500/5",
                      pos === 1 && "border-yellow-400/30 bg-yellow-400/5",
                      pos === 2 && "border-slate-300/30 bg-slate-300/5",
                      pos === 3 && "border-amber-600/30 bg-amber-600/5"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {/* Position */}
                      <div className="w-8 text-center shrink-0">
                        {medal ? (
                          <Badge
                            variant="outline"
                            className={cn("text-sm px-1.5 py-0.5", medal.className)}
                          >
                            {medal.label}
                          </Badge>
                        ) : (
                          <span className="text-sm font-semibold text-muted-foreground">
                            #{pos}
                          </span>
                        )}
                      </div>

                      {/* Avatar + LevelArt badge */}
                      <div className="relative shrink-0">
                        <SignedAvatar
                          path={user.avatar_url}
                          fallback={user.username.slice(0, 2).toUpperCase()}
                          className="h-10 w-10"
                        />
                        <div className="absolute -bottom-1 -right-1">
                          <LevelArt tier={user.art_tier} level={user.level} size={20} />
                        </div>
                      </div>

                      {/* Name + penalty */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="font-semibold text-sm truncate">
                            {user.full_name || user.username}
                          </p>
                          {user.current_penalty && (
                            <span
                              title={user.current_penalty}
                              className="inline-flex shrink-0 items-center justify-center h-4 w-4 rounded-full bg-red-500/20 text-red-400"
                            >
                              <Gavel className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">@{user.username}</p>
                        {user.current_penalty && (
                          <p className="text-xs text-red-400 truncate max-w-[160px] mt-0.5">
                            {user.current_penalty}
                          </p>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="text-right shrink-0 space-y-1">
                        <p className="text-sm font-bold text-emerald-400">
                          {xpDisplay.toLocaleString()} XP
                        </p>
                        <p className="text-xs text-muted-foreground">Nível {user.level}</p>
                        {tab === "geral" && (
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {user.approvedCount > 0 && (
                              <span className="text-[11px] text-muted-foreground">
                                {user.approvedCount} aprovada{user.approvedCount !== 1 ? "s" : ""}
                              </span>
                            )}
                            {user.contestedCount > 0 && (
                              <Badge
                                variant="outline"
                                className="text-[11px] py-0 px-1.5 h-4 text-orange-400 border-orange-500/30 bg-orange-500/10 gap-1"
                              >
                                <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                                {user.contestedCount} contestada{user.contestedCount !== 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
