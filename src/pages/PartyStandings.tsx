import { PartyStandingsGrid, PartyStandingsHeader } from "@/components/parties/PartyStandingsTable";

export default function PartyStandingsPage() {
  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <PartyStandingsHeader />
      <PartyStandingsGrid />
    </div>
  );
}
