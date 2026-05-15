"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, LogIn } from "lucide-react";
import { GoogleButton } from "@/components/GoogleButton";

const ERROR_MESSAGES: Record<string, [string, "info" | "error"]> = {
  oauth_cancelled: ["Login com Google cancelado.",                     "info" ],
  oauth:           ["Erro ao autenticar com Google. Tente novamente.", "error"],
  account_error:   ["Conta com problema — contate um administrador.",  "error"],
};

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // Show a toast for any ?error= param left by the OAuth callback or middleware,
  // then scrub it from the URL so refreshing doesn't re-show it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (!err) return;

    const entry = ERROR_MESSAGES[err];
    if (entry) toast[entry[1]](entry[0]);
    else toast.error("Ocorreu um erro. Tente novamente.");

    router.replace("/login", { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setIsLoading(true);
    try {
      // [SECURITY] Login goes through /api/auth/login so we can enforce
      // per-email rate-limiting before hitting Supabase. The server route
      // sets the httpOnly session cookie on success.
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (res.status === 429) {
        toast.error("Muitas tentativas. Tente novamente em alguns minutos.");
        return;
      }
      if (!res.ok) {
        // Generic message — never reveal whether the email exists.
        toast.error("Email ou senha incorretos.");
        return;
      }

      toast.success("Bem-vindo de volta!");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      console.error("[login] unexpected error:", err);
      toast.error("Erro inesperado. Verifique o console.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Entrar</CardTitle>
        <CardDescription>Acesse sua conta para continuar</CardDescription>
      </CardHeader>

      {/* method="POST" previne que o navegador exponha dados na URL se o JS falhar */}
      <form method="POST" action="#" onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="seuemail@exemplo.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••••"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="mr-2 h-4 w-4" />
            )}
            Entrar
          </Button>

          {/* OAuth divider */}
          <div className="relative w-full flex items-center gap-2">
            <div className="flex-1 border-t border-border" />
            <span className="text-xs text-muted-foreground shrink-0">ou</span>
            <div className="flex-1 border-t border-border" />
          </div>

          <GoogleButton label="Entrar com Google" />

          <p className="text-sm text-muted-foreground text-center">
            Não tem conta?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Cadastre-se
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
