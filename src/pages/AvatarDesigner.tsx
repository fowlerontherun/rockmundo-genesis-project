import { Sparkles } from "lucide-react";
import { AiAvatarCreator } from "@/components/avatar-system/AiAvatarCreator";

const AvatarDesigner = () => {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 space-y-4">
      <div className="text-center space-y-1">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Avatar Designer</h1>
        <p className="text-sm text-muted-foreground">
          Upload a photo to create your AI avatar
        </p>
      </div>

      <AiAvatarCreator />
    </div>
  );
};

export default AvatarDesigner;
