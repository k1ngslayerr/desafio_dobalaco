"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LevelArt } from "@/components/LevelArt";
import { SignedAvatar } from "@/components/SignedAvatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, Trophy, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

type Tab = "geral" | "semanal";

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

export default function RankingPage() {
  const [ranking, setRanking] = useState<RankEntry[]>([]);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("geral");

  useEffect(() => {
    let cancelled = false;

    async function fetchRanking() {
      try {
        const res = await fetch("/api/ranking", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) {
          setRanking(json.ranking ?? []);
          setWeekStart(json.weekStart ?? null);
        }
      } catch {
        // network blip — try again on the next tick
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchRanking();
    const id = setInterval(fetchRanking, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Derive the sorted list based on active tab
  const list: RankEntry[] =
    tab === "geral"
      ? ranking // already sorted by xp desc from the API
      : [...ranking]
          .filter((u) => u.weeklyXp > 0)
          .sort((a, b) => b.weeklyXp - a.weeklyXp);

  // Format week start for display (e.g. "19/05")
  const weekLabel = weekStart
    ? new Date(weekStart + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-400" /> Ranking
          </h1>
          <p className="text-muted-foreground mt-1">
            {tab === "geral"
              ? "Top jogadores por XP acumulado"
              : weekLabel
                ? `XP conquistado desde ${weekLabel}`
                : "XP conquistado esta semana"}
          </p>
        </div>
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

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : list.length === 0 && tab === "semanal" ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <Trophy className="h-8 w-8 opacity-30" />
          <p className="text-sm">Nenhum XP registrado esta semana ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((user, index) => {
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

                  {/* Name + level */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {user.full_name || user.username}
                    </p>
                    <p className="text-xs text-muted-foreground">@{user.username}</p>
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
          })}
        </div>
      )}
    </div>
  );
}
