import { Trophy } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { PartyStandingsGrid, PartyStandingsHeader } from "@/components/parties/PartyStandingsTable";

export default function PartyStandingsPage() {
  return (
    <FMPageScaffold
      title="Party Standings"
      icon={Trophy}
      backTo="/political-party"
      backLabel="Back to Parties"
    >
      <PartyStandingsHeader />
      <PartyStandingsGrid />
    </FMPageScaffold>
  );
}
