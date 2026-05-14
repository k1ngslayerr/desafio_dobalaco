"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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

export default function RankingPage() {
  const supabase = useRef(createClient()).current;
  const [ranking, setRanking] = useState<RankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  async function fetchRanking() {
    const { data } = await supabase
      .from("users")
      // [SECURITY] Only select public-safe fields
      .select("id, username, full_name, avatar_url, xp, level")
      .order("xp", { ascending: false })
      .limit(100);

    if (!data) return;

    // Fetch art tiers in bulk
    const levels = [...new Set(data.map((u) => u.level))];
    const { data: levelData } = await supabase
      .from("level_config")
      .select("level, art_tier")
      .in("level", levels);

    const tierMap = new Map(levelData?.map((l) => [l.level, l.art_tier]) ?? []);

    setRanking(
      data.map((u) => ({ ...u, art_tier: tierMap.get(u.level) ?? 1 }))
    );
    setLoading(false);
  }

  useEffect(() => {
    fetchRanking();

    // Realtime: listen for XP/level updates on the users table
    const channel = supabase
      .channel("ranking")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "users" },
        () => { fetchRanking(); }
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {connected ? (
            <><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Ao vivo</>
          ) : (
            <><Loader2 className="h-3 w-3 animate-spin" /> Conectando…</>
          )}
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
