"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Clock, XCircle, AlertTriangle, Pencil, X, ImageIcon, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ReactionButtons } from "@/components/ReactionButtons";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { useSignedUrl } from "@/lib/storage/use-signed-url";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface ReactionUser {
  user_id: string;
  username: string;
  avatar_url: string | null;
  type: "positive" | "negative";
}

export interface SubmissionCardData {
  id: string;
  photo_url: string | null;
  title?: string | null;
  description?: string | null;
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
  reactionUsers?: ReactionUser[];
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

function formatReactors(users: ReactionUser[], type: "positive" | "negative"): string | null {
  // Guard against empty usernames (can happen if the join resolved unexpectedly)
  const list = users.filter((u) => u.type === type && u.username);
  if (!list.length) return null;
  if (list.length === 1) return `@${list[0].username}`;
  if (list.length === 2) return `@${list[0].username} e @${list[1].username}`;
  return `@${list[0].username}, @${list[1].username} e mais ${list.length - 2}`;
}

export function SubmissionCard({ data, showChallenge = false }: SubmissionCardProps) {
  const isOwner = !!(data.currentUserId && data.currentUserId === data.user.id);

  // Local editable state — updated optimistically after a successful PATCH
  const [localTitle,       setLocalTitle]       = useState(data.title ?? null);
  const [localDescription, setLocalDescription] = useState(data.description ?? null);
  const [localPhotoUrl,    setLocalPhotoUrl]     = useState(data.photo_url ?? null);

  const cfg = statusConfig[data.status];
  const StatusIcon = cfg.icon;
  const isApproved = data.status === "approved";
  const hasPhoto = !!localPhotoUrl;
  const hasText  = !!(localTitle || localDescription);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [reactorsOpen, setReactorsOpen] = useState(false);
  const [editOpen,     setEditOpen]     = useState(false);

  // Edit form state
  const [editTitle,       setEditTitle]       = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPreview,     setEditPreview]     = useState<string | null>(null);
  const [editFile,        setEditFile]        = useState<File | null>(null);
  const [saving,          setSaving]          = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openEdit() {
    setEditTitle(localTitle ?? "");
    setEditDescription(localDescription ?? "");
    setEditPreview(null);
    setEditFile(null);
    setEditOpen(true);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setEditFile(f);
    if (f) {
      const url = URL.createObjectURL(f);
      setEditPreview(url);
    } else {
      setEditPreview(null);
    }
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const form = new FormData();
      form.append("title",       editTitle.trim());
      form.append("description", editDescription.trim());
      if (editFile) form.append("photo", editFile);

      const res = await fetch(`/api/submissions/${data.id}`, { method: "PATCH", body: form });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Erro ao salvar"); return; }

      // Optimistic update — reflect changes immediately without a full reload
      setLocalTitle(json.submission.title ?? null);
      setLocalDescription(json.submission.description ?? null);
      if (json.submission.photo_url) setLocalPhotoUrl(json.submission.photo_url);
      setEditOpen(false);
      toast.success("Post atualizado!");
    } finally {
      setSaving(false);
    }
  }

  // Private bucket: generate signed URLs on demand
  const signedPhotoUrl  = useSignedUrl("submissions", localPhotoUrl);
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
          <span className="text-xs text-muted-foreground" suppressHydrationWarning>
            {formatDistanceToNow(new Date(data.created_at), { addSuffix: true, locale: ptBR })}
          </span>
        </div>

        {/* Edit button — owner only */}
        {isOwner && (
          <button
            onClick={openEdit}
            aria-label="Editar post"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Status badge */}
        <Badge variant="outline" className={cn("gap-1 shrink-0 text-xs", cfg.color)}>
          <StatusIcon className="h-3 w-3" />
          {cfg.label}
        </Badge>
      </CardHeader>

      <CardContent className="p-0">
        {/* Photo – only rendered when a photo exists */}
        {hasPhoto && (
          <>
            <div
              className={cn(
                "relative w-full aspect-square sm:aspect-video bg-muted",
                signedPhotoUrl && "cursor-zoom-in"
              )}
              onClick={() => signedPhotoUrl && setLightboxOpen(true)}
            >
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

            {signedPhotoUrl && (
              <PhotoLightbox
                src={signedPhotoUrl}
                alt={`Submission de ${data.user.username}`}
                open={lightboxOpen}
                onClose={() => setLightboxOpen(false)}
              />
            )}
          </>
        )}

        {/* Title and description */}
        {hasText && (
          <div className={cn(
            "px-4 py-3 space-y-1",
            hasPhoto ? "border-t border-border" : "bg-muted/20 min-h-[72px]"
          )}>
            {localTitle && (
              <p className="font-semibold text-sm leading-snug">{localTitle}</p>
            )}
            {localDescription && (
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{localDescription}</p>
            )}
          </div>
        )}

        {/* Footer: reactions + XP badge */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border/50">
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

        {/* Who reacted — click to open full list */}
        {data.reactionUsers && data.reactionUsers.length > 0 && (() => {
          const pos = formatReactors(data.reactionUsers, "positive");
          const neg = formatReactors(data.reactionUsers, "negative");
          const hasMore = data.reactionUsers.some((_, i) => i >= 2);
          return (
            <>
              <button
                onClick={() => setReactorsOpen(true)}
                className="w-full px-4 pb-3 text-left space-y-0.5 group"
              >
                {pos && (
                  <p className="text-xs text-muted-foreground group-hover:text-foreground/70 transition-colors">
                    <span className="mr-1">👍</span>
                    <span className="font-medium text-foreground/80">{pos}</span>
                    {hasMore && <span className="text-violet-400 ml-1 text-[10px]">ver todos</span>}
                  </p>
                )}
                {neg && (
                  <p className="text-xs text-muted-foreground group-hover:text-foreground/70 transition-colors">
                    <span className="mr-1">👎</span>
                    <span className="font-medium text-foreground/80">{neg}</span>
                  </p>
                )}
              </button>

              {/* Full reactors list modal */}
              <DialogPrimitive.Root open={reactorsOpen} onOpenChange={(o) => { if (!o) setReactorsOpen(false); }}>
                <DialogPrimitive.Portal>
                  <DialogPrimitive.Backdrop
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm
                      data-open:animate-in data-open:fade-in-0
                      data-closed:animate-out data-closed:fade-out-0 duration-150"
                  />
                  <DialogPrimitive.Popup
                    className="fixed top-1/2 left-1/2 z-50 w-full max-w-xs -translate-x-1/2 -translate-y-1/2
                      rounded-xl bg-popover ring-1 ring-foreground/10 shadow-xl outline-none
                      data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95
                      data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-150"
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                      <p className="font-semibold text-sm">Reações</p>
                      <DialogPrimitive.Close
                        className="rounded-full p-1 hover:bg-muted transition-colors"
                        aria-label="Fechar"
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </DialogPrimitive.Close>
                    </div>

                    <div className="divide-y divide-border max-h-72 overflow-y-auto">
                      {(["positive", "negative"] as const).map((type) => {
                        const group = data.reactionUsers!.filter((u) => u.type === type && u.username);
                        if (!group.length) return null;
                        return (
                          <div key={type} className="px-4 py-2">
                            <p className="text-xs text-muted-foreground mb-2">
                              {type === "positive" ? "👍 Curtidas" : "👎 Não curtidas"}
                            </p>
                            <ul className="space-y-2">
                              {group.map((u) => (
                                <li key={u.user_id} className="flex items-center gap-2 text-sm">
                                  <Avatar className="h-6 w-6 shrink-0">
                                    <AvatarFallback className="text-[10px]">
                                      {u.username.slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="font-medium">@{u.username}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </DialogPrimitive.Popup>
                </DialogPrimitive.Portal>
              </DialogPrimitive.Root>
            </>
          );
        })()}
      </CardContent>

      {/* ── Edit modal (owner only) ───────────────────────────────── */}
      {isOwner && (
        <DialogPrimitive.Root open={editOpen} onOpenChange={(o) => { if (!o) setEditOpen(false); }}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm
                data-open:animate-in data-open:fade-in-0
                data-closed:animate-out data-closed:fade-out-0 duration-150"
            />
            <DialogPrimitive.Popup
              className="fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2
                rounded-xl bg-popover ring-1 ring-foreground/10 shadow-xl outline-none
                max-h-[90vh] overflow-y-auto
                data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95
                data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-150"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <p className="font-semibold text-sm">Editar post</p>
                <DialogPrimitive.Close
                  className="rounded-full p-1 hover:bg-muted transition-colors"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </DialogPrimitive.Close>
              </div>

              <div className="p-4 space-y-4">
                {/* Photo replacement (only when post has a photo) */}
                {hasPhoto && (
                  <div className="space-y-2">
                    <Label className="text-xs">Foto</Label>
                    <div
                      className="relative h-36 w-full cursor-pointer rounded-lg border-2 border-dashed border-border bg-muted/30 overflow-hidden hover:border-violet-500/50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {editPreview ? (
                        <Image src={editPreview} alt="Preview" fill className="object-cover" />
                      ) : signedPhotoUrl ? (
                        <>
                          <Image src={signedPhotoUrl} alt="Foto atual" fill className="object-cover opacity-60" unoptimized />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs text-white/80 bg-black/40 px-2 py-1 rounded">Clique para trocar</span>
                          </div>
                        </>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center gap-2 text-muted-foreground">
                          <ImageIcon className="h-5 w-5" />
                          <span className="text-xs">Selecionar foto</span>
                        </div>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    {editFile && (
                      <p className="text-[11px] text-muted-foreground">{editFile.name}</p>
                    )}
                  </div>
                )}

                {/* Title */}
                <div className="space-y-1.5">
                  <Label htmlFor="edit-title" className="text-xs">
                    Título <span className="text-muted-foreground font-normal">({editTitle.length}/120)</span>
                  </Label>
                  <Input
                    id="edit-title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value.slice(0, 120))}
                    placeholder="Título do post"
                    maxLength={120}
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label htmlFor="edit-desc" className="text-xs">
                    Descrição <span className="text-muted-foreground font-normal">({editDescription.length}/500)</span>
                  </Label>
                  <Textarea
                    id="edit-desc"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value.slice(0, 500))}
                    placeholder="Descreva o que você fez..."
                    rows={3}
                    maxLength={500}
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setEditOpen(false)}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={saveEdit}
                    disabled={saving}
                  >
                    {saving
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando…</>
                      : "Salvar"}
                  </Button>
                </div>
              </div>
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      )}
    </Card>
  );
}

export default SubmissionCard;
