import type { ReactNode } from "react";
import { Zap } from "lucide-react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-violet-950/20 p-4">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-2 text-2xl font-bold">
        <Zap className="h-7 w-7 text-violet-500" />
        <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
          DesafioHub
        </span>
      </div>

      {children}
    </div>
  );
}
