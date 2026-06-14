import { Sparkles } from "lucide-react";
import { AiAvatarCreator } from "@/components/avatar-system/AiAvatarCreator";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";

const AvatarDesigner = () => {
  return (
    <FMPageScaffold
      title="Avatar Designer"
      subtitle="Upload a photo to create your AI avatar"
      icon={Sparkles}
      backTo="/hub/character"
    >
      <AiAvatarCreator />
    </FMPageScaffold>
  );
};

export default AvatarDesigner;
