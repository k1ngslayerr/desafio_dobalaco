"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  Swords,
  Trophy,
  User,
  ShieldCheck,
  LogOut,
  Zap,
  CalendarDays,
} from "lucide-react";
import { LevelArt } from "@/components/LevelArt";
import { useSignedUrl } from "@/lib/storage/use-signed-url";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/challenges", label: "Desafios", icon: Swords },
  { href: "/weekly", label: "Semanal", icon: CalendarDays },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/profile", label: "Perfil", icon: User },
];

interface NavbarProps {
  user: {
    id: string;
    username: string;
    avatar_url: string | null;
    level: number;
    role: string;
  };
}

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Private bucket: generate signed URL for the avatar
  const signedAvatarUrl = useSignedUrl("avatars", user.avatar_url);

  function handleSignOut() {
    // Full-page navigation to the server-side signout route.
    // This ensures auth + cache cookies are cleared atomically before the
    // browser loads /login — avoids a race condition where client-side
    // signOut() clears the session but the navigation request still carries
    // stale cookies, causing the proxy to redirect back to /dashboard.
    window.location.href = "/api/auth/signout";
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg mr-2">
          <Zap className="h-5 w-5 text-violet-500" />
          <span className="hidden sm:inline bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
            DesafioHub
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap",
                pathname.startsWith(href)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden md:inline">{label}</span>
            </Link>
          ))}

          {user.role === "admin" && (
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap",
                pathname.startsWith("/admin")
                  ? "bg-amber-500/10 text-amber-400"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden md:inline">Admin</span>
            </Link>
          )}
        </nav>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="relative h-9 w-9 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Menu do usuário"
          >
            <Avatar className="h-9 w-9">
              <AvatarImage src={signedAvatarUrl ?? undefined} alt={user.username} />
              <AvatarFallback className="text-xs">
                {user.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {/* LevelArt badge — canto superior direito */}
            <div className="absolute -top-1 -right-1 pointer-events-none">
              <LevelArt
                tier={Math.ceil(user.level / 10)}
                level={user.level}
                size={20}
              />
            </div>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-44">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user.username}</p>
              <p className="text-xs text-muted-foreground">Nível {user.level}</p>
            </div>
            <DropdownMenuSeparator />
            {/* Use onClick + router.push instead of asChild */}
            <DropdownMenuItem onClick={() => router.push("/profile")}>
              <User className="mr-2 h-4 w-4" /> Perfil
            </DropdownMenuItem>
            {user.role === "admin" && (
              <DropdownMenuItem onClick={() => router.push("/admin")}>
                <ShieldCheck className="mr-2 h-4 w-4" /> Admin
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-400 focus:text-red-400"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export default Navbar;
