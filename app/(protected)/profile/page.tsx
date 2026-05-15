"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileSchema, type ProfileInput } from "@/lib/validators";
import { LevelArt } from "@/components/LevelArt";
import { XPBar } from "@/components/XPBar";
import { SubmissionCard, type SubmissionCardData } from "@/components/SubmissionCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Camera, Loader2, Save } from "lucide-react";
import Image from "next/image";
import { useSignedUrl } from "@/lib/storage/use-signed-url";

interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  xp: number;
  level: number;
  art_tier: number;
  next_xp: number;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionCardData[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Converte o path do bucket privado para signed URL
  const signedAvatarUrl = useSignedUrl("avatars", profile?.avatar_url);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/profile");
      if (!res.ok) return;
      const json = await res.json();
      const { profile: p, submissions: subs, userId } = json;

      setProfile(p);
      reset({ username: p.username, full_name: p.full_name ?? "" });

      setSubmissions(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (subs as any[]).map((s) => ({
          id: s.id,
          photo_url: s.photo_url,
          status: s.status as SubmissionCardData["status"],
          xp_awarded: s.xp_awarded,
          created_at: s.created_at,
          user: s.user as unknown as SubmissionCardData["user"],
          challenge: s.challenge as unknown as SubmissionCardData["challenge"],
          reactions: {
            positive: (s.reactions as Array<{ type: string }>).filter((r) => r.type === "positive").length,
            negative: (s.reactions as Array<{ type: string }>).filter((r) => r.type === "negative").length,
          },
          userReaction: (s.reactions as Array<{ type: string; user_id: string }>)
            .find((r) => r.user_id === userId)?.type as "positive" | "negative" | null ?? null,
          currentUserId: userId,
        }))
      );
    }
    load();
  }, [reset]);

  async function onSave(values: ProfileInput) {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Erro ao salvar"); return; }
      setProfile((prev) => prev ? { ...prev, ...json.user } : prev);
      toast.success("Perfil atualizado!");
    } finally {
      setSaving(false);
    }
  }

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side checks
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem deve ter no máximo 5 MB"); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Use JPEG, PNG ou WebP"); return;
    }

    setAvatarPreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const form = new FormData();
      form.append("avatar", file);
      const res = await fetch("/api/profile", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Erro no upload"); setAvatarPreview(null); return; }
      setProfile((prev) => prev ? { ...prev, avatar_url: json.avatar_url } : prev);
      toast.success("Avatar atualizado!");
    } finally {
      setUploading(false);
    }
  }

  if (!profile) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Meu Perfil</h1>

      {/* ── Profile hero ─────────────────────────────────────── */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Avatar with upload */}
            <div className="relative shrink-0">
              <div className="relative h-24 w-24 rounded-full overflow-hidden bg-muted">
                {avatarPreview || signedAvatarUrl ? (
                  <Image src={avatarPreview || signedAvatarUrl!} alt="Avatar" fill className="object-cover" unoptimized />
                ) : (
                  <div className="flex h-full items-center justify-center text-3xl font-bold text-muted-foreground">
                    {profile.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  </div>
                )}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow hover:bg-primary/90 transition-colors"
                aria-label="Alterar avatar"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onAvatarChange} />
            </div>

            <div className="flex-1 text-center sm:text-left space-y-3">
              <div>
                <p className="text-xl font-bold">{profile.full_name || profile.username}</p>
                <p className="text-sm text-muted-foreground">@{profile.username}</p>
              </div>
              <div className="flex items-center gap-3 justify-center sm:justify-start">
                <LevelArt tier={profile.art_tier} level={profile.level} size={48} />
                <div>
                  <p className="text-sm font-semibold">Nível {profile.level}</p>
                  <p className="text-xs text-emerald-400">{profile.xp.toLocaleString()} XP</p>
                </div>
              </div>
              <XPBar currentXP={profile.xp} requiredXP={profile.next_xp} level={profile.level} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Edit form ─────────────────────────────────────────── */}
      <Card>
        <CardHeader><CardTitle>Editar informações</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSave)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" {...register("username")} />
              {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Nome de exibição</Label>
              <Input id="full_name" {...register("full_name")} />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Completed challenges ─────────────────────────────── */}
      {submissions.length > 0 && (
        <section className="space-y-4">
          <Separator />
          <h2 className="text-lg font-semibold">Desafios completados</h2>
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
