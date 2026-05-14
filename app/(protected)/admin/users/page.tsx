"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LevelArt } from "@/components/LevelArt";
import { SignedAvatar } from "@/components/SignedAvatar";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldOff, CheckCircle, Clock, UserX } from "lucide-react";

interface User {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  xp: number;
  level: number;
  role: string;
  status: string;
  created_at: string;
}

type ConfirmAction =
  | { kind: "role";   user: User; newRole: "admin" | "user" }
  | { kind: "status"; user: User; newStatus: "active" | "pending" | "suspended" };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [artTiers, setArtTiers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<ConfirmAction | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    const json = await res.json();
    const loaded: User[] = json.users ?? [];
    setUsers(loaded);
    // Compute art tier locally
    const map: Record<number, number> = {};
    [...new Set(loaded.map((u) => u.level))].forEach((l) => { map[l] = Math.ceil(l / 10); });
    setArtTiers(map);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function applyAction(action: ConfirmAction) {
    setActing(action.user.id);
    try {
      const body =
        action.kind === "role"
          ? { action: "role",   user_id: action.user.id, role:   action.newRole }
          : { action: "status", user_id: action.user.id, status: action.newStatus };

      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { toast.error("Erro ao atualizar usuário"); return; }

      if (action.kind === "role") {
        toast.success(action.newRole === "admin" ? "Usuário promovido a admin!" : "Admin rebaixado para usuário.");
      } else {
        const labels: Record<string, string> = { active: "aprovado", pending: "pendente", suspended: "suspenso" };
        toast.success(`Usuário ${labels[action.newStatus] ?? action.newStatus}.`);
      }
      load();
    } finally {
      setActing(null);
      setConfirming(null);
    }
  }

  const pendingUsers = users.filter((u) => u.status === "pending");
  const activeUsers  = users.filter((u) => u.status !== "pending");

  function UserRow({ u, idx }: { u: User; idx: number }) {
    const isPending = u.status === "pending";
    return (
      <Card key={u.id} className={isPending ? "border-amber-500/40 bg-amber-500/5" : undefined}>
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            {/* Rank */}
            <span className="w-7 text-xs font-semibold text-muted-foreground text-center shrink-0">
              {isPending ? <Clock className="h-4 w-4 text-amber-400 mx-auto" /> : `#${idx + 1}`}
            </span>

            {/* Avatar + LevelArt badge */}
            <div className="relative shrink-0">
              <SignedAvatar
                path={u.avatar_url}
                fallback={u.username.slice(0, 2).toUpperCase()}
                className="h-9 w-9"
              />
              {!isPending && (
                <div className="absolute -bottom-1 -right-1">
                  <LevelArt tier={artTiers[u.level] ?? 1} level={u.level} size={18} />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-sm truncate">{u.username}</span>
                {u.role === "admin" && (
                  <Badge className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30 h-4 px-1.5">
                    Admin
                  </Badge>
                )}
                {isPending && (
                  <Badge className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30 h-4 px-1.5">
                    Pendente
                  </Badge>
                )}
                {u.status === "suspended" && (
                  <Badge className="text-xs bg-red-500/20 text-red-400 border-red-500/30 h-4 px-1.5">
                    Suspenso
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {isPending
                  ? `Aguardando aprovação · ${new Date(u.created_at).toLocaleDateString("pt-BR")}`
                  : `Nível ${u.level} · ${u.xp.toLocaleString()} XP`}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-1 shrink-0">
              {isPending ? (
                // Pending users: only show Approve
                <Button
                  size="sm"
                  disabled={acting === u.id}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => setConfirming({ kind: "status", user: u, newStatus: "active" })}
                >
                  {acting === u.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <><CheckCircle className="h-4 w-4 mr-1" /> Aprovar</>}
                </Button>
              ) : (
                // Active users: role toggle + suspend
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={acting === u.id}
                    className={u.role === "admin"
                      ? "text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      : "text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"}
                    onClick={() => setConfirming({ kind: "role", user: u, newRole: u.role === "admin" ? "user" : "admin" })}
                  >
                    {acting === u.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : u.role === "admin"
                        ? <><ShieldOff className="h-4 w-4 mr-1" /> Remover admin</>
                        : <><ShieldCheck className="h-4 w-4 mr-1" /> Tornar admin</>}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={acting === u.id}
                    className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                    title="Suspender usuário"
                    onClick={() => setConfirming({ kind: "status", user: u, newStatus: "suspended" })}
                  >
                    <UserX className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Confirmation dialog text
  const confirmTitle = !confirming ? "" :
    confirming.kind === "role"
      ? confirming.newRole === "admin" ? "Promover a admin?" : "Remover admin?"
      : confirming.newStatus === "active"    ? "Aprovar usuário?"
      : confirming.newStatus === "suspended" ? "Suspender usuário?"
      : "Tornar pendente?";

  const confirmDesc = !confirming ? "" :
    confirming.kind === "role"
      ? confirming.newRole === "admin"
          ? `${confirming.user.username} receberá acesso total de administrador.`
          : `Os privilégios de admin de ${confirming.user.username} serão removidos.`
      : confirming.newStatus === "active"
          ? `${confirming.user.username} terá acesso à plataforma.`
          : confirming.newStatus === "suspended"
          ? `${confirming.user.username} perderá o acesso e será bloqueado na tela de aprovação.`
          : `${confirming.user.username} voltará para a fila de aprovação.`;

  const confirmColor = !confirming ? "" :
    confirming.kind === "status" && confirming.newStatus === "active" ? "bg-emerald-600 hover:bg-emerald-700"
    : confirming.kind === "role"  && confirming.newRole   === "admin"  ? "bg-amber-600 hover:bg-amber-700"
    : "bg-red-600 hover:bg-red-700";

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Usuários ({users.length})</h2>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* ── Pending section ─────────────────────────────── */}
          {pendingUsers.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-amber-400">
                  Aguardando aprovação ({pendingUsers.length})
                </h3>
              </div>
              {pendingUsers.map((u) => (
                <UserRow key={u.id} u={u} idx={0} />
              ))}
              <Separator className="my-2" />
            </section>
          )}

          {/* ── Active users section ─────────────────────────── */}
          <section className="space-y-2">
            {pendingUsers.length > 0 && (
              <h3 className="text-sm font-semibold text-muted-foreground">
                Ativos ({activeUsers.length})
              </h3>
            )}
            {activeUsers.map((u, idx) => (
              <UserRow key={u.id} u={u} idx={idx} />
            ))}
          </section>
        </>
      )}

      {/* Confirm dialog */}
      <AlertDialog open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={confirmColor}
              onClick={() => confirming && applyAction(confirming)}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
