import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const fixture = `import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBandTourTotals } from "@/hooks/useTourStats";

  const queryClient = useQueryClient();

  // Cancel tour mutation
  const cancelTourMutation = useMutation({ mutationFn: async () => supabase.from("bands").update({}) });

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
cancelTourMutation.mutate(selectedTour.id)
cancelTourMutation.isPending
This will permanently cancel"{selectedTour.name}
                              "and delete all associated gigs and travel legs.
`;

describe("migrate-tour-manager-authority-v2", () => {
  it("replaces cancellation and travel mutations with authoritative hooks", () => {
    const directory = mkdtempSync(join(tmpdir(), "tour-manager-authority-v2-"));
    const target = join(directory, "TourManager.tsx");
    writeFileSync(target, fixture);

    execFileSync("node", ["scripts/migrate-tour-manager-authority-v2.mjs", target], {
      cwd: process.cwd(),
    });

    const result = readFileSync(target, "utf8");
    expect(result).toContain("useTourCancellation");
    expect(result).toContain("useTourTravelRepair");
    expect(result).toContain("useTourCatchUp");
    expect(result).toContain("cancelTour.mutate(selectedTour.id");
    expect(result).toContain("setDetailsOpen(false)");
    expect(result).toContain("tour history is retained");
    expect(result).not.toContain("cancelTourMutation");
    expect(result).not.toContain("regenerateTravelLegsMutation");
    expect(result).not.toContain("addNewMemberTravelMutation");
    expect(result).not.toContain("catchUpToTourMutation");
    expect(result).not.toContain('from("bands").update');
    expect(result).not.toContain('from("profiles").update');
  });
});
