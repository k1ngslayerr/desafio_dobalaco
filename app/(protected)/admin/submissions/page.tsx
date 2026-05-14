"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertTriangle, ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Submission {
  id: string;
  photo_url: string;
  status: string;
  xp_awarded: number;
  created_at: string;
  user: { id: string; username: string; avatar_url: string | null };
  challenge: { id: string; title: string; xp_reward: number };
  reactions: { positive: number; negative: number };
}

export default function AdminSubmissionsPage() {
  const supabase = createClient();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [challengeFilter, setChallengeFilter] = useState("all");
  const [challenges, setChallenges] = useState<Array<{ id: string; title: string }>>([]);
  const [contesting, setContesting] = useState<Submission | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: subs }, { data: chs }] = await Promise.all([
      supabase
        .from("submissions")
        .select(`
          id, photo_url, status, xp_awarded, created_at,
          user:users(id, username, avatar_url),
          challenge:challenges(id, title, xp_reward),
          reactions(type)
        `)
        .order("created_at", { ascending: false }),
      supabase.from("challenges").select("id, title"),
    ]);

    setChallenges(chs ?? []);
    setSubmissions(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((subs ?? []) as any[]).map((s) => ({
        id: s.id,
        photo_url: s.photo_url,
        status: s.status,
        xp_awarded: s.xp_awarded,
        created_at: s.created_at,
        user: s.user as Submission["user"],
        challenge: s.challenge as Submission["challenge"],
        reactions: {
          positive: (s.reactions as Array<{ type: string }>).filter((r) => r.type === "positive").length,
          negative: (s.reactions as Array<{ type: string }>).filter((r) => r.type === "negative").length,
        },
      }))
    );
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(id: string, status: "approved" | "contested" | "rejected") {
    setActing(id);
    try {
      const res = await fetch(`/api/admin/submissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { toast.error("Erro ao atualizar"); return; }
      toast.success(
        status === "approved" ? "Aprovado! XP creditado." :
        status === "contested" ? "Contestado. XP debitado." : "Rejeitado."
      );
      load();
    } finally {
      setActing(null);
      setContesting(null);
    }
  }

  const filtered = submissions.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (challengeFilter !== "all" && s.challenge.id !== challengeFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Submissões</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="contested">Contestados</SelectItem>
            <SelectItem value="rejected">Rejeitados</SelectItem>
          </SelectContent>
        </Select>

        <Select value={challengeFilter} onValueChange={(v) => setChallengeFilter(v ?? "all")}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Desafio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos desafios</SelectItem>
            {challenges.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Badge variant="secondary" className="self-center">
          {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-3">
          {filtered.map((sub) => (
            <Card key={sub.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Photo thumbnail */}
                  <div className="relative h-32 w-full sm:w-48 shrink-0 rounded-md overflow-hidden bg-muted">
                    <Image src={sub.photo_url} alt="Submission" fill className="object-cover" />
                  </div>

                  {/* Details */}
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm">{sub.user.username}</span>
                      <Badge variant="outline" className="text-xs">{sub.challenge.title}</Badge>
                      <Badge
                        variant="outline"
                        className={cn("text-xs", {
                          "text-amber-400 border-amber-500/30 bg-amber-500/10": sub.status === "pending",
                          "text-emerald-400 border-emerald-500/30 bg-emerald-500/10": sub.status === "approved",
                          "text-orange-400 border-orange-500/30 bg-orange-500/10": sub.status === "contested",
                          "text-red-400 border-red-500/30 bg-red-500/10": sub.status === "rejected",
                        })}
                      >
                        {sub.status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="h-3.5 w-3.5 text-emerald-400" /> {sub.reactions.positive}
                      </span>
                      <span className="flex items-center gap-1">
                        <ThumbsDown className="h-3.5 w-3.5 text-red-400" /> {sub.reactions.negative}
                      </span>
                      <span>{formatDistanceToNow(new Date(sub.created_at), { addSuffix: true, locale: ptBR })}</span>
                      {sub.xp_awarded > 0 && (
                        <span className="text-emerald-400">+{sub.xp_awarded} XP</span>
                      )}
                    </div>

                    {/* Actions */}
                    {(sub.status === "pending" || sub.status === "approved") && (
                      <div className="flex gap-2 pt-1">
                        {sub.status === "pending" && (
                          <Button
                            size="sm"
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                            disabled={acting === sub.id}
                            onClick={() => updateStatus(sub.id, "approved")}
                          >
                            {acting === sub.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            Aprovar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                          disabled={acting === sub.id}
                          onClick={() => setContesting(sub)}
                        >
                          <AlertTriangle className="h-3.5 w-3.5" /> Contestar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filtered.length === 0 && (
            <p className="py-10 text-center text-muted-foreground">Nenhuma submissão encontrada.</p>
          )}
        </div>
      )}

      {/* Contest confirmation dialog */}
      <AlertDialog open={!!contesting} onOpenChange={(o) => !o && setContesting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar contestação</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá desqualificar a submissão de <strong>{contesting?.user.username}</strong> e
              debitar o XP concedido. Esta ação não pode ser facilmente desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 hover:bg-orange-700"
              onClick={() => contesting && updateStatus(contesting.id, "contested")}
            >
              Confirmar contestação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
