import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus } from "lucide-react";
import { PageLayout } from "@/components/ui/PageLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { CreateReleaseDialog } from "@/components/releases/CreateReleaseDialog";
import { MyReleasesTab } from "@/components/releases/MyReleasesTab";
import { ReleaseSalesTab } from "@/components/releases/ReleaseSalesTab";
import { useAutoReleaseManufacturing } from "@/hooks/useAutoReleaseManufacturing";
import { useTranslation } from "@/hooks/useTranslation";

export default function ReleaseManager() {
  const navigate = useNavigate();
  const { profileId } = useActiveProfile();
  const { t } = useTranslation();
  const userId = profileId;
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get("tab");
  const validTabs = new Set(["releases", "sales"]);
  const currentTab = validTabs.has(tabParam ?? "") ? (tabParam as string) : "releases";

  const handleTabChange = (value: string) => {
    const nextTab = validTabs.has(value) ? value : "releases";
    const params = new URLSearchParams(searchParams);

    if (nextTab === "releases") {
      params.delete("tab");
    } else {
      params.set("tab", nextTab);
    }

    setSearchParams(params, { replace: true });
  };

  // Auto-check for completed manufacturing
  useAutoReleaseManufacturing(userId || null);

  if (!userId) {
    return (
      <div className="container mx-auto p-6">
        <p>{t('releases.pleaseLogin')}</p>
      </div>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        title={t('releases.title')}
        subtitle={t('releases.description')}
        backTo="/hub/music"
        backLabel={t('releases.backToMusicHub')}
        actions={
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('releases.newRelease')}
          </Button>
        }
      />

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="releases">{t('releases.myReleases')}</TabsTrigger>
          <TabsTrigger value="sales">{t('releases.salesRevenue')}</TabsTrigger>
        </TabsList>

        <TabsContent value="releases" className="mt-6">
          <MyReleasesTab userId={userId} />
        </TabsContent>

        <TabsContent value="sales" className="mt-6">
          <ReleaseSalesTab userId={userId} />
        </TabsContent>
      </Tabs>

      <CreateReleaseDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        userId={userId}
      />
    </PageLayout>
  );
}
