import { useParams } from "react-router-dom";
import { Tent } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFestivalFeatureFlags } from "../config/featureFlags";

const FestivalCompanySetupPlaceholder = () => {
  const { festivalCompanyId } = useParams();
  const flags = useFestivalFeatureFlags();

  if (!flags.newFestivalSystemEnabled || !flags.festivalCreationEnabled) {
    return <FMPageScaffold title="Festival setup unavailable" subtitle="The new festival system is not enabled yet." icon={Tent} backTo="/my-companies" />;
  }

  return (
    <FMPageScaffold title="Festival company founded" subtitle="Secure founding is complete." icon={Tent} backTo="/my-companies">
      <Card>
        <CardHeader><CardTitle>Setup wizard coming next</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-muted-foreground">
          <p>Festival company ID: {festivalCompanyId}</p>
          <p>Your festival company now exists with a $0 company balance. The full configuration wizard for month, location, vibe, site type, duration and first annual edition belongs to the next PR.</p>
        </CardContent>
      </Card>
    </FMPageScaffold>
  );
};

export default FestivalCompanySetupPlaceholder;
