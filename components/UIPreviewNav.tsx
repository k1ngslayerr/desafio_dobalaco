"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { PanelsTopLeft } from "lucide-react";
import { AppearanceTrigger } from "@/components/appearance/AppearanceProvider";

const screens = [
  ["Propostas de UI", "/ui-lab"],
  ["Dashboard", "/dashboard"],
  ["Desafios", "/challenges"],
  ["Feed do desafio", "/challenges/20000000-0000-4000-8000-000000000001"],
  ["Ranking", "/ranking"],
  ["Resumo semanal", "/weekly"],
  ["Meu perfil", "/profile"],
  ["Perfil de participante", "/u/marina"],
  ["Login", "/login"],
  ["Cadastro", "/register"],
  ["Recuperar senha", "/forgot-password"],
  ["Redefinir senha", "/reset-password"],
  ["Aguardando aprovação", "/pending"],
  ["Admin · Desafios", "/admin/challenges"],
  ["Admin · Submissões", "/admin/submissions"],
  ["Admin · Usuários", "/admin/users"],
  ["Admin · Punições", "/admin/penalties"],
  ["Galeria de níveis", "/admin/level-art"],
] as const;

export function UIPreviewNav() {
  const pathname = usePathname();
  const detailsRef = useRef<HTMLDetailsElement>(null);

  if (pathname.startsWith("/ui-lab") || ["/dashboard", "/challenges", "/ranking", "/profile"].includes(pathname)) return null;

  return (
    <details ref={detailsRef} className="fixed bottom-4 right-4 z-40 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-border bg-background px-4 py-3 font-medium shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <PanelsTopLeft className="h-4 w-4 text-primary" aria-hidden="true" />
        Modo UI · Telas
      </summary>
      <div className="absolute bottom-full right-0 mb-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-background p-3 shadow-xl">
        <p className="px-2 py-1 font-semibold">Explorar as telas</p>
        <p className="mb-3 px-2 text-xs text-muted-foreground">Dados fictícios. Ações não são salvas.</p>
        <AppearanceTrigger />
        <nav aria-label="Telas de demonstração" className="max-h-[min(60dvh,28rem)] space-y-0.5 overflow-y-auto">
          {screens.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              onClick={() => { if (detailsRef.current) detailsRef.current.open = false; }}
              className="block rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring aria-[current=page]:bg-accent aria-[current=page]:text-foreground"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </details>
  );
}
