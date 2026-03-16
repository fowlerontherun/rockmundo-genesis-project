import { useGameData } from "@/hooks/useGameData";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useSkillSystem } from "@/hooks/useSkillSystem";
import { SkillSystemProvider } from "@/hooks/SkillSystemProvider";
import { ModelingOffersPanel } from "@/components/modeling/ModelingOffersPanel";

function ModelingInner() {
  const { profileId } = useActiveProfile();
  const { profile } = useGameData();
  const { progress } = useSkillSystem();

  if (!profileId || !profile) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-muted-foreground">Please log in to access modeling.</p>
      </div>
    );
  }

  const skillLevels: Record<string, number> = {};
  for (const p of progress) {
    skillLevels[p.skill_slug] = p.current_level ?? 0;
  }

  const playerLooks = Math.min(100, 50 + Math.floor((profile.fame ?? 0) / 100));
  const playerFame = profile.fame ?? 0;

  return (
    <div className="container mx-auto p-4 max-w-5xl">
      <ModelingOffersPanel
        userId={user.id}
        playerLooks={playerLooks}
        playerFame={playerFame}
        skillLevels={skillLevels}
      />
    </div>
  );
}

export default function Modeling() {
  return (
    <SkillSystemProvider>
      <ModelingInner />
    </SkillSystemProvider>
  );
}
