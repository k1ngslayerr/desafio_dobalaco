import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LevelArt } from "@/components/LevelArt";
import { XPBar } from "@/components/XPBar";
import { SubmissionCard, type SubmissionCardData } from "@/components/SubmissionCard";
import { SignedAvatar } from "@/components/SignedAvatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Swords, ArrowRight, Gavel } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("id, username, full_name, avatar_url, xp, level, role, current_penalty")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const [{ data: currentLevel }, { data: nextLevel }] = await Promise.all([
    supabase.from("level_config").select("xp_required, art_tier").eq("level", profile.level).single(),
    supabase.from("level_config").select("xp_required").eq("level", profile.level + 1).single(),
  ]);

  const artTier = currentLevel?.art_tier ?? 1;
  // Within-level XP progress: subtract the threshold at which this level was entered.
  // Level 1 starts at 0 XP (no prior threshold); higher levels start at their own xp_required.
  const currentThreshold = profile.level > 1 ? (currentLevel?.xp_required ?? 0) : 0;
  const nextThreshold = nextLevel?.xp_required ?? (currentThreshold + 100);
  const levelXP = Math.max(0, Number(profile.xp) - Number(currentThreshold));
  const levelGap = Math.max(1, Number(nextThreshold) - Number(currentThreshold));

  // Fetch active challenges the user hasn't submitted to today (daily) or completed this week (weekly)
  // [SECURITY] Use app-timezone dates so the filter matches `submitted_date`
  // written by /api/submissions. See lib/date.ts.
  const { appDateStr, appWeekStartStr } = await import("@/lib/date");
  const todayStr = appDateStr();
  const weekStartStr = appWeekStartStr();

  const { data: userSubmissions } = await supabase
    .from("submissions")
    .select("challenge_id, submitted_date")
    .eq("user_id", user.id)
    .gte("submitted_date", weekStartStr);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const weekSubs = (userSubmissions as any[]) ?? [];
  const todaySubmittedIds = new Set(
    weekSubs.filter((s) => s.submitted_date === todayStr).map((s) => s.challenge_id)
  );

  const { data: allChallenges } = await supabase
    .from("challenges")
    .select("id, title, description, xp_reward, frequency, weekly_target")
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${todayStr}`)
    .or(`ends_at.is.null,ends_at.gte.${todayStr}`)
    .order("created_at", { ascending: false })
    .limit(12);

  // Weekly count map for weekly-frequency challenges
  const weeklyCountMap: Record<string, number> = {};
  for (const s of weekSubs) {
    weeklyCountMap[s.challenge_id] = (weeklyCountMap[s.challenge_id] ?? 0) + 1;
  }

  // Filter: show challenges that still need action today/this week
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openChallenges = ((allChallenges ?? []) as any[])
    .filter((ch) => {
      if (ch.frequency === "weekly") {
        return (weeklyCountMap[ch.id] ?? 0) < ch.weekly_target;
      }
      return !todaySubmittedIds.has(ch.id);
    })
    .slice(0, 6);

  // Fetch recent user submissions with reactions
  const { data: recentSubs } = await supabase
    .from("submissions")
    .select(`
      id, photo_url, status, xp_awarded, created_at,
      user:users!user_id(id, username, avatar_url),
      challenge:challenges(title, xp_reward),
      reactions(type, user_id)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const submissions: SubmissionCardData[] = ((recentSubs ?? []) as any[]).map((s) => ({
    id: s.id,
    photo_url: s.photo_url,
    status: s.status as SubmissionCardData["status"],
    xp_awarded: s.xp_awarded,
    created_at: s.created_at,
    user: s.user as SubmissionCardData["user"],
    challenge: s.challenge as SubmissionCardData["challenge"],
    reactions: {
      positive: (s.reactions as Array<{ type: string }>).filter((r) => r.type === "positive").length,
      negative: (s.reactions as Array<{ type: string }>).filter((r) => r.type === "negative").length,
    },
    userReaction: (s.reactions as Array<{ type: string; user_id: string }>)
      .find((r) => r.user_id === user.id)?.type as "positive" | "negative" | null ?? null,
    currentUserId: user.id,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentPenalty = (profile as any)?.current_penalty as string | null ?? null;

  return (
    <div className="space-y-8">
      {/* ── Active penalty banner ────────────────────────────── */}
      {currentPenalty && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Gavel className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-400 text-sm">Você tem uma punição ativa</p>
                <p className="text-sm mt-0.5">{currentPenalty}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Hero: user card ─────────────────────────────────── */}
      <Card className="overflow-hidden bg-gradient-to-r from-violet-950/30 to-background">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Avatar + LevelArt badge */}
            <div className="relative shrink-0">
              <SignedAvatar
                path={profile.avatar_url}
                fallback={profile.username.slice(0, 2).toUpperCase()}
                className="h-20 w-20"
              />
              <div className="absolute -bottom-2 -right-2">
                <LevelArt tier={artTier} level={profile.level} size={32} />
              </div>
            </div>

            <div className="flex-1 text-center sm:text-left space-y-3">
              <div>
                <h1 className="text-2xl font-bold">{profile.full_name || profile.username}</h1>
                <div className="flex items-center gap-2 justify-center sm:justify-start mt-1">
                  <Badge variant="secondary" className="text-xs">
                    Nível {profile.level}
                  </Badge>
                  {profile.role === "admin" && (
                    <Badge className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30">
                      Admin
                    </Badge>
                  )}
                </div>
              </div>
              <XPBar
                currentXP={levelXP}
                requiredXP={levelGap}
                level={profile.level}
                className="max-w-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Open challenges ──────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Swords className="h-5 w-5 text-violet-400" />
            Desafios abertos
          </h2>
          <Link href="/challenges" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1")}>
            Ver todos <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {!openChallenges?.length ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Você completou todos os desafios disponíveis! 🎉
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {openChallenges.map((ch) => (
              <Link key={ch.id} href={`/challenges/${ch.id}`}>
                <Card className="h-full hover:border-violet-500/50 transition-colors cursor-pointer group">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm group-hover:text-violet-400 transition-colors line-clamp-2">
                      {ch.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground line-clamp-2">{ch.description}</p>
                    <Badge variant="outline" className="w-fit text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                      +{ch.xp_reward} XP
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── Recent submissions ───────────────────────────────── */}
      {submissions.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">Suas últimas submissões</h2>
          <div className="space-y-4">
            {submissions.map((s) => (
              <SubmissionCard key={s.id} data={s} showChallenge />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
