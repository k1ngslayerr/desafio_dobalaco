import { notFound, redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { FeedRealtime } from "@/components/FeedRealtime";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ArrowLeft, Zap } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { SubmissionCardData } from "@/components/SubmissionCard";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ChallengeFeedPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch challenge
  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, title, description, xp_reward")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (!challenge) notFound();

  // Fetch submissions with user and reactions — admin client bypasses RLS so
  // all users' submissions are visible in the feed (not just the viewer's own)
  const adminClient = await createAdminClient();
  const { data: subs, error: feedError } = await adminClient
    .from("submissions")
    .select(`
      id, photo_url, title, description, status, xp_awarded, created_at,
      user:users(id, username, avatar_url),
      reactions(type, user_id)
    `)
    .eq("challenge_id", id)
    .order("created_at", { ascending: false });

  // Fallback: if the detailed query failed (e.g. missing column), try without joins
  let rawCount: number | null = null;
  if (feedError) {
    console.error("[feed] detailed query failed:", feedError.message, feedError.code);
    const { count } = await adminClient
      .from("submissions")
      .select("*", { count: "exact", head: true })
      .eq("challenge_id", id);
    rawCount = count;
    console.error("[feed] raw count for challenge", id, ":", rawCount);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initialSubmissions: SubmissionCardData[] = ((subs ?? []) as any[]).map((s) => ({
    id: s.id,
    photo_url: s.photo_url,
    title: s.title as string | null ?? null,
    description: s.description as string | null ?? null,
    status: s.status as SubmissionCardData["status"],
    xp_awarded: s.xp_awarded,
    created_at: s.created_at,
    user: s.user as SubmissionCardData["user"],
    reactions: {
      positive: (s.reactions as Array<{ type: string }>).filter((r) => r.type === "positive").length,
      negative: (s.reactions as Array<{ type: string }>).filter((r) => r.type === "negative").length,
    },
    userReaction:
      (s.reactions as Array<{ type: string; user_id: string }>).find(
        (r) => r.user_id === user.id
      )?.type as "positive" | "negative" | null ?? null,
    currentUserId: user.id,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <Link
          href="/challenges"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Todos os desafios
        </Link>

        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{challenge.title}</h1>
            <p className="text-muted-foreground mt-1">{challenge.description}</p>
          </div>
          <Badge
            variant="outline"
            className="gap-1 text-emerald-400 border-emerald-500/30 bg-emerald-500/10 shrink-0"
          >
            <Zap className="h-3.5 w-3.5" />+{challenge.xp_reward} XP
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground">
          {initialSubmissions.length} {initialSubmissions.length !== 1 ? "submissões" : "submissão"}
          {rawCount !== null && rawCount > 0 && (
            <span className="ml-2 text-xs text-amber-400">
              (DB tem {rawCount} — erro na query: {feedError?.message})
            </span>
          )}
        </p>
      </div>

      {/* Realtime feed */}
      <FeedRealtime
        challengeId={id}
        initialSubmissions={initialSubmissions}
        currentUserId={user.id}
      />
    </div>
  );
}
