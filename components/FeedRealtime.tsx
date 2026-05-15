"use client";

/**
 * FeedRealtime – subscribes to a Supabase Realtime channel for a given
 * challenge and prepends new submissions to the feed as they arrive.
 */

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SubmissionCard, type SubmissionCardData } from "@/components/SubmissionCard";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface FeedRealtimeProps {
  challengeId: string;
  initialSubmissions: SubmissionCardData[];
  currentUserId: string | null;
}

export function FeedRealtime({
  challengeId,
  initialSubmissions,
  currentUserId,
}: FeedRealtimeProps) {
  const [submissions, setSubmissions] = useState<SubmissionCardData[]>(initialSubmissions);
  const [connected, setConnected] = useState(false);
  const supabase = useRef(createClient()).current;

  useEffect(() => {
    // Keep initial submissions in sync if parent re-renders
    setSubmissions(initialSubmissions);
  }, [initialSubmissions]);

  useEffect(() => {
    const channel = supabase
      .channel(`challenge:${challengeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "submissions",
          filter: `challenge_id=eq.${challengeId}`,
        },
        async (payload) => {
          // Fetch full submission with user + reactions
          const { data } = await supabase
            .from("submissions")
            .select(
              `*, user:users(id, username, avatar_url),
               reactions(type, user_id)`
            )
            .eq("id", payload.new.id)
            .single();

          if (!data) return;

          const newCard: SubmissionCardData = {
            id: data.id,
            photo_url: data.photo_url,
            title: data.title as string | null ?? null,
            description: data.description as string | null ?? null,
            status: data.status,
            xp_awarded: data.xp_awarded,
            created_at: data.created_at,
            user: data.user as SubmissionCardData["user"],
            reactions: {
              positive: (data.reactions as Array<{ type: string }>).filter(
                (r) => r.type === "positive"
              ).length,
              negative: (data.reactions as Array<{ type: string }>).filter(
                (r) => r.type === "negative"
              ).length,
            },
            userReaction:
              (data.reactions as Array<{ type: string; user_id: string }>).find(
                (r) => r.user_id === currentUserId
              )?.type as "positive" | "negative" | null ?? null,
            currentUserId,
          };

          setSubmissions((prev) => [newCard, ...prev]);
          toast.info("Nova submissão chegou!");
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "submissions",
          filter: `challenge_id=eq.${challengeId}`,
        },
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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reactions",
        },
        async () => {
          // Refetch reaction counts for all visible submissions
          const ids = submissions.map((s) => s.id);
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
                  rs.find((r) => r.user_id === currentUserId)?.type as
                    | "positive"
                    | "negative"
                    | null ?? null,
              };
            })
          );
        }
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId, currentUserId]);

  return (
    <div className="space-y-4">
      {/* Realtime indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {connected ? (
          <>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Ao vivo
          </>
        ) : (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            Conectando…
          </>
        )}
      </div>

      {submissions.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">
          Nenhuma submissão ainda. Seja o primeiro!
        </p>
      ) : (
        submissions.map((s) => (
          <SubmissionCard key={s.id} data={{ ...s, currentUserId }} />
        ))
      )}
    </div>
  );
}

export default FeedRealtime;
