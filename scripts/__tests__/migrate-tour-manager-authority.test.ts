import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const fixture = `import { useBandTourTotals } from "@/hooks/useTourStats";

const queryClient = useQueryClient();

  // Regenerate missing travel legs mutation
  const regenerateTravelLegsMutation = useMutation({ mutationFn: async () => supabase.from("tour_travel_legs").insert([]) });
  const addNewMemberTravelMutation = useMutation({ mutationFn: async () => supabase.from("player_travel_history").insert({}) });
  const catchUpToTourMutation = useMutation({ mutationFn: async () => supabase.from("profiles").update({}) });

  const { data: otherToursData, isLoading: loadingOtherTours } = useQuery({});

addNewMemberTravelMutation.mutate(selectedTour.id)
addNewMemberTravelMutation.isPending
regenerateTravelLegsMutation.mutate(selectedTour.id)
regenerateTravelLegsMutation.isPending
catchUpToTourMutation.mutate(selectedTour.id)
catchUpToTourMutation.isPending
disabled={catchUpToTourMutation.isPending}
`;

describe("migrate-tour-manager-authority", () => {
  it("replaces all three browser-authoritative mutations with hooks", () => {
    const directory = mkdtempSync(join(tmpdir(), "tour-manager-codemod-"));
    const target = join(directory, "TourManager.tsx");
    writeFileSync(target, fixture);

    execFileSync("node", ["scripts/migrate-tour-manager-authority.mjs", target], {
      cwd: process.cwd(),
    });

    const result = readFileSync(target, "utf8");
    expect(result).toContain('useTourTravelRepair');
    expect(result).toContain('useTourCatchUp');
    expect(result).toContain('syncMemberTravel.mutate(selectedTour.id)');
    expect(result).toContain('regenerateTravelLegs.mutate(selectedTour.id)');
    expect(result).toContain('catchUp.mutate({ tourId: selectedTour.id, profileId })');
    expect(result).not.toContain('addNewMemberTravelMutation');
    expect(result).not.toContain('regenerateTravelLegsMutation');
    expect(result).not.toContain('catchUpToTourMutation');
  });
});
