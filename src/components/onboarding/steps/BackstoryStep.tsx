import { useState } from "react";
import { BookOpen, RefreshCw, Loader2, Sparkles, Check, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import type { OnboardingData } from "../OnboardingWizard";
import type { CharacterOrigin, PersonalityTrait } from "@/types/roleplaying";

interface BackstoryStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  origins: CharacterOrigin[];
  traits: PersonalityTrait[];
}

export const BackstoryStep = ({
  data,
  updateData,
  origins,
  traits,
}: BackstoryStepProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(data.backstoryText);
  const { profileId } = useActiveProfile();

  const { data: avatarProfile } = useQuery({
    queryKey: ["onboarding-avatar-preview", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", profileId)
        .maybeSingle();
      return data as { avatar_url: string | null } | null;
    },
    enabled: !!profileId,
  });

  const selectedOrigin = origins.find((o) => o.id === data.originId);
  const selectedTraits = traits.filter((t) => data.traitIds.includes(t.id));
  const displayName = data.artistName || data.displayName || "You";

  const generateBackstory = async () => {
    setIsGenerating(true);

    try {
      // Call edge function to generate backstory
      const { data: result, error } = await supabase.functions.invoke(
        "generate-backstory",
        {
          body: {
            displayName: data.displayName,
            artistName: data.artistName,
            originKey: selectedOrigin?.key,
            originName: selectedOrigin?.name,
            originDescription: selectedOrigin?.description,
            traitNames: selectedTraits.map((t) => t.name),
            traitDescriptions: selectedTraits.map((t) => t.description),
            musicalStyle: data.musicalStyle,
            careerGoal: data.careerGoal,
          },
        }
      );

      if (error) throw error;

      const backstory = result?.backstory || generateFallbackBackstory();
      updateData({ backstoryText: backstory });
      setEditedText(backstory);
    } catch (err) {
      console.error("Failed to generate backstory:", err);
      // Use fallback
      const fallback = generateFallbackBackstory();
      updateData({ backstoryText: fallback });
      setEditedText(fallback);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateFallbackBackstory = () => {
    const name = data.artistName || data.displayName;
    const origin = selectedOrigin?.name || "humble beginnings";
    const style = data.musicalStyle || "eclectic sound";
    const traitList = selectedTraits.map((t) => t.name.toLowerCase()).join(" and ");

    return `${name} emerged from ${origin.toLowerCase()}, carrying the raw passion of someone who discovered music as both escape and salvation. Known for a ${traitList} approach to the craft, they developed a distinctive ${style} that refuses to fit neatly into any single genre.

The road ahead is uncertain, but one thing is clear: this is just the beginning of a story that will be told for generations. Every setback is a lesson. Every small venue is a step toward the stadium. The world doesn't know it yet, but they're about to discover a new voice that won't be silenced.`;
  };

  const handleSaveEdit = () => {
    updateData({ backstoryText: editedText });
    setIsEditing(false);
  };

  // Auto-generate if empty
  const hasBackstory = data.backstoryText.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <BookOpen className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Your Story So Far</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every legend has an origin. Here's yours.
        </p>
      </div>

      {/* Avatar + identity preview */}
      <Card className="bg-muted/30">
        <CardContent className="flex items-center gap-4 p-4">
          <Avatar className="h-20 w-20 border-2 border-primary/30">
            {avatarProfile?.avatar_url ? (
              <AvatarImage src={avatarProfile.avatar_url} alt={displayName} />
            ) : null}
            <AvatarFallback>
              <User className="h-8 w-8 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Profile</p>
            <p className="truncate text-lg font-semibold">{displayName}</p>
            <p className="text-xs text-muted-foreground">
              {avatarProfile?.avatar_url
                ? "Avatar saved to your profile"
                : "No avatar set — you can add one any time from the Avatar Designer"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Summary of choices */}
      <Card className="bg-muted/30">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Origin</p>
            <p className="font-medium">{selectedOrigin?.name ?? "Not selected"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Style</p>
            <p className="font-medium">{data.musicalStyle || "Not defined"}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Traits</p>
            <div className="flex flex-wrap gap-1">
              {selectedTraits.map((trait) => (
                <Badge key={trait.id} variant="secondary" className="text-xs">
                  {trait.name}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Backstory display/editor */}
      {!hasBackstory ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <Sparkles className="mx-auto mb-4 h-8 w-8 text-primary/50" />
          <p className="mb-4 text-muted-foreground">
            Generate your unique backstory based on your choices.
          </p>
          <Button onClick={generateBackstory} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Crafting your story...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Backstory
              </>
            )}
          </Button>
        </div>
      ) : isEditing ? (
        <div className="space-y-3">
          <Textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="min-h-[200px] resize-none"
            placeholder="Write your backstory..."
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              <Check className="mr-2 h-4 w-4" />
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-card p-6">
            <p className="whitespace-pre-line leading-relaxed text-foreground">
              {data.backstoryText}
            </p>
          </div>
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditedText(data.backstoryText);
                setIsEditing(true);
              }}
            >
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={generateBackstory}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Regenerate
            </Button>
          </div>
        </div>
      )}

      {/* Ready message */}
      {hasBackstory && !isEditing && (
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Your journey is ready to begin. Click{" "}
            <span className="font-medium text-primary">Begin Journey</span> to
            start your career.
          </p>
        </div>
      )}
    </div>
  );
};
