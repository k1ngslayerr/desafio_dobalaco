import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { ShieldCheck, Swords, ListChecks, Users, Gavel } from "lucide-react";

const ADMIN_TABS = [
  { href: "/admin/challenges",  label: "Desafios",   icon: Swords },
  { href: "/admin/submissions", label: "Submissões", icon: ListChecks },
  { href: "/admin/users",       label: "Usuários",   icon: Users },
  { href: "/admin/penalties",   label: "Punições",   icon: Gavel },
];

// [SECURITY] Double-checked: middleware guards /admin/* but we re-verify here
// in case middleware is bypassed (defense-in-depth)
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((profile as any)?.role !== "admin") redirect("/dashboard");

  return (
    <div className="space-y-6">
      {/* Admin header */}
      <div className="flex items-center gap-2 border-b border-border/50 pb-4">
        <ShieldCheck className="h-5 w-5 text-amber-400" />
        <h1 className="text-xl font-bold text-amber-400">Painel Admin</h1>
      </div>

      {/* Tab navigation */}
      <nav className="flex gap-1 overflow-x-auto">
        {ADMIN_TABS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              "data-[active=true]:bg-amber-500/10 data-[active=true]:text-amber-400"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
