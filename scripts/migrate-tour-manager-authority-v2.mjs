import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const target = process.argv[2] ?? "src/pages/TourManager.tsx";
let source = await readFile(target, "utf8");

const addImport = (anchor, addition) => {
  if (!source.includes(addition.trim())) {
    if (!source.includes(anchor)) throw new Error(`Missing import anchor: ${anchor}`);
    source = source.replace(anchor, `${anchor}\n${addition}`);
  }
};

addImport(
  'import { useBandTourTotals } from "@/hooks/useTourStats";',
  'import { useTourTravelRepair } from "@/hooks/useTourTravelRepair";\nimport { useTourCatchUp } from "@/hooks/useTourCatchUp";\nimport { useTourCancellation } from "@/hooks/useTourCancellation";',
);

source = source.replace(
  'import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";',
  'import { useQuery } from "@tanstack/react-query";',
);
source = source.replace('  const queryClient = useQueryClient();\n\n', '');

const cancellationStart = source.indexOf("  // Cancel tour mutation");
const travelStart = source.indexOf("  // Regenerate missing travel legs mutation");
const mutationsEnd = source.indexOf(
  "  const { data: otherToursData, isLoading: loadingOtherTours } = useQuery({",
);

if (
  cancellationStart === -1 ||
  travelStart === -1 ||
  mutationsEnd === -1 ||
  !(cancellationStart < travelStart && travelStart < mutationsEnd)
) {
  throw new Error("Could not locate legacy Tour Manager mutation ranges");
}

const authoritativeHooks = `  const { cancelTour } = useTourCancellation();\n  const {\n    regenerateTravelLegs,\n    syncMemberTravel,\n  } = useTourTravelRepair();\n  const { catchUp } = useTourCatchUp();\n\n`;

source =
  source.slice(0, cancellationStart) +
  authoritativeHooks +
  source.slice(mutationsEnd);

const replacements = [
  ["addNewMemberTravelMutation.mutate(selectedTour.id)", "syncMemberTravel.mutate(selectedTour.id)"],
  ["addNewMemberTravelMutation.isPending", "syncMemberTravel.isPending"],
  ["regenerateTravelLegsMutation.mutate(selectedTour.id)", "regenerateTravelLegs.mutate(selectedTour.id)"],
  ["regenerateTravelLegsMutation.isPending", "regenerateTravelLegs.isPending"],
  ["catchUpToTourMutation.mutate(selectedTour.id)", "profileId && catchUp.mutate({ tourId: selectedTour.id, profileId })"],
  ["catchUpToTourMutation.isPending", "catchUp.isPending"],
  ['disabled={catchUp.isPending}', 'disabled={catchUp.isPending || !profileId}'],
  [
    "cancelTourMutation.mutate(selectedTour.id)",
    "cancelTour.mutate(selectedTour.id, { onSuccess: () => { setDetailsOpen(false); setSelectedTour(null); } })",
  ],
  ["cancelTourMutation.isPending", "cancelTour.isPending"],
  [
    'This will permanently cancel"{selectedTour.name}\n                              "and delete all associated gigs and travel legs.',
    'This will cancel {selectedTour.name}. Future gigs and travel will be cancelled, while tour history is retained.',
  ],
];

for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error(`Missing expected source: ${before}`);
  source = source.split(before).join(after);
}

const forbidden = [
  "const cancelTourMutation = useMutation",
  "const regenerateTravelLegsMutation = useMutation",
  "const addNewMemberTravelMutation = useMutation",
  "const catchUpToTourMutation = useMutation",
  '.from("player_travel_history").insert',
  '.from("player_scheduled_activities").insert',
  '.from("tour_travel_legs").insert',
  '.from("profiles").update',
  '.from("bands").update',
  'delete all associated gigs and travel legs',
];

for (const token of forbidden) {
  if (source.includes(token)) throw new Error(`Legacy authority remains: ${token}`);
}

await writeFile(target, source, "utf8");
console.log(`Migrated ${target} to authoritative tour management hooks.`);
