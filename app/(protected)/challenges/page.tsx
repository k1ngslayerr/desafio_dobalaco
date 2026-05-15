"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState, useCallback } from "react";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, ImageIcon, ArrowRight, Hash, CameraOff, RotateCcw, CheckCircle2, Gavel, Flame, CalendarClock, Lock, ChevronLeft, ChevronRight, Eye } from "lucide-react";
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
  title: z.string().max(120, "Máximo 120 caracteres").optional(),
  description: z.string().max(500, "Máximo 500 caracteres").optional(),
});

type UploadInput = z.infer<typeof uploadSchema>;

export default function ChallengesPage() {
  const router = useRouter();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledChallenge[]>([]);
  const [currentPenalty, setCurrentPenalty] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Challenge | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Agenda calendar state ─────────────────────────────────
  const [agendaDay, setAgendaDay] = useState<string | null>(null);
  const [agendaWeekStart, setAgendaWeekStart] = useState<string | null>(null);

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
  const titleValue = watch("title");
  const descriptionValue = watch("description");

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

    let hasError = false;

    // Photo validation
    if (selected.requires_photo && !values.photo?.[0]) {
      setError("photo", { message: "Selecione uma foto" });
      hasError = true;
    }
    if (values.photo?.[0]) {
      const f = values.photo[0];
      if (f.size > 5 * 1024 * 1024) { setError("photo", { message: "Imagem deve ter no máximo 5 MB" }); hasError = true; }
      else if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
        setError("photo", { message: "Formato inválido. Use JPEG, PNG ou WebP" });
        hasError = true;
      }
    }
    // When no photo required, title and description are required
    if (!selected.requires_photo) {
      if (!values.title?.trim()) {
        setError("title", { message: "Título é obrigatório para este desafio" });
        hasError = true;
      }
      if (!values.description?.trim()) {
        setError("description", { message: "Descrição é obrigatória para este desafio" });
        hasError = true;
      }
    }
    // Quantity validation
    if (selected.quantity_label && !values.quantity) {
      setError("quantity", { message: `Informe a quantidade de ${selected.quantity_label}` });
      hasError = true;
    }

    if (hasError) return;

    setUploading(true);
    const challengeId = selected.id;
    try {
      const form = new FormData();
      form.append("challenge_id", challengeId);
      if (values.photo?.[0]) form.append("photo", values.photo[0]);
      if (values.quantity) form.append("quantity", String(values.quantity));
      if (values.title?.trim()) form.append("title", values.title.trim());
      if (values.description?.trim()) form.append("description", values.description.trim());

      const res = await fetch("/api/submissions", { method: "POST", body: form });
      const json = await res.json();

      if (!res.ok) {
        const msg = json.error ?? "Erro ao enviar";
        const detail = json.detail ? ` (${json.detail})` : "";
        toast.error(msg + detail);
        return;
      }

      const xpMsg = estimatedXP
        ? `+${estimatedXP} XP (${values.quantity} ${selected.quantity_label})`
        : `+${selected.xp_reward} XP`;
      toast.success(`Check-in registrado! ${xpMsg} ganhos 🎉`);
      setSelected(null);
      reset();
      setPreview(null);
      // Navigate to the challenge feed so the user can see all submissions and react
      router.push(`/challenges/${challengeId}`);
    } finally {
      setUploading(false);
    }
  }

  // ── Agenda helpers ────────────────────────────────────────
  function addDays(dateStr: string, n: number): string {
    const d = new Date(dateStr + "T12:00:00");
    d.setDate(d.getDate() + n);
    return d.toISOString().split("T")[0];
  }

  function getMonday(dateStr: string): string {
    const d = new Date(dateStr + "T12:00:00");
    const dow = d.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split("T")[0];
  }

  // Initialize agenda to the week of the first scheduled challenge
  useEffect(() => {
    if (scheduled.length > 0 && !agendaDay) {
      const first = scheduled[0].starts_at;
      setAgendaDay(first);
      setAgendaWeekStart(getMonday(first));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduled]);

  const DAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const weekDays = agendaWeekStart
    ? Array.from({ length: 7 }, (_, i) => addDays(agendaWeekStart, i))
    : [];

  // Min/max date range across all scheduled challenges
  const agendaMin = scheduled.length > 0
    ? scheduled.reduce((m, c) => c.starts_at < m ? c.starts_at : m, scheduled[0].starts_at)
    : null;
  const agendaMax = scheduled.length > 0
    ? scheduled.reduce((m, c) => (c.ends_at ?? "9999-12-31") > m ? (c.ends_at ?? "9999-12-31") : m, "0000-01-01")
    : null;

  const canPrevWeek = agendaWeekStart && agendaMin
    ? agendaWeekStart > getMonday(agendaMin)
    : false;
  const canNextWeek = agendaWeekStart && agendaMax
    ? addDays(agendaWeekStart, 6) < agendaMax
    : false;

  const dayHasChallenges = (day: string) =>
    scheduled.some(c => c.starts_at <= day && (c.ends_at == null || c.ends_at >= day));

  const selectedDayChallenges = agendaDay
    ? scheduled.filter(c => c.starts_at <= agendaDay && (c.ends_at == null || c.ends_at >= agendaDay))
    : [];

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
              className="hover:border-violet-500/50 transition-colors"
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
                  <>
                    <Badge variant="secondary" className="text-xs gap-1 flex-1 justify-center py-1.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      {isWeekly ? "Meta da semana atingida" : "Enviado hoje ✓"}
                    </Badge>
                    <Link
                      href={`/challenges/${ch.id}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5 shrink-0")}
                    >
                      <Eye className="h-3.5 w-3.5" /> Ver
                    </Link>
                  </>
                ) : (
                  <>
                    <Button size="sm" className="flex-1" onClick={() => openModal(ch)}>
                      <Upload className="mr-1.5 h-3.5 w-3.5" /> Enviar
                    </Button>
                    <Link href={`/challenges/${ch.id}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </>
                )}
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      {/* ── Agenda (calendar) ────────────────────────────────── */}
      {!loading && scheduled.length > 0 && agendaWeekStart && (
        <section className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-violet-400" />
            <h2 className="text-lg font-semibold">Agenda</h2>
          </div>

          {/* Week strip */}
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-1">
              {/* Prev week */}
              <button
                onClick={() => {
                  const prev = addDays(agendaWeekStart, -7);
                  setAgendaWeekStart(prev);
                  if (agendaDay && agendaDay < prev) setAgendaDay(prev);
                }}
                disabled={!canPrevWeek}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30 disabled:cursor-default"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {/* Days */}
              <div className="flex flex-1 gap-1">
                {weekDays.map((day, i) => {
                  const hasChall = dayHasChallenges(day);
                  const isSel = day === agendaDay;
                  const dayNum = day.split("-")[2];
                  return (
                    <button
                      key={day}
                      onClick={() => hasChall && setAgendaDay(day)}
                      disabled={!hasChall}
                      className={cn(
                        "flex flex-1 flex-col items-center gap-0.5 rounded-lg py-2 px-1 text-xs transition-colors",
                        isSel
                          ? "bg-violet-600 text-white"
                          : hasChall
                          ? "hover:bg-accent text-foreground cursor-pointer"
                          : "text-muted-foreground/30 cursor-default"
                      )}
                    >
                      <span className="font-medium text-[10px] uppercase tracking-wide">{DAY_NAMES[i]}</span>
                      <span className="text-base font-bold leading-none">{dayNum}</span>
                      {hasChall && !isSel && (
                        <span className="mt-0.5 h-1 w-1 rounded-full bg-violet-400" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Next week */}
              <button
                onClick={() => {
                  const next = addDays(agendaWeekStart, 7);
                  setAgendaWeekStart(next);
                  if (agendaDay && agendaDay > addDays(next, 6)) setAgendaDay(next);
                }}
                disabled={!canNextWeek}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30 disabled:cursor-default"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Month label */}
            {agendaDay && (
              <p className="mt-2 text-center text-xs text-muted-foreground capitalize">
                {new Date(agendaDay + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
                {" · "}
                {(() => { const d = daysUntil(agendaDay); return d === 0 ? "hoje" : d === 1 ? "amanhã" : `em ${d} dias`; })()}
              </p>
            )}
          </div>

          {/* Challenges for selected day */}
          {selectedDayChallenges.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {selectedDayChallenges.map((ch) => (
                <Card key={ch.id} className="border-dashed opacity-80">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm line-clamp-2">{ch.title}</CardTitle>
                      <Badge variant="outline" className="shrink-0 text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                        +{ch.xp_reward} XP
                      </Badge>
                    </div>
                    <CardDescription className="line-clamp-2 text-xs">{ch.description}</CardDescription>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {ch.frequency === "streak" && (
                        <Badge variant="outline" className="text-xs text-orange-400 border-orange-500/30 py-0">
                          <Flame className="h-2.5 w-2.5 mr-1" />Sequência diária
                        </Badge>
                      )}
                      {ch.frequency === "weekly" && (
                        <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/30 py-0">
                          <RotateCcw className="h-2.5 w-2.5 mr-1" />{ch.weekly_target}x/sem
                        </Badge>
                      )}
                      {ch.ends_at && (
                        <Badge variant="outline" className="text-xs text-muted-foreground py-0">
                          até {fmtDate(ch.ends_at)}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <Badge variant="secondary" className="text-xs gap-1 text-muted-foreground">
                      <Lock className="h-3 w-3" /> Disponível em {daysUntil(ch.starts_at) === 1 ? "amanhã" : `${daysUntil(ch.starts_at)} dias`}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum desafio neste dia.</p>
          )}
        </section>
      )}

      {/* ── Submission modal ──────────────────────────────────── */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enviar evidência</DialogTitle>
            <DialogDescription>{selected?.title}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Photo upload — shown if requires_photo */}
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
                  <p className="text-xs text-muted-foreground">Descreva sua conquista abaixo</p>
                </div>
              </div>
            )}

            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="sub-title">
                Título
                {!selected?.requires_photo && <span className="text-destructive ml-0.5">*</span>}
                <span className="text-muted-foreground font-normal ml-1 text-xs">
                  ({(titleValue ?? "").length}/120)
                </span>
              </Label>
              <Input
                id="sub-title"
                placeholder="Ex: Treino matinal de hoje"
                maxLength={120}
                {...register("title")}
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title.message as string}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="sub-description">
                Descrição
                {!selected?.requires_photo && <span className="text-destructive ml-0.5">*</span>}
                <span className="text-muted-foreground font-normal ml-1 text-xs">
                  ({(descriptionValue ?? "").length}/500)
                </span>
              </Label>
              <Textarea
                id="sub-description"
                placeholder="Descreva o que você fez..."
                maxLength={500}
                rows={3}
                {...register("description")}
              />
              {errors.description && (
                <p className="text-xs text-destructive">{errors.description.message as string}</p>
              )}
            </div>

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
