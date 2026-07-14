import { useParams } from "react-router-dom";
import GearGigHistoryPanel, { GearKind } from "@/components/gear/GearGigHistoryPanel";

const kinds: GearKind[] = ["band_stage", "personal", "player_equipment"];

export default function GearHistoryPublic() {
  const { kind, id } = useParams<{ kind: string; id: string }>();
  const validKind = kinds.includes(kind as GearKind) ? (kind as GearKind) : null;

  if (!validKind || !id) {
    return <div className="p-6 text-sm text-muted-foreground">Invalid gear reference.</div>;
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Gear Gig History</h1>
      <GearGigHistoryPanel gearKind={validKind} gearId={id} />
    </div>
  );
}
