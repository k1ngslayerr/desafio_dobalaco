"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState, useCallback } from "react";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, ImageIcon, ArrowRight, Hash, CameraOff, RotateCcw, CheckCircle2, Gavel, Flame, CalendarClock, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScheduledChallenge {
  id: string;
  title: string;
  description: string;
  xp_reward: number;
  frequency: "daily" | "weekly" | "streak";
  weekly_target: number;
  starts_at: string;
  ends_at: string | null;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  xp_reward: number;
  requires_photo: boolean;
  frequency: "daily" | "weekly" | "streak";
  weekly_target: number;
  quantity_label: string | null;
  xp_per_unit: number | null;
  max_quantity: number | null;
  // For daily: submitted today. For weekly: how many times this week.
  submittedToday: boolean;
  weeklyCount: number;
}

// Photo is optional at schema level — we validate conditionally in onSubmit
const uploadSchema = z.object({
  photo: z
    .custom<FileList>(
      (val) => typeof FileList === "undefined" || val === undefined || val === null || val instanceof FileList,
      "Selecione uma imagem"
    )
    .optional(),
  quantity: z.number().int().min(1, "Informe a quantidade").optional(),
});

type UploadInput = z.infer<typeof uploadSchema>;

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledChallenge[]>([]);
  const [currentPenalty, setCurrentPenalty] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Challenge | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors },
  } = useForm<UploadInput>({ resolver: zodResolver(uploadSchema) });

  const photoFile = watch("photo");
  const quantityValue = watch("quantity");

  useEffect(() => {
    if (photoFile?.[0]) {
      const url = URL.createObjectURL(photoFile[0]);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview(null);
  }, [photoFile]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // All data fetched server-side so httpOnly session cookies are read correctly.
      // The browser Supabase client can't read httpOnly cookies, so direct queries
      // would fail silently (getUser returns null, early return, no data shown).
      const res = await fetch("/api/challenges");
      if (!res.ok) { return; }
      const json = await res.json();

      const { challenges: chData, submissions: subData, currentPenalty: penalty, scheduled: sched, todayStr } = json;

      setCurrentPenalty(penalty ?? null);
      setScheduled(sched ?? []);

      const weekSubs = (subData as { challenge_id: string; submitted_date: string }[]) ?? [];
      const todaySet = new Set(weekSubs.filter((s) => s.submitted_date === todayStr).map((s) => s.challenge_id));
      const weeklyCountMap: Record<string, number> = {};
      for (const s of weekSubs) {
        weeklyCountMap[s.challenge_id] = (weeklyCountMap[s.challenge_id] ?? 0) + 1;
      }

      setChallenges(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((chData ?? []) as any[]).map((c) => ({
          ...c,
          submittedToday: todaySet.has(c.id),
          weeklyCount: weeklyCountMap[c.id] ?? 0,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Estimate XP for quantifiable challenges
  const estimatedXP = (() => {
    if (!selected?.xp_per_unit || !quantityValue) return null;
    return Math.min(quantityValue * selected.xp_per_unit, selected.xp_reward);
  })();

  async function onSubmit(values: UploadInput) {
    if (!selected) return;

    // Manual conditional photo validation
    if (selected.requires_photo && (!values.photo?.[0])) {
      setError("photo", { message: "Selecione uma foto" });
      return;
    }
    if (values.photo?.[0]) {
      const f = values.photo[0];
      if (f.size > 5 * 1024 * 1024) { setError("photo", { message: "Imagem deve ter no máximo 5 MB" }); return; }
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
        setError("photo", { message: "Formato inválido. Use JPEG, PNG ou WebP" });
        return;
      }
    }
    // Quantity validation
    if (selected.quantity_label && !values.quantity) {
      setError("quantity", { message: `Informe a quantidade de ${selected.quantity_label}` });
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("challenge_id", selected.id);
      if (values.photo?.[0]) form.append("photo", values.photo[0]);
      if (values.quantity) form.append("quantity", String(values.quantity));

      const res = await fetch("/api/submissions", { method: "POST", body: form });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Erro ao enviar");
        return;
      }

      const xpMsg = estimatedXP
        ? `+${estimatedXP} XP (${values.quantity} ${selected.quantity_label})`
        : `+${selected.xp_reward} XP`;
      toast.success(`Check-in registrado! ${xpMsg} ganhos 🎉`);
      setSelected(null);
      reset();
      setPreview(null);
      load();
    } finally {
      setUploading(false);
    }
  }

  function daysUntil(dateStr: string): number {
    const target = new Date(dateStr + "T00:00:00");
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - now.getTime()) / 86400000);
  }

  function fmtDate(dateStr: string): string {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y.slice(2)}`;
  }

  function openModal(ch: Challenge) {
    setSelected(ch);
    reset();
    setPreview(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Desafios</h1>
        <p className="text-muted-foreground mt-1">Complete desafios para ganhar XP e subir de nível.</p>
      </div>

      {/* ── Penalty banner ───────────────────────────────────── */}
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

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : challenges.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6">Nenhum desafio ativo no momento. Confira a agenda abaixo.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {challenges.map((ch) => {
            // Determine if the user has "done enough" for this challenge today/this week
            const isWeekly = ch.frequency === "weekly";
            const weeklyDone = isWeekly && ch.weeklyCount >= ch.weekly_target;
            const dailyDone = !isWeekly && ch.submittedToday;
            const isDone = isWeekly ? weeklyDone : dailyDone;

            return (
            <Card
              key={ch.id}
              className={isDone ? "opacity-60" : "hover:border-violet-500/50 transition-colors"}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm line-clamp-2">{ch.title}</CardTitle>
                  <Badge
                    variant="outline"
                    className="shrink-0 text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                  >
                    +{ch.xp_reward} XP
                  </Badge>
                </div>
                <CardDescription className="line-clamp-3 text-xs">{ch.description}</CardDescription>
                {/* Indicator badges */}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {isWeekly && (
                    <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/30 py-0">
                      <RotateCcw className="h-2.5 w-2.5 mr-1" />{ch.weeklyCount}/{ch.weekly_target}x semana
                    </Badge>
                  )}
                  {ch.frequency === "streak" && (
                    <Badge variant="outline" className="text-xs text-orange-400 border-orange-500/30 py-0">
                      <Flame className="h-2.5 w-2.5 mr-1" />Sequência
                    </Badge>
                  )}
                  {!ch.requires_photo && (
                    <Badge variant="outline" className="text-xs text-sky-400 border-sky-500/30 py-0">
                      <CameraOff className="h-2.5 w-2.5 mr-1" />Sem foto
                    </Badge>
                  )}
                  {ch.quantity_label && (
                    <Badge variant="outline" className="text-xs text-violet-400 border-violet-500/30 py-0">
                      <Hash className="h-2.5 w-2.5 mr-1" />{ch.quantity_label}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 flex gap-2">
                {isDone ? (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    {isWeekly ? "Meta da semana atingida" : "Enviado hoje ✓"}
                  </Badge>
                ) : (
                  <Button size="sm" className="flex-1" onClick={() => openModal(ch)}>
                    <Upload className="mr-1.5 h-3.5 w-3.5" /> Enviar
                  </Button>
                )}
                <Link href={`/challenges/${ch.id}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      {/* ── Agenda ───────────────────────────────────────────── */}
      {!loading && scheduled.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-violet-400" />
            <h2 className="text-lg font-semibold">Agenda</h2>
            <Badge variant="outline" className="text-xs text-muted-foreground">{scheduled.length}</Badge>
          </div>
          <p className="text-sm text-muted-foreground -mt-1">Desafios programados para começar em breve.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {scheduled.map((ch) => {
              const days = daysUntil(ch.starts_at);
              return (
                <Card key={ch.id} className="opacity-70 border-dashed">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm line-clamp-2 text-muted-foreground">{ch.title}</CardTitle>
                      <Badge variant="outline" className="shrink-0 text-muted-foreground border-border">
                        +{ch.xp_reward} XP
                      </Badge>
                    </div>
                    <CardDescription className="line-clamp-2 text-xs">{ch.description}</CardDescription>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <Badge variant="outline" className="text-xs text-violet-400 border-violet-500/30 py-0 gap-1">
                        <CalendarClock className="h-2.5 w-2.5" />
                        {days === 1 ? "Amanhã" : `Em ${days} dias`} · {fmtDate(ch.starts_at)}
                      </Badge>
                      {ch.ends_at && (
                        <Badge variant="outline" className="text-xs text-muted-foreground py-0">
                          até {fmtDate(ch.ends_at)}
                        </Badge>
                      )}
                      {ch.frequency === "weekly" && (
                        <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/30 py-0">
                          <RotateCcw className="h-2.5 w-2.5 mr-1" />{ch.weekly_target}x/sem
                        </Badge>
                      )}
                      {ch.frequency === "streak" && (
                        <Badge variant="outline" className="text-xs text-orange-400 border-orange-500/30 py-0">
                          <Flame className="h-2.5 w-2.5 mr-1" />Sequência
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <Badge variant="secondary" className="text-xs gap-1 text-muted-foreground">
                      <Lock className="h-3 w-3" /> Ainda não disponível
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Submission modal ──────────────────────────────────── */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enviar evidência</DialogTitle>
            <DialogDescription>{selected?.title}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Photo upload — shown if requires_photo OR if user wants to attach a photo anyway */}
            {selected?.requires_photo ? (
              <>
                <div
                  className="relative flex h-48 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 hover:border-violet-500/50 transition-colors overflow-hidden"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {preview ? (
                    <Image src={preview} alt="Preview" fill className="object-cover" />
                  ) : (
                    <>
                      <ImageIcon className="h-10 w-10 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Clique para selecionar</p>
                      <p className="text-xs text-muted-foreground">JPEG, PNG, WebP · máx 5 MB</p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  {...register("photo")}
                  ref={(el) => {
                    register("photo").ref(el);
                    (fileInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
                  }}
                />
                {errors.photo && (
                  <p className="text-xs text-destructive">{errors.photo.message as string}</p>
                )}
              </>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-sky-500/30 bg-sky-500/5 px-4 py-3">
                <CameraOff className="h-5 w-5 text-sky-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-sky-400">Sem foto necessária</p>
                  <p className="text-xs text-muted-foreground">Este desafio não requer evidência fotográfica</p>
                </div>
              </div>
            )}

            {/* Quantity input — shown for quantifiable challenges */}
            {selected?.quantity_label && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Hash className="h-4 w-4 text-violet-400" />
                  Quantidade de {selected.quantity_label}
                  {selected.max_quantity && (
                    <span className="text-xs text-muted-foreground font-normal">(máx {selected.max_quantity})</span>
                  )}
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={selected.max_quantity ?? undefined}
                  placeholder={`Quantas ${selected.quantity_label}?`}
                  {...register("quantity", { valueAsNumber: true })}
                />
                {errors.quantity && (
                  <p className="text-xs text-destructive">{errors.quantity.message as string}</p>
                )}
                {/* XP estimate */}
                {selected.xp_per_unit && (
                  <p className="text-xs text-muted-foreground">
                    {estimatedXP !== null
                      ? <span className="text-emerald-400 font-medium">+{estimatedXP} XP</span>
                      : `${selected.xp_per_unit} XP por ${selected.quantity_label.replace(/s$/, "")} · máx ${selected.xp_reward} XP`}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setSelected(null)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={uploading || (selected?.requires_photo && !preview)}
              >
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Enviar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
