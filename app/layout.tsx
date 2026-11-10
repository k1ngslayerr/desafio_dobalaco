import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./ui-lab/ui-lab.css";
import "@/components/appearance/appearance.css";
import { AppearanceProvider } from "@/components/appearance/AppearanceProvider";
import { appearanceBootstrap } from "@/lib/appearance";
import { Toaster } from "@/components/ui/sonner";
import { UIPreviewNav } from "@/components/UIPreviewNav";
import { isUiPreview } from "@/lib/ui-preview";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "DesafioHub",
    template: "%s | DesafioHub",
  },
  description:
    "Plataforma gamificada de desafios com sistema de XP, níveis e ranking em tempo real.",
  keywords: ["desafio", "gamificação", "xp", "ranking"],
  // [SECURITY] Prevent search engine indexing until publicly launched
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // Dark mode is applied by default via className="dark"
    <html lang="pt-BR" className={`dark ${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: appearanceBootstrap }} /></head>
      <body className="min-h-screen antialiased bg-background text-foreground">
        <AppearanceProvider>
        {children}
        {isUiPreview && <UIPreviewNav />}

        {/* Global toast notification system */}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{ duration: 4000 }}
        />
        </AppearanceProvider>
      </body>
    </html>
  );
}
