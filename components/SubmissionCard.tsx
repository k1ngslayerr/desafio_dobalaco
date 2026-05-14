"use client";

import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Clock, XCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ReactionButtons } from "@/components/ReactionButtons";
import { useSignedUrl } from "@/lib/storage/use-signed-url";
import { cn } from "@/lib/utils";

export interface SubmissionCardData {
  id: string;
  photo_url: string;
  status: "pending" | "approved" | "contested" | "rejected";
  xp_awarded: number;
  created_at: string;
  user: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
  challenge?: {
    title: string;
    xp_reward: number;
  };
  reactions: {
    positive: number;
    negative: number;
  };
  userReaction: "positive" | "negative" | null;
  currentUserId: string | null;
}

const statusConfig = {
  pending:   { label: "Pendente",   icon: Clock,          color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  approved:  { label: "Aprovado",   icon: CheckCircle2,   color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  contested: { label: "Contestado", icon: AlertTriangle,  color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  rejected:  { label: "Rejeitado",  icon: XCircle,        color: "bg-red-500/10 text-red-400 border-red-500/20" },
};

interface SubmissionCardProps {
  data: SubmissionCardData;
  showChallenge?: boolean;
}

export function SubmissionCard({ data, showChallenge = false }: SubmissionCardProps) {
  const cfg = statusConfig[data.status];
  const StatusIcon = cfg.icon;
  const isApproved = data.status === "approved";

  // Private bucket: generate signed URLs on demand
  const signedPhotoUrl  = useSignedUrl("submissions", data.photo_url);
  const signedAvatarUrl = useSignedUrl("avatars", data.user.avatar_url);

  return (
    <Card className={cn(
      "overflow-hidden transition-all",
      isApproved && "ring-1 ring-emerald-500/30"
    )}>
      <CardHeader className="flex flex-row items-center gap-3 p-4 pb-2">
        {/* User avatar – signed URL, falls back to initials while loading */}
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarImage src={signedAvatarUrl ?? undefined} alt={data.user.username} />
          <AvatarFallback>{data.user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>

        <div className="flex flex-1 flex-col gap-0.5 min-w-0">
          <span className="font-semibold text-sm truncate">{data.user.username}</span>
          {showChallenge && data.challenge && (
            <span className="text-xs text-muted-foreground truncate">
              {data.challenge.title}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(data.created_at), { addSuffix: true, locale: ptBR })}
          </span>
        </div>

        {/* Status badge */}
        <Badge variant="outline" className={cn("gap-1 shrink-0 text-xs", cfg.color)}>
          <StatusIcon className="h-3 w-3" />
          {cfg.label}
        </Badge>
      </CardHeader>

      <CardContent className="p-0">
        {/* Photo – signed URL; skeleton shown while URL is being fetched */}
        <div className="relative w-full aspect-video bg-muted">
          {signedPhotoUrl ? (
            <Image
              src={signedPhotoUrl}
              alt={`Submission de ${data.user.username}`}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 640px"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 animate-pulse bg-muted" />
          )}
          {isApproved && (
            <div className="absolute inset-0 border-2 border-emerald-500/40 rounded pointer-events-none" />
          )}
        </div>

        {/* Footer: reactions + XP badge */}
        <div className="flex items-center justify-between px-4 py-2">
          <ReactionButtons
            submissionId={data.id}
            positiveCount={data.reactions.positive}
            negativeCount={data.reactions.negative}
            userReaction={data.userReaction}
            disabled={!data.currentUserId || data.currentUserId === data.user.id}
          />

          {data.xp_awarded > 0 && (
            <span className="text-xs font-semibold text-emerald-400">
              +{data.xp_awarded} XP
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default SubmissionCard;
