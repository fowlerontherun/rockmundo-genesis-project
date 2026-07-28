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
  'import { useTourTravelRepair } from "@/hooks/useTourTravelRepair";\nimport { useTourCatchUp } from "@/hooks/useTourCatchUp";',
);

const startMarker = "  // Regenerate missing travel legs mutation";
const endMarker = "  const { data: otherToursData, isLoading: loadingOtherTours } = useQuery({";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker);

if (start === -1 || end === -1 || end <= start) {
  throw new Error("Could not locate legacy Tour Manager mutation range");
}

const authoritativeMutations = `  const {\n    regenerateTravelLegs,\n    syncMemberTravel,\n  } = useTourTravelRepair();\n  const { catchUp } = useTourCatchUp();\n\n`;

source = source.slice(0, start) + authoritativeMutations + source.slice(end);

const replacements = [
  ["addNewMemberTravelMutation.mutate(selectedTour.id)", "syncMemberTravel.mutate(selectedTour.id)"],
  ["addNewMemberTravelMutation.isPending", "syncMemberTravel.isPending"],
  ["regenerateTravelLegsMutation.mutate(selectedTour.id)", "regenerateTravelLegs.mutate(selectedTour.id)"],
  ["regenerateTravelLegsMutation.isPending", "regenerateTravelLegs.isPending"],
  ["catchUpToTourMutation.mutate(selectedTour.id)", "profileId && catchUp.mutate({ tourId: selectedTour.id, profileId })"],
  ["catchUpToTourMutation.isPending", "catchUp.isPending"],
  ['disabled={catchUp.isPending}', 'disabled={catchUp.isPending || !profileId}'],
];

for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error(`Missing expected source: ${before}`);
  source = source.split(before).join(after);
}

const forbidden = [
  'const regenerateTravelLegsMutation = useMutation',
  'const addNewMemberTravelMutation = useMutation',
  'const catchUpToTourMutation = useMutation',
  '.from("player_travel_history").insert',
  '.from("player_scheduled_activities").insert',
];

for (const token of forbidden) {
  if (source.includes(token)) throw new Error(`Legacy authority remains: ${token}`);
}

await writeFile(target, source, "utf8");
console.log(`Migrated ${target} to authoritative tour travel hooks.`);
