import { Sparkles } from "lucide-react";
import { AiAvatarCreator } from "@/components/avatar-system/AiAvatarCreator";

export const AppearanceStep = () => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Create Your Look</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a photo to generate your AI avatar. You can always change this later.
        </p>
      </div>

      <div className="mx-auto max-w-4xl">
        <AiAvatarCreator />
      </div>
    </div>
  );
};
