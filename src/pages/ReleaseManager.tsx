import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth-context";
import { CreateReleaseDialog } from "@/components/releases/CreateReleaseDialog";
import { MyReleasesTab } from "@/components/releases/MyReleasesTab";
import { ReleaseSalesTab } from "@/components/releases/ReleaseSalesTab";
import { useAutoReleaseManufacturing } from "@/hooks/useAutoReleaseManufacturing";
import { ReleaseTestTools } from "@/components/releases/ReleaseTestTools";

export default function ReleaseManager() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id;
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
        <p>Please log in to manage releases.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate("/music-hub")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Music Hub
        </Button>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Release
        </Button>
      </div>

      <div>
        <h1 className="text-4xl font-bold mb-2">Release Manager</h1>
        <p className="text-muted-foreground">
          Create and manage Singles, EPs, and Albums across Digital, CD, Vinyl, and Streaming formats
        </p>
      </div>

      <ReleaseTestTools />

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="releases">My Releases</TabsTrigger>
          <TabsTrigger value="sales">Sales & Revenue</TabsTrigger>
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
    </div>
  );
}
