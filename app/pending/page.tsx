"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Zap, Clock, LogOut, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function PendingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let userId: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      userId = user.id;

      // ── Sanity check: are we already approved? ───────────────
      const { data } = await supabase
        .from("users")
        .select("status")
        .eq("id", userId)
        .single();

      if (data?.status === "active") {
        router.replace("/dashboard");
        return;
      }

      // ── Realtime: listen for the admin's approval ────────────
      channel = supabase
        .channel(`pending-user-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "users",
            filter: `id=eq.${userId}`,
          },
          (payload) => {
            if ((payload.new as { status: string }).status === "active") {
              toast.success("Conta aprovada! Bem-vindo ao DesafioHub 🎉");
              router.replace("/dashboard");
            }
          }
        )
        .subscribe();
    }

    init();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleManualCheck() {
    setChecking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }

      const { data } = await supabase
        .from("users")
        .select("status")
        .eq("id", user.id)
        .single();

      if (data?.status === "active") {
        toast.success("Conta aprovada! Bem-vindo ao DesafioHub 🎉");
        router.replace("/dashboard");
      } else {
        toast.info("Ainda aguardando aprovação…");
      }
    } finally {
      setChecking(false);
    }
  }

  function handleSignOut() {
    window.location.href = "/api/auth/signout";
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2">
          <Zap className="h-7 w-7 text-violet-500" />
          <span className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
            DesafioHub
          </span>
        </div>

        {/* Animated clock icon */}
        <div className="relative flex items-center justify-center">
          <div className="absolute h-32 w-32 rounded-full bg-violet-500/10 animate-ping" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-violet-500/20 border border-violet-500/30">
            <Clock className="h-12 w-12 text-violet-400" />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-3">
          <h1 className="text-2xl font-bold">Aguardando aprovação</h1>
          <p className="text-muted-foreground leading-relaxed">
            Sua conta foi criada com sucesso! Um administrador precisa aprová-la
            antes que você possa acessar a plataforma.
          </p>
          <p className="text-sm text-muted-foreground">
            Você será redirecionado automaticamente assim que for aprovado.
          </p>
        </div>

        {/* Pulsing dots — shows the page is "live" */}
        <div className="flex items-center justify-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-violet-500 animate-bounce [animation-delay:-0.3s]" />
          <span className="h-2 w-2 rounded-full bg-violet-500 animate-bounce [animation-delay:-0.15s]" />
          <span className="h-2 w-2 rounded-full bg-violet-500 animate-bounce" />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 pt-2">
          <Button
            variant="outline"
            onClick={handleManualCheck}
            disabled={checking}
            className="w-full"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${checking ? "animate-spin" : ""}`} />
            Verificar aprovação
          </Button>
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="w-full text-muted-foreground hover:text-foreground"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
