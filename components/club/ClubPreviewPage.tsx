import { DesignLab, type LabScreen } from "@/components/design-lab/DesignLab";
import { getPreviewData, previewChallenges, previewUser } from "@/lib/preview/data";

export function ClubPreviewPage({ screen }: { screen: LabScreen }) {
  return <DesignLab direction="clube" mode="app" screen={screen}
    user={previewUser} users={getPreviewData().users} challenges={previewChallenges} />;
}
