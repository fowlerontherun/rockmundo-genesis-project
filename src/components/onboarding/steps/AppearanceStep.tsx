import { useState } from "react";
import { Palette, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SvgCharacterCreator } from "@/components/character-creator";

export const AppearanceStep = () => {
  const [showCreator, setShowCreator] = useState(true);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Palette className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">
          Create Your Look
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Design your character's appearance. You can always change this later.
        </p>
      </div>

      {/* Character creator or skip option */}
      {showCreator ? (
        <div className="mx-auto max-w-4xl">
          <SvgCharacterCreator />
          
          <div className="mt-4 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCreator(false)}
              className="text-muted-foreground"
            >
              <SkipForward className="mr-2 h-4 w-4" />
              Skip for now
            </Button>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-md space-y-4 rounded-lg border border-dashed border-border p-8 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Palette className="h-10 w-10 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">
            You can customize your appearance later from your profile.
          </p>
          <Button
            variant="outline"
            onClick={() => setShowCreator(true)}
          >
            <Palette className="mr-2 h-4 w-4" />
            Create Character Now
          </Button>
        </div>
      )}
    </div>
  );
};
