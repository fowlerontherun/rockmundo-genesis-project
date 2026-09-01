import { BandRosterTab as BandRosterCore } from "./BandRosterCore";
import { BandMemberLocations } from "@/components/band/BandMemberLocations";
import { useActiveProfile } from "@/hooks/useActiveProfile";

interface BandRosterTabProps {
  bandId: string;
}

export function BandRosterTab({ bandId }: BandRosterTabProps) {
  const { profileId } = useActiveProfile();

  return (
    <div className="space-y-4">
      <BandMemberLocations bandId={bandId} currentProfileId={profileId} />
      <BandRosterCore bandId={bandId} />
    </div>
  );
}
