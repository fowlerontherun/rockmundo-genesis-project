import { Camera } from "lucide-react";
import { useGameData } from "@/hooks/useGameData";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useSkillSystem } from "@/hooks/useSkillSystem";
import { SkillSystemProvider } from "@/hooks/SkillSystemProvider";
import { ModelingOffersPanel } from "@/components/modeling/ModelingOffersPanel";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";

function ModelingInner() {
  const { profileId } = useActiveProfile();
  const { profile } = useGameData();
  const { progress } = useSkillSystem();

  if (!profileId || !profile) {
    return (
      <FMPageScaffold title="Modeling" subtitle="Sign in to access modeling offers." icon={Camera} backTo="/hub/career">
        <p className="text-muted-foreground text-sm">Please log in to access modeling.</p>
      </FMPageScaffold>
    );
  }

  const skillLevels: Record<string, number> = {};
  for (const p of progress) {
    skillLevels[p.skill_slug] = p.current_level ?? 0;
  }

  const playerLooks = Math.min(100, 50 + Math.floor((profile.fame ?? 0) / 100));
  const playerFame = profile.fame ?? 0;

  return (
    <FMPageScaffold
      title="Modeling"
      subtitle="Review offers, book shoots, and grow your fashion fame."
      icon={Camera}
      backTo="/hub/career"
    >
      <ModelingOffersPanel
        userId={profileId}
        playerLooks={playerLooks}
        playerFame={playerFame}
        skillLevels={skillLevels}
      />
    </FMPageScaffold>
  );
}

export default function Modeling() {
  return (
    <SkillSystemProvider>
      <ModelingInner />
    </SkillSystemProvider>
  );
}
