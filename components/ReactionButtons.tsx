"use client";

import { useState, useTransition } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ReactionButtonsProps {
  submissionId: string;
  positiveCount: number;
  negativeCount: number;
  /** The current user's existing reaction type, if any */
  userReaction: "positive" | "negative" | null;
  disabled?: boolean;
}

export function ReactionButtons({
  submissionId,
  positiveCount: initialPositive,
  negativeCount: initialNegative,
  userReaction: initialReaction,
  disabled = false,
}: ReactionButtonsProps) {
  const [userReaction, setUserReaction] = useState(initialReaction);
  const [positive, setPositive] = useState(initialPositive);
  const [negative, setNegative] = useState(initialNegative);
  const [isPending, startTransition] = useTransition();

  async function react(type: "positive" | "negative") {
    // Optimistic update
    const prev = { userReaction, positive, negative };

    if (userReaction === type) {
      // Remove reaction
      setUserReaction(null);
      if (type === "positive") setPositive((n) => Math.max(0, n - 1));
      else setNegative((n) => Math.max(0, n - 1));

      startTransition(async () => {
        const res = await fetch(
          `/api/reactions?submission_id=${submissionId}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          setUserReaction(prev.userReaction);
          setPositive(prev.positive);
          setNegative(prev.negative);
          toast.error("Erro ao remover reação");
        }
      });
    } else {
      // Add or switch reaction
      if (userReaction === "positive") setPositive((n) => Math.max(0, n - 1));
      if (userReaction === "negative") setNegative((n) => Math.max(0, n - 1));
      if (type === "positive") setPositive((n) => n + 1);
      else setNegative((n) => n + 1);
      setUserReaction(type);

      startTransition(async () => {
        const res = await fetch("/api/reactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submission_id: submissionId, type }),
        });
        if (!res.ok) {
          setUserReaction(prev.userReaction);
          setPositive(prev.positive);
          setNegative(prev.negative);
          toast.error("Erro ao salvar reação");
        }
      });
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled || isPending}
        onClick={() => react("positive")}
        className={cn(
          "gap-1 transition-colors",
          userReaction === "positive" && "text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20"
        )}
        aria-label="Reação positiva"
      >
        <ThumbsUp className="h-4 w-4" />
        <span className="tabular-nums">{positive}</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        disabled={disabled || isPending}
        onClick={() => react("negative")}
        className={cn(
          "gap-1 transition-colors",
          userReaction === "negative" && "text-red-400 bg-red-400/10 hover:bg-red-400/20"
        )}
        aria-label="Reação negativa"
      >
        <ThumbsDown className="h-4 w-4" />
        <span className="tabular-nums">{negative}</span>
      </Button>
    </div>
  );
}

export default ReactionButtons;
