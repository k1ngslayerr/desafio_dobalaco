import { notFound } from "next/navigation";
import { isUiPreview } from "@/lib/ui-preview";
import { getPreviewData, previewChallenges, previewUser } from "@/lib/preview/data";
import { DesignLab, type LabScreen } from "@/components/design-lab/DesignLab";
import "./ui-lab.css";

export const dynamic = "force-dynamic";

export default async function UILabPage({ searchParams }: {
  searchParams: Promise<{ direction?: string; screen?: string }>;
}) {
  if (!isUiPreview) notFound();
  const params = await searchParams;
  const direction = params.direction === "arena" ? "arena" : "clube";
  const screen: LabScreen = ["desafios", "ranking", "perfil"].includes(params.screen ?? "")
    ? params.screen as LabScreen : "feed";
  const data = getPreviewData();
  return <DesignLab key={`${direction}-${screen}`} direction={direction} screen={screen}
    user={previewUser} users={data.users} challenges={previewChallenges} />;
}
