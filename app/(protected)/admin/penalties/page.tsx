"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { SignedAvatar } from "@/components/SignedAvatar";
import { format, addDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  Loader2, AlertTriangle, Users, ShieldAlert, Gavel,
  Pencil, X, CheckCircle, FileCheck,
} from "lucide-react";

interface AppUser {
  id: string;
  username: string;
  avatar_url: string | null;
  level: number;
  current_penalty: string | null;
}

interface Excuse {
  id: string;
  user_id: string;
  excuse_date: string;
  reason: string | null;
}

// Returns Monday of the current week
function currentWeekMonday(): Date {
  const now = new Date();
  const dow = now.getDay();
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  const mon = new Date(now);
  mon.setDate(now.getDate() - daysFromMon);
  return mon;
}

// 7 dates of the current week as YYYY-MM-DD strings
function weekDates(): string[] {
  const mon = currentWeekMonday();
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(mon, i);
    return d.toISOString().split("T")[0];
  });
}

interface GroupSettings {
  group_penalty_text: string;
  group_penalty_active: boolean;
}

export default function AdminPenaltiesPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [settings, setSettings] = useState<GroupSettings>({
    group_penalty_text: "",
    group_penalty_active: false,
  });
  const [loading, setLoading] = useState(true);

  // Group penalty edit state
  const [groupText, setGroupText] = useState("");
  const [groupActive, setGroupActive] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);

  // Individual penalty dialog
  const [penaltyTarget, setPenaltyTarget] = useState<AppUser | null>(null);
  const [penaltyText, setPenaltyText] = useState("");
  const [savingPenalty, setSavingPenalty] = useState(false);

  // Excuse (atestado) state
  const [excuses, setExcuses] = useState<Excuse[]>([]);
  const [excuseReason, setExcuseReason] = useState("");
  // Track in-progress toggle as "userId:date"
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [usersRes, settingsRes, excusesRes] = await Promise.all([
      fetch("/api/admin/users"),
      fetch("/api/admin/settings"),
      fetch("/api/admin/excuses"),
    ]);
    const usersJson    = await usersRes.json();
    const settingsJson = await settingsRes.json();
    const excusesJson  = await excusesRes.json();

    const loaded: AppUser[] = (usersJson.users ?? []).filter((u: { status: string }) => u.status === "active");
    setUsers(loaded);
    setExcuses(excusesJson.excuses ?? []);

    const s: GroupSettings = settingsJson.settings ?? { group_penalty_text: "", group_penalty_active: false };
    setSettings(s);
    setGroupText(s.group_penalty_text);
    setGroupActive(s.group_penalty_active);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Group penalty ────────────────────────────────────────────
  async function saveGroupPenalty() {
    setSavingGroup(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_penalty_text: groupText, group_penalty_active: groupActive }),
      });
      if (!res.ok) { toast.error("Erro ao salvar penalidade do grupo"); return; }
      toast.success("Penalidade do grupo salva!");
      setSettings({ group_penalty_text: groupText, group_penalty_active: groupActive });
    } finally {
      setSavingGroup(false);
    }
  }

  async function toggleGroupActive(active: boolean) {
    setGroupActive(active);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_penalty_active: active }),
    });
    if (!res.ok) {
      toast.error("Erro ao atualizar status");
      setGroupActive(!active); // revert
    } else {
      toast.success(active ? "Penalidade do grupo ATIVADA" : "Penalidade do grupo desativada");
      setSettings((prev) => ({ ...prev, group_penalty_active: active }));
    }
  }

  // ── Individual penalty ───────────────────────────────────────
  function openPenaltyDialog(user: AppUser) {
    setPenaltyTarget(user);
    setPenaltyText(user.current_penalty ?? "");
  }

  async function savePenalty() {
    if (!penaltyTarget) return;
    setSavingPenalty(true);
    try {
      const res = await fetch("/api/admin/penalties", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: penaltyTarget.id,
          penalty: penaltyText.trim() || null,
        }),
      });
      if (!res.ok) { toast.error("Erro ao salvar penalidade"); return; }
      const verb = penaltyText.trim() ? "atribuída" : "removida";
      toast.success(`Penalidade ${verb} para ${penaltyTarget.username}`);
      setPenaltyTarget(null);
      load();
    } finally {
      setSavingPenalty(false);
    }
  }

  async function clearPenalty(user: AppUser) {
    const res = await fetch("/api/admin/penalties", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id, penalty: null }),
    });
    if (!res.ok) { toast.error("Erro ao remover penalidade"); return; }
    toast.success(`Penalidade de ${user.username} removida`);
    load();
  }

  // ── Excuse helpers ───────────────────────────────────────────
  async function toggleExcuse(userId: string, date: string) {
    const key = `${userId}:${date}`;
    setTogglingKey(key);
    try {
      const existing = excuses.find((e) => e.user_id === userId && e.excuse_date === date);
      if (existing) {
        const res = await fetch(`/api/admin/excuses?id=${existing.id}`, { method: "DELETE" });
        if (!res.ok) { toast.error("Erro ao remover atestado"); return; }
        setExcuses((prev) => prev.filter((e) => e.id !== existing.id));
        toast.success("Atestado removido");
      } else {
        const res = await fetch("/api/admin/excuses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, excuse_date: date, reason: excuseReason.trim() || undefined }),
        });
        const json = await res.json();
        if (!res.ok) { toast.error(json.error ?? "Erro ao criar atestado"); return; }
        setExcuses((prev) => [...prev, json.excuse]);
        toast.success("Atestado adicionado");
      }
    } finally {
      setTogglingKey(null);
    }
  }

  const WEEK_DATES = weekDates();
  const todayStr = new Date().toISOString().split("T")[0];

  const penalizedUsers = users.filter((u) => u.current_penalty);
  const cleanUsers = users.filter((u) => !u.current_penalty);

  return (
    <div className="space-y-8">
      {/* ── Group penalty ──────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-semibold">Penalidade do grupo</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Punição coletiva aplicada ao grupo quando falham juntos. Visível para todos na tela semanal.
        </p>

        <Card className={settings.group_penalty_active ? "border-amber-500/40 bg-amber-500/5" : undefined}>
          <CardContent className="p-4 space-y-4">
            {/* Active toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-medium">Status da punição</Label>
                <p className="text-xs text-muted-foreground">
                  {settings.group_penalty_active
                    ? "Ativa — visível a todos os usuários"
                    : "Inativa — apenas admins veem o texto"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {settings.group_penalty_active && (
                  <Badge className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1">
                    <AlertTriangle className="h-3 w-3" /> Em vigor
                  </Badge>
                )}
                <Switch
                  checked={groupActive}
                  onCheckedChange={toggleGroupActive}
                />
              </div>
            </div>

            <Separator />

            {/* Penalty text */}
            <div className="space-y-2">
              <Label>Descrição da punição</Label>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Ex: O grupo fica 1 semana sem sair de casa nas noites de sexta"
                value={groupText}
                onChange={(e) => setGroupText(e.target.value)}
              />
            </div>

            <Button
              onClick={saveGroupPenalty}
              disabled={savingGroup || groupText === settings.group_penalty_text}
              size="sm"
            >
              {savingGroup && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar texto
            </Button>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* ── Individual penalties ───────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Gavel className="h-5 w-5 text-red-400" />
          <h2 className="text-lg font-semibold">Punições individuais</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Atribua punições físicas a usuários que falharam nos desafios da semana.
          A punição fica visível para o usuário no dashboard e na tela semanal.
        </p>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Users with active penalty */}
            {penalizedUsers.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  Com punição ativa ({penalizedUsers.length})
                </h3>
                {penalizedUsers.map((u) => (
                  <Card key={u.id} className="border-red-500/30 bg-red-500/5">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <SignedAvatar
                          path={u.avatar_url}
                          fallback={u.username.slice(0, 2).toUpperCase()}
                          className="h-8 w-8 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{u.username}</p>
                          <p className="text-xs text-red-400 line-clamp-1">
                            {u.current_penalty}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Editar punição"
                            onClick={() => openPenaltyDialog(u)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                            title="Marcar como cumprida (remover)"
                            onClick={() => clearPenalty(u)}
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Clean users */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                Sem punição ativa ({cleanUsers.length})
              </h3>
              {cleanUsers.map((u) => (
                <Card key={u.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <SignedAvatar
                        path={u.avatar_url}
                        fallback={u.username.slice(0, 2).toUpperCase()}
                        className="h-8 w-8 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{u.username}</p>
                        <p className="text-xs text-muted-foreground">Nível {u.level} · Sem punição</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 text-red-400 border-red-500/30 hover:bg-red-500/10"
                        onClick={() => openPenaltyDialog(u)}
                      >
                        <Gavel className="mr-1.5 h-3.5 w-3.5" />
                        Punir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </section>

      <Separator />

      {/* ── Atestados ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <FileCheck className="h-5 w-5 text-sky-400" />
          <h2 className="text-lg font-semibold">Atestados</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Ative um atestado para dispensar um usuário das metas diárias em dias específicos.
          Ele não ganha XP nesses dias, mas também <strong>não é punido</strong>.
        </p>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((u) => {
              const userExcuses = excuses.filter((e) => e.user_id === u.id);
              const hasAny = userExcuses.length > 0;
              return (
                <Card key={u.id} className={hasAny ? "border-sky-500/30 bg-sky-500/5" : undefined}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <SignedAvatar
                        path={u.avatar_url}
                        fallback={u.username.slice(0, 2).toUpperCase()}
                        className="h-8 w-8 shrink-0 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm mb-2">{u.username}</p>
                        {/* Day buttons for current week */}
                        <div className="flex flex-wrap gap-1.5">
                          {WEEK_DATES.map((date) => {
                            const isExcused = userExcuses.some((e) => e.excuse_date === date);
                            const isPast = date < todayStr;
                            const isToday = date === todayStr;
                            const isFuture = date > todayStr;
                            const d = parseISO(date + "T12:00:00");
                            const label = format(d, "EEE dd", { locale: ptBR });
                            const isToggling = togglingKey === `${u.id}:${date}`;

                            return (
                              <button
                                key={date}
                                disabled={isToggling}
                                onClick={() => toggleExcuse(u.id, date)}
                                title={isExcused ? "Clique para remover atestado" : "Clique para adicionar atestado"}
                                className={[
                                  "px-2 py-1 rounded-md text-xs font-medium border transition-colors",
                                  isExcused
                                    ? "bg-sky-500/20 border-sky-500/50 text-sky-400"
                                    : isPast
                                    ? "border-border/40 text-muted-foreground/50 hover:border-border hover:text-muted-foreground"
                                    : isToday
                                    ? "border-border text-foreground hover:bg-sky-500/10 hover:border-sky-500/50 hover:text-sky-400"
                                    : "border-border text-muted-foreground hover:bg-sky-500/10 hover:border-sky-500/50 hover:text-sky-400",
                                  isFuture && !isExcused ? "opacity-70" : "",
                                ].join(" ")}
                              >
                                {isToggling
                                  ? <Loader2 className="h-3 w-3 animate-spin inline" />
                                  : label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Penalty assignment dialog ────────────────────────── */}
      <Dialog open={!!penaltyTarget} onOpenChange={(o) => !o && setPenaltyTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-red-400" />
              Punição para {penaltyTarget?.username}
            </DialogTitle>
            <DialogDescription>
              Descreva a punição física. Será visível para o usuário e para o grupo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Descrição da punição</Label>
            <Input
              placeholder="Ex: 7 dias sem assistir futebol"
              value={penaltyText}
              onChange={(e) => setPenaltyText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && savePenalty()}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Deixe vazio para remover a punição atual.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPenaltyTarget(null)}>
              Cancelar
            </Button>
            {penaltyTarget?.current_penalty && (
              <Button
                variant="ghost"
                className="text-emerald-400"
                disabled={savingPenalty}
                onClick={() => { setPenaltyText(""); }}
              >
                <X className="mr-1.5 h-3.5 w-3.5" /> Limpar
              </Button>
            )}
            <Button
              onClick={savePenalty}
              disabled={savingPenalty}
              className={penaltyText.trim() ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {savingPenalty && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {penaltyText.trim() ? "Aplicar punição" : "Remover punição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
