"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Zap, Clock, LogOut, RefreshCw } from "lucide-react";
import { toast } from "sonner";

// Poll every 10s. A Supabase Realtime subscription on `users` would be
// blocked by RLS for the browser client (anon, since auth cookies are
// httpOnly), so we use a server-route poll instead.
const POLL_INTERVAL_MS = 10_000;

export default function PendingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/profile/status", { cache: "no-store" });
        if (res.status === 401) {
          router.replace("/login");
          return true;
        }
        if (!res.ok) return false;
        const { status } = await res.json();
        if (status === "active" && !cancelled) {
          toast.success("Conta aprovada! Bem-vindo ao DesafioHub 🎉");
          router.replace("/dashboard");
          return true;
        }
      } catch {
        // transient network error — try again next tick
      }
      return false;
    }

    poll();
    const id = setInterval(() => {
      if (!cancelled) poll();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [router]);

  async function handleManualCheck() {
    setChecking(true);
    try {
      const res = await fetch("/api/profile/status", { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) {
        toast.error("Erro ao verificar. Tente novamente.");
        return;
      }
      const { status } = await res.json();
      if (status === "active") {
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
