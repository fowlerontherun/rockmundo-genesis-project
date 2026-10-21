import { useQuery } from "@tanstack/react-query";
import { InterviewerStage } from "@/components/pr/InterviewerStage";
import { usePlayerModel, useEquippedRichClothing, usePlayerStageTattoos } from "@/features/player-model/usePlayerModel";
import { useAvatarMerchWearables } from "@/features/player-model/useAvatarMerchWearables";
// Avatar V1's WebGL renderer is loaded only when an interview portrait is needed.
import type { InterviewPresenter, InterviewerMood } from "@/data/interviewPresenters";

type StagePhase = "intro" | "question" | "reaction" | "results";

interface Props {
  presenter: InterviewPresenter;
  mediaType: string;
  outletName: string;
  showName?: string;
  phase: StagePhase;
  questionIndex: number;
  dialogue: string;
  playerLine?: string;
  mood?: InterviewerMood;
}

/** Reuse the existing canonical Avatar V1 capture, not a guessed stand-in or a 2D profile icon. */
export function InterviewScene(props: Props) {
  const model = usePlayerModel();
  const profileId = model.profileId;
  const clothing = useEquippedRichClothing(profileId);
  const tattoos = usePlayerStageTattoos(profileId);
  const merch = useAvatarMerchWearables(profileId);
  const appearance = model.query.data?.appearance;
  const guestName = model.profile?.stage_name || model.profile?.display_name || "You";

  const waitingForLayers = model.query.isPending || model.query.isFetching
    || clothing.isFetching || tattoos.isFetching || merch.query.isFetching;
  const missingLayers = model.query.isError || clothing.isError || tattoos.isError || merch.query.isError;

  // A failed cosmetic layer must not be silently replaced with an incorrect outfit.
  const portrait = useQuery({
    queryKey: ["interview-avatar-v1", model.userId, profileId, model.query.data?.revision, appearance,
      clothing.data, tattoos.data, merch.query.data?.equipped],
    enabled: !!profileId && !!appearance && !waitingForLayers && !missingLayers,
    staleTime: 60_000,
    gcTime: 60_000,
    retry: false,
    queryFn: async () => {
      if (!appearance) throw new Error("No player appearance available");
      const { captureAvatarV1ForShare, captureAvatarCanvas } = await import("@/features/shareable-moments/avatarCapture");
      const canvas = await captureAvatarV1ForShare({
        appearance,
        role: "other",
        richClothing: clothing.data ?? [],
        tattoos: tattoos.data ?? [],
        merchWearable: merch.query.data?.equipped ?? null,
      });
      return captureAvatarCanvas(canvas).dataUrl;
    },
  });

  const guestStatus = missingLayers || portrait.isError || (!profileId && !model.isLoading)
    ? "unavailable" : portrait.data && !waitingForLayers ? "ready" : "loading";

  return (
    <InterviewerStage
      {...props}
      guestName={guestName}
      guestAvatarSrc={guestStatus === "ready" ? portrait.data : null}
      guestStatus={guestStatus}
      onAvatarRetry={() => {
        if (model.query.isError) void model.query.refetch();
        if (clothing.isError) void clothing.refetch();
        if (tattoos.isError) void tattoos.refetch();
        if (merch.query.isError) void merch.query.refetch();
        if (portrait.isError) void portrait.refetch();
      }}
    />
  );
}
