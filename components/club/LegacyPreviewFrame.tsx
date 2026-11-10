import type { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { previewUser } from "@/lib/preview/data";

// Keeps the previous UI reachable during the frontend migration, including
// controls (agenda, history, management) that are outside this theme feature.
export function LegacyPreviewFrame({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background"><Navbar user={previewUser} />
    <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
  </div>;
}
