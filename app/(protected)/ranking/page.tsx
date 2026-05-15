"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { LevelArt } from "@/components/LevelArt";
import { SignedAvatar } from "@/components/SignedAvatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface RankEntry {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  xp: number;
  level: number;
  art_tier: number;
}

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchRanking() {
      try {
        const res = await fetch("/api/ranking", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setRanking(json.ranking ?? []);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-400" /> Ranking
          </h1>
          <p className="text-muted-foreground mt-1">Top jogadores por XP acumulado</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {ranking.map((user, index) => {
            const pos = index + 1;
            const medal = pos <= 3 ? medalConfig[pos - 1] : null;

            return (
              <Card
                key={user.id}
                className={cn(
                  "p-3 transition-colors",
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
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-emerald-400">
                      {user.xp.toLocaleString()} XP
                    </p>
                    <p className="text-xs text-muted-foreground">Nível {user.level}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
