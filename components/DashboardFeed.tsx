"use client";

/**
 * DashboardFeed – Instagram-style feed showing all users' submissions.
 *
 * - Initial load via GET /api/feed (server-side auth, users join works)
 * - Cursor pagination: "Carregar mais" fetches older posts
 * - Realtime: listens for INSERT on `submissions` (any challenge) and
 *   UPDATE on `submissions` + wildcard on `reactions`
 * - When a realtime INSERT arrives it fetches /api/submissions/[id] to
 *   resolve the user join (browser client is anon; httpOnly cookies block it)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SubmissionCard, type SubmissionCardData } from "@/components/SubmissionCard";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DashboardFeedProps {
  currentUserId: string;
}

export function DashboardFeed({ currentUserId }: DashboardFeedProps) {
  const [submissions, setSubmissions] = useState<SubmissionCardData[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(false);

  // Keep a ref so realtime closures always see the current submission list
  // without needing to include it in the effect dependency array (which would
  // tear down and rebuild the Supabase channel on every update).
  const submissionsRef = useRef<SubmissionCardData[]>([]);
  useEffect(() => { submissionsRef.current = submissions; }, [submissions]);

  const supabase = useRef(createClient()).current;

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  const fetchPage = useCallback(async (before?: string) => {
    const params = new URLSearchParams({ limit: "10" });
    if (before) params.set("before", before);
    const res = await fetch(`/api/feed?${params}`);
    if (!res.ok) return null;
    return res.json() as Promise<{ submissions: SubmissionCardData[]; hasMore: boolean }>;
  }, []);

  // Initial load
  useEffect(() => {
    setLoading(true);
    fetchPage().then((data) => {
      if (data) {
        setSubmissions(data.submissions);
        setHasMore(data.hasMore);
      }
    }).finally(() => setLoading(false));
  }, [fetchPage]);

  // Load more (cursor = created_at of the oldest visible item)
  async function loadMore() {
    const oldest = submissionsRef.current.at(-1)?.created_at;
    if (!oldest) return;
    setLoadingMore(true);
    try {
      const data = await fetchPage(oldest);
      if (data) {
        setSubmissions((prev) => [...prev, ...data.submissions]);
        setHasMore(data.hasMore);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  // ── Realtime ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-feed")

      // New submission from any user
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "submissions" },
        async (payload) => {
          // Fetch via server route — the browser client can't resolve the
          // users join (see /api/submissions/[id] for the full explanation).
          const res = await fetch(`/api/submissions/${payload.new.id}`, {
            cache: "no-store",
          });
          if (!res.ok) return;
          const { submission: raw } = await res.json();
          if (!raw) return;

          const card: SubmissionCardData = {
            id:          raw.id,
            photo_url:   raw.photo_url,
            title:       raw.title       ?? null,
            description: raw.description ?? null,
            status:      raw.status,
            xp_awarded:  raw.xp_awarded,
            created_at:  raw.created_at,
            user:        raw.user,
            challenge:   raw.challenge   ?? null,
            reactions: {
              positive: (raw.reactions as Array<{ type: string }>)
                .filter((r) => r.type === "positive").length,
              negative: (raw.reactions as Array<{ type: string }>)
                .filter((r) => r.type === "negative").length,
            },
            userReaction:
              (raw.reactions as Array<{ type: string; user_id: string }>)
                .find((r) => r.user_id === currentUserId)
                ?.type as "positive" | "negative" | null ?? null,
            currentUserId,
          };

          setSubmissions((prev) => [card, ...prev]);
          if (raw.user.id !== currentUserId) {
            toast.info(`${raw.user.username} enviou uma submissão! 🎉`);
          }
        }
      )

      // Status/XP update (e.g. admin approves)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "submissions" },
        (payload) => {
          setSubmissions((prev) =>
            prev.map((s) =>
              s.id === payload.new.id
                ? { ...s, status: payload.new.status, xp_awarded: payload.new.xp_awarded }
                : s
            )
          );
        }
      )

      // Reaction changes — refetch counts for all visible submissions
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reactions" },
        async () => {
          const ids = submissionsRef.current.map((s) => s.id);
          if (!ids.length) return;

          const { data: reactions } = await supabase
            .from("reactions")
            .select("submission_id, type, user_id")
            .in("submission_id", ids);

          if (!reactions) return;

          setSubmissions((prev) =>
            prev.map((s) => {
              const rs = reactions.filter((r) => r.submission_id === s.id);
              return {
                ...s,
                reactions: {
                  positive: rs.filter((r) => r.type === "positive").length,
                  negative: rs.filter((r) => r.type === "negative").length,
                },
                userReaction:
                  rs.find((r) => r.user_id === currentUserId)
                    ?.type as "positive" | "negative" | null ?? null,
              };
            })
          );
        }
      )

      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // currentUserId is stable for the lifetime of the session
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Nenhuma submissão ainda. Seja o primeiro! 🚀
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {submissions.map((s) => (
        <SubmissionCard key={s.id} data={{ ...s, currentUserId }} showChallenge />
      ))}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
            {loadingMore
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando...</>
              : "Carregar mais"}
          </Button>
        </div>
      )}
    </div>
  );
}

export default DashboardFeed;
