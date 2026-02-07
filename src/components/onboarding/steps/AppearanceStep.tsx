import { useState } from "react";
import { Palette, SkipForward, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiAvatarCreator } from "@/components/avatar-system/AiAvatarCreator";
import { SvgCharacterCreator } from "@/components/character-creator";

export const AppearanceStep = () => {
  const [mode, setMode] = useState<"ai" | "classic" | "skipped">("ai");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">
          Create Your Look
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a photo to generate your AI avatar, or use the classic creator. You can always change this later.
        </p>
      </div>

      {mode === "ai" && (
        <div className="mx-auto max-w-4xl">
          <AiAvatarCreator onSwitchToClassic={() => setMode("classic")} />
          <div className="mt-4 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMode("skipped")}
              className="text-muted-foreground"
            >
              <SkipForward className="mr-2 h-4 w-4" />
              Skip for now
            </Button>
          </div>
        </div>
      )}

      {mode === "classic" && (
        <div className="mx-auto max-w-4xl">
          <SvgCharacterCreator />
          <div className="mt-4 flex justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMode("ai")}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Use AI Avatar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMode("skipped")}
              className="text-muted-foreground"
            >
              <SkipForward className="mr-2 h-4 w-4" />
              Skip for now
            </Button>
          </div>
        </div>
      )}

      {mode === "skipped" && (
        <div className="mx-auto max-w-md space-y-4 rounded-lg border border-dashed border-border p-8 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Palette className="h-10 w-10 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">
            You can customize your appearance later from your profile.
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => setMode("ai")}>
              <Sparkles className="mr-2 h-4 w-4" />
              AI Avatar
            </Button>
            <Button variant="outline" onClick={() => setMode("classic")}>
              <Palette className="mr-2 h-4 w-4" />
              Classic Creator
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
