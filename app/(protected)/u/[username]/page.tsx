"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { LevelArt } from "@/components/LevelArt";
import { XPBar } from "@/components/XPBar";
import { SignedAvatar } from "@/components/SignedAvatar";
import { SubmissionCard, type SubmissionCardData } from "@/components/SubmissionCard";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { useSignedUrl } from "@/lib/storage/use-signed-url";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Badge } from "@/components/ui/badge";
import { resolveReactionUser } from "@/lib/supabase/resolve-embedded";
import { Loader2, ImageOff, X, FileText, CheckCircle2, Clock, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  xp: number;
  level: number;
  art_tier: number;
  level_xp: number;
  next_xp: number;
}

// ── Status badge config for thumbnails ────────────────────────────────────────

const thumbStatus = {
  approved:  { Icon: CheckCircle2,  bg: "bg-emerald-500" },
  pending:   { Icon: Clock,         bg: "bg-amber-500"   },
  contested: { Icon: AlertTriangle, bg: "bg-orange-500"  },
  rejected:  { Icon: XCircle,       bg: "bg-red-500"     },
  failed:    { Icon: XCircle,       bg: "bg-rose-600"    },
} satisfies Record<SubmissionCardData["status"], { Icon: React.ElementType; bg: string }>;

// ── Thumbnail cell ─────────────────────────────────────────────────────────────

function SubmissionThumb({
  sub,
  onClick,
}: {
  sub: SubmissionCardData;
  onClick: () => void;
}) {
  const signedUrl = useSignedUrl("submissions", sub.photo_url);
  const badge = thumbStatus[sub.status];

  return (
    <button
      onClick={onClick}
      className="relative aspect-square bg-muted overflow-hidden group focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
    >
      {sub.photo_url ? (
        signedUrl ? (
          <Image
            src={signedUrl}
            alt={sub.title ?? "Submissão"}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 33vw, 200px"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 animate-pulse bg-muted-foreground/10" />
        )
      ) : (
        /* Text-only submission */
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 bg-muted">
          <FileText className="h-6 w-6 text-muted-foreground" />
          <p className="text-[10px] text-muted-foreground line-clamp-2 text-center leading-tight">
            {sub.title}
          </p>
        </div>
      )}

      {/* Status badge — top-right corner */}
      {badge && (
        <div className={cn(
          "absolute top-1.5 right-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full shadow-md",
          badge.bg
        )}>
          <badge.Icon className="h-3 w-3 text-white" />
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
        <span className="text-white text-xs font-semibold drop-shadow">Ver post</span>
      </div>
    </button>
  );
}

// ── Post modal ────────────────────────────────────────────────────────────────

function PostModal({
  sub,
  open,
  onClose,
}: {
  sub: SubmissionCardData | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!sub) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm
            data-open:animate-in data-open:fade-in-0
            data-closed:animate-out data-closed:fade-out-0 duration-200"
        />
        <DialogPrimitive.Popup
          aria-label="Post"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none
            data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95
            data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-200"
          onClick={onClose}
        >
          <div
            className="w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <SubmissionCard data={sub} showChallenge />
          </div>

          <button
            onClick={onClose}
            aria-label="Fechar"
            className="absolute top-4 right-4 rounded-full bg-black/60 p-2
              text-white hover:bg-black/80 active:scale-95 transition-all backdrop-blur-sm"
          >
            <X className="h-5 w-5" />
          </button>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();

  const [profile, setProfile]       = useState<Profile | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionCardData[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading]        = useState(true);
  const [notFound, setNotFound]      = useState(false);

  // selected post modal
  const [selected, setSelected]      = useState<SubmissionCardData | null>(null);

  useEffect(() => {
    if (!username) return;
    setLoading(true);

    fetch(`/api/users/${encodeURIComponent(username)}`)
      .then(async (res) => {
        if (res.status === 404) { setNotFound(true); return; }
        if (!res.ok) return;
        const json = await res.json();
        setProfile(json.profile);
        setCurrentUserId(json.currentUserId);
        setSubmissions(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (json.submissions as any[]).map((s) => ({
            id:          s.id,
            photo_url:   s.photo_url,
            photo_url_2: s.photo_url_2 ?? null,
            title:       s.title   ?? null,
            description: s.description ?? null,
            status:      s.status  as SubmissionCardData["status"],
            xp_awarded:  s.xp_awarded,
            created_at:  s.created_at,
            user:        s.user    as SubmissionCardData["user"],
            challenge:   s.challenge ?? null,
            reactions: {
              positive: (s.reactions as Array<{ type: string }>).filter((r) => r.type === "positive").length,
              negative: (s.reactions as Array<{ type: string }>).filter((r) => r.type === "negative").length,
            },
            reactionUsers: (s.reactions as Array<{ type: string; user_id: string; user: unknown }>)
              .map((r) => ({ user_id: r.user_id, ...resolveReactionUser(r.user), type: r.type as "positive" | "negative" })),
            userReaction: (s.reactions as Array<{ type: string; user_id: string }>)
              .find((r) => r.user_id === json.currentUserId)
              ?.type as "positive" | "negative" | null ?? null,
            currentUserId: json.currentUserId,
          }))
        );
      })
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
        <ImageOff className="h-10 w-10" />
        <p>Usuário não encontrado.</p>
      </div>
    );
  }

  const isOwnProfile = currentUserId === profile.id;

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-start gap-6 sm:gap-10">
        {/* Avatar */}
        <div className="relative shrink-0">
          <SignedAvatar
            path={profile.avatar_url}
            fallback={profile.username.slice(0, 2).toUpperCase()}
            className="h-20 w-20 sm:h-24 sm:w-24 ring-2 ring-violet-500/40"
          />
          <div className="absolute -bottom-1 -right-1">
            <LevelArt tier={profile.art_tier} level={profile.level} size={28} />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold truncate">
              {profile.full_name || profile.username}
            </h1>
            {isOwnProfile && (
              <Badge variant="secondary" className="text-xs">Você</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>

          {/* Stats row */}
          <div className="flex gap-5 text-sm">
            <div className="text-center">
              <p className="font-bold">{submissions.length}</p>
              <p className="text-xs text-muted-foreground">posts</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-emerald-400">{profile.xp.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">XP</p>
            </div>
            <div className="text-center">
              <p className="font-bold">{profile.level}</p>
              <p className="text-xs text-muted-foreground">nível</p>
            </div>
          </div>

          <XPBar
            currentXP={profile.level_xp}
            requiredXP={profile.next_xp}
            level={profile.level}
            className="max-w-xs"
          />
        </div>
      </div>

      {/* ── Divider ─────────────────────────────────────────────── */}
      <div className="border-t border-border" />

      {/* ── Posts grid ──────────────────────────────────────────── */}
      {submissions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <ImageOff className="h-8 w-8" />
          <p className="text-sm">Nenhum post ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-0.5">
          {submissions.map((sub) => (
            <SubmissionThumb
              key={sub.id}
              sub={sub}
              onClick={() => setSelected(sub)}
            />
          ))}
        </div>
      )}

      {/* ── Post modal ───────────────────────────────────────────── */}
      <PostModal
        sub={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
