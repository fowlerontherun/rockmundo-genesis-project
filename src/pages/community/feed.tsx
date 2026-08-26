import { useState } from "react";
import { Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { SocialCompetitionPanel } from "@/features/social/components/SocialCompetitionPanel";
import CommunityFeedTimeline from "./CommunityFeedTimeline";

const CommunityFeedPage = () => {
  const [view, setView] = useState<"feed" | "competition">("feed");

  if (view === "feed") {
    return (
      <div className="space-y-3">
        <div className="mx-auto flex max-w-3xl justify-end gap-2 px-4 pt-2">
          <Button size="sm" variant="default" onClick={() => setView("feed")}><Users className="mr-2 h-4 w-4" />Community Feed</Button>
          <Button size="sm" variant="outline" onClick={() => setView("competition")}><Trophy className="mr-2 h-4 w-4" />Social Competition</Button>
        </div>
        <CommunityFeedTimeline />
      </div>
    );
  }

  return (
    <FMPageScaffold title="Social Competition" subtitle="Opt-in rivalries, seasonal competition and player communities." icon={Trophy} backTo="/hub/social" className="max-w-4xl">
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => setView("feed")}><Users className="mr-2 h-4 w-4" />Community Feed</Button>
        <Button size="sm" variant="default" onClick={() => setView("competition")}><Trophy className="mr-2 h-4 w-4" />Social Competition</Button>
      </div>
      <SocialCompetitionPanel />
    </FMPageScaffold>
  );
};

export default CommunityFeedPage;
