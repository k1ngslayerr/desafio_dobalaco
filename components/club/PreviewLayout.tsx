"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";

export function PreviewLayout({ children, user }: {
  children: ReactNode;
  user: { id: string; username: string; avatar_url: string | null; level: number; role: string };
}) {
  const pathname = usePathname();
  if (["/dashboard", "/challenges", "/ranking", "/profile"].includes(pathname)) return children;
  return <div className="min-h-screen bg-background">
    <Navbar user={user} />
    <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
  </div>;
}
