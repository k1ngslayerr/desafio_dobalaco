"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { challengeSchema, type ChallengeInput } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Power, PowerOff, Camera, Hash, RotateCcw, Trash2, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Shows a breakdown of XP earned per check-in vs total potential for the week
function XpWeeklyHint({
  xpReward,
  isWeekly,
  weeklyTarget,
}: {
  xpReward: number;
  isWeekly: boolean;
  weeklyTarget: number;
}) {
  const xp = Number(xpReward) || 0;
  if (xp <= 0) return null;

  // Daily: up to 7 check-ins/week. Weekly: weeklyTarget check-ins/week.
  const checksPerWeek = isWeekly ? (Number(weeklyTarget) || 1) : 7;
  const weeklyTotal = xp * checksPerWeek;

  return (
    <p className="text-xs text-muted-foreground -mt-1">
      <span className="text-emerald-400 font-medium">+{xp} XP</span> por check-in
      {" · "}
      até <span className="text-violet-400 font-medium">+{weeklyTotal} XP</span> na semana
      {isWeekly
        ? ` (${checksPerWeek}× por semana)`
        : " (1× por dia, 7 dias)"}
    </p>
  );
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  xp_reward: number;
  penalty_xp: number;
  is_active: boolean;
  requires_photo: boolean;
  frequency: "daily" | "weekly";
  weekly_target: number;
  starts_at: string | null;
  ends_at: string | null;
  quantity_label: string | null;
  xp_per_unit: number | null;
  max_quantity: number | null;
}

const DEFAULT_VALUES: ChallengeInput = {
  title: "",
  description: "",
  xp_reward: 100,
  penalty_xp: 0,
  requires_photo: true,
  frequency: "daily",
  weekly_target: 1,
  starts_at: null,
  ends_at: null,
  quantity_label: null,
  xp_per_unit: null,
  max_quantity: null,
};

export default function AdminChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Challenge | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<Challenge | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<Challenge | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, reset, control, setValue, formState: { errors } } = useForm<ChallengeInput>({
    resolver: zodResolver(challengeSchema) as any,
    defaultValues: DEFAULT_VALUES,
  });

  const requiresPhoto      = useWatch({ control, name: "requires_photo" });
  const frequency          = useWatch({ control, name: "frequency" });
  const quantityLabel      = useWatch({ control, name: "quantity_label" });
  const watchedXpReward    = useWatch({ control, name: "xp_reward" })    ?? 0;
  const watchedWeeklyTarget = useWatch({ control, name: "weekly_target" }) ?? 1;
  const hasQuantity = !!(quantityLabel && String(quantityLabel).trim().length > 0);
  const isWeekly = frequency === "weekly";

  async function load() {
    const res = await fetch("/api/admin/challenges");
    const json = await res.json();
    setChallenges(json.challenges ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    reset(DEFAULT_VALUES);
    setShowForm(true);
  }

  function openEdit(ch: Challenge) {
    setEditing(ch);
    reset({
      title: ch.title,
      description: ch.description,
      xp_reward: ch.xp_reward,
      penalty_xp: ch.penalty_xp,
      requires_photo: ch.requires_photo,
      frequency: ch.frequency ?? "daily",
      weekly_target: ch.weekly_target ?? 1,
      starts_at: ch.starts_at ?? null,
      ends_at: ch.ends_at ?? null,
      quantity_label: ch.quantity_label ?? null,
      xp_per_unit: ch.xp_per_unit ?? null,
      max_quantity: ch.max_quantity ?? null,
    });
    setShowForm(true);
  }

  async function onSubmit(values: ChallengeInput) {
    setSubmitting(true);
    try {
      // Normalize empty strings → null for optional fields
      const payload = {
        ...values,
        starts_at:     (values.starts_at     as string | null | undefined)?.trim() || null,
        ends_at:       (values.ends_at       as string | null | undefined)?.trim() || null,
        quantity_label: values.quantity_label?.trim() || null,
        xp_per_unit:   values.quantity_label?.trim() ? values.xp_per_unit : null,
        max_quantity:  values.quantity_label?.trim() ? values.max_quantity : null,
      };
      const url = editing ? `/api/admin/challenges/${editing.id}` : "/api/admin/challenges";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { toast.error("Erro ao salvar desafio"); return; }
      toast.success(editing ? "Desafio atualizado!" : "Desafio criado!");
      setShowForm(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(ch: Challenge) {
    await fetch(`/api/admin/challenges/${ch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !ch.is_active }),
    });
    toast.success(ch.is_active ? "Desafio desativado" : "Desafio ativado");
    load();
  }

  async function deleteChallenge(ch: Challenge) {
    setDeleting(ch);
    try {
      const res = await fetch(`/api/admin/challenges/${ch.id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("Erro ao excluir desafio"); return; }
      toast.success(`Desafio "${ch.title}" excluído`);
      setConfirmingDelete(null);
      load();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Desafios</h2>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> Novo desafio
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {challenges.map((ch) => (
            <Card key={ch.id} className={!ch.is_active ? "opacity-50" : undefined}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{ch.title}</p>
                      <Badge variant={ch.is_active ? "default" : "secondary"} className="text-xs">
                        {ch.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                      <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/30">
                        +{ch.xp_reward} XP
                      </Badge>
                      {ch.penalty_xp > 0 && (
                        <Badge variant="outline" className="text-xs text-red-400 border-red-500/30">
                          -{ch.penalty_xp} XP penalidade
                        </Badge>
                      )}
                      {ch.frequency === "weekly" && (
                        <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/30">
                          <RotateCcw className="h-3 w-3 mr-1" />{ch.weekly_target}x/semana
                        </Badge>
                      )}
                      {!ch.requires_photo && (
                        <Badge variant="outline" className="text-xs text-sky-400 border-sky-500/30">
                          Sem foto
                        </Badge>
                      )}
                      {ch.quantity_label && (
                        <Badge variant="outline" className="text-xs text-violet-400 border-violet-500/30">
                          <Hash className="h-3 w-3 mr-1" />{ch.quantity_label}
                        </Badge>
                      )}
                      {(ch.starts_at || ch.ends_at) && (() => {
                        const today = new Date().toISOString().split("T")[0];
                        const notStarted = ch.starts_at && ch.starts_at > today;
                        const ended      = ch.ends_at   && ch.ends_at   < today;
                        const fmt = (d: string) => {
                          const [y, m, day] = d.split("-");
                          return `${day}/${m}/${y.slice(2)}`;
                        };
                        return (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs gap-1",
                              ended      ? "text-red-400 border-red-500/30"
                            : notStarted ? "text-amber-400 border-amber-500/30"
                            :              "text-sky-400 border-sky-500/30"
                            )}
                          >
                            <CalendarDays className="h-3 w-3" />
                            {ch.starts_at ? fmt(ch.starts_at) : "∞"}
                            {" → "}
                            {ch.ends_at ? fmt(ch.ends_at) : "∞"}
                            {ended && " · Encerrado"}
                            {notStarted && " · Em breve"}
                          </Badge>
                        );
                      })()}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ch.description}</p>
                  </div>

                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(ch)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleActive(ch)}>
                      {ch.is_active
                        ? <PowerOff className="h-3.5 w-3.5 text-red-400" />
                        : <Power className="h-3.5 w-3.5 text-emerald-400" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                      title="Excluir permanentemente"
                      onClick={() => setConfirmingDelete(ch)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Delete confirmation ───────────────────────────────── */}
      <AlertDialog open={!!confirmingDelete} onOpenChange={(o) => !o && setConfirmingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-400" />
              Excluir desafio?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai excluir permanentemente <strong>&ldquo;{confirmingDelete?.title}&rdquo;</strong> e todas as
              submissões associadas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={!!deleting}
              onClick={() => confirmingDelete && deleteChallenge(confirmingDelete)}
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Form modal */}
      <Dialog open={showForm} onOpenChange={(o) => !o && setShowForm(false)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar desafio" : "Novo desafio"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input {...register("title")} placeholder="Título do desafio" />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Descreva o desafio..."
                {...register("description")}
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
            </div>

            {/* XP fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>XP por check-in</Label>
                <Input type="number" min={1} {...register("xp_reward", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label>XP Penalidade</Label>
                <Input type="number" min={0} {...register("penalty_xp", { valueAsNumber: true })} />
              </div>
            </div>
            {/* Hint: total weekly XP based on frequency */}
            <XpWeeklyHint xpReward={watchedXpReward} isWeekly={isWeekly} weeklyTarget={watchedWeeklyTarget} />

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  Início
                </Label>
                <Input
                  type="date"
                  {...register("starts_at")}
                  className="block"
                />
                <p className="text-xs text-muted-foreground">Vazio = começa agora</p>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  Fim
                </Label>
                <Input
                  type="date"
                  {...register("ends_at")}
                  className="block"
                />
                <p className="text-xs text-muted-foreground">Vazio = sem prazo</p>
              </div>
            </div>

            <Separator />

            {/* Frequency */}
            <div className="space-y-3">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-1.5">
                  <RotateCcw className="h-4 w-4 text-muted-foreground" />
                  Frequência
                </Label>
                <p className="text-xs text-muted-foreground">
                  Diário = uma submissão por dia. Semanal = N vezes por semana (ex: exercício 3×).
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setValue("frequency", "daily")}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    !isWeekly
                      ? "border-violet-500 bg-violet-500/10 text-violet-400"
                      : "border-border text-muted-foreground hover:border-border/80"
                  )}
                >
                  Diário
                </button>
                <button
                  type="button"
                  onClick={() => setValue("frequency", "weekly")}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    isWeekly
                      ? "border-amber-500 bg-amber-500/10 text-amber-400"
                      : "border-border text-muted-foreground hover:border-border/80"
                  )}
                >
                  Semanal
                </button>
              </div>
              {isWeekly && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Quantas vezes por semana?</Label>
                  <Input
                    type="number"
                    min={1}
                    max={7}
                    {...register("weekly_target", { valueAsNumber: true })}
                  />
                  {errors.weekly_target && (
                    <p className="text-xs text-destructive">{errors.weekly_target.message}</p>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Requires photo toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-1.5 cursor-pointer">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  Evidência fotográfica obrigatória
                </Label>
                <p className="text-xs text-muted-foreground">
                  Desative para desafios que não precisam de foto (ex: meta de água)
                </p>
              </div>
              <Switch
                checked={requiresPhoto ?? true}
                onCheckedChange={(v) => setValue("requires_photo", v)}
              />
            </div>

            <Separator />

            {/* Quantifiable XP section */}
            <div className="space-y-3">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-1.5">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  XP Quantificável <span className="text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  Para desafios onde mais = mais XP (ex: leitura — quem lê 50 páginas ganha mais que quem lê 5)
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Unidade medida</Label>
                <Input
                  {...register("quantity_label")}
                  placeholder="Ex: páginas, km, copos de água"
                />
                <p className="text-xs text-muted-foreground">Deixe vazio para desativar</p>
              </div>

              {hasQuantity && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">XP por unidade</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Ex: 2"
                      {...register("xp_per_unit", { valueAsNumber: true })}
                    />
                    {errors.xp_per_unit && <p className="text-xs text-destructive">{errors.xp_per_unit.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Quantidade máxima</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Ex: 200"
                      {...register("max_quantity", { valueAsNumber: true })}
                    />
                    {errors.max_quantity && <p className="text-xs text-destructive">{errors.max_quantity.message}</p>}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
