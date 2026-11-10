import { isUiPreview } from "@/lib/ui-preview";
import { ClubPreviewPage } from "@/components/club/ClubPreviewPage";
import { LegacyPreviewFrame } from "@/components/club/LegacyPreviewFrame";
import LegacyProfilePage from "./LegacyProfilePage";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const params = await searchParams;
  if (isUiPreview) return params.view === "original"
    ? <LegacyPreviewFrame><LegacyProfilePage /></LegacyPreviewFrame>
    : <ClubPreviewPage screen="perfil" />;
  return <LegacyProfilePage />;
}
