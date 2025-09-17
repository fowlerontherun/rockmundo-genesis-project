import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useGameData } from "@/hooks/useGameData";
import { Sparkles, User, Music } from "lucide-react";

const CharacterCreation = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, updateProfile, loading, refetch } = useGameData();

  const [formData, setFormData] = useState({
    display_name: "",
    username: "",
    bio: ""
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        display_name: profile.display_name || "",
        username: profile.username || "",
        bio: profile.bio || ""
      });
    }
  }, [profile]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!profile) return;

    setSaving(true);

    try {
      await updateProfile(formData);
      await refetch();

      if (typeof window !== "undefined") {
        window.localStorage.setItem("rockmundo:needsOnboarding", "false");
      }

      toast({
        title: "Character ready!",
        description: "Your new persona is set. Let's take the stage.",
      });

      navigate("/dashboard", { replace: true });
    } catch (error: unknown) {
      const fallbackMessage = "Failed to save character details";
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error("Error completing character creation:", errorMessage, error);
      toast({
        variant: "destructive",
        title: "Setup error",
        description: errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage}: ${errorMessage}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("rockmundo:needsOnboarding", "false");
    }

    navigate("/dashboard", { replace: true });
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
          <p className="text-lg font-oswald text-muted-foreground">Preparing your fresh start...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-primary text-sm font-semibold uppercase tracking-widest">
            <Sparkles className="h-4 w-4" />
            Character Creation
          </div>
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Craft Your New Musical Identity
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Your previous progress has been archived. Set the tone for your comeback with a fresh name, look, and story before diving back into Rockmundo.
          </p>
        </div>

        <Card className="bg-card/80 backdrop-blur border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Player Details
            </CardTitle>
            <CardDescription>Introduce the world to your brand-new persona.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="displayName">Stage Name</Label>
                <Input
                  id="displayName"
                  value={formData.display_name}
                  onChange={(event) => setFormData((previous) => ({ ...previous, display_name: event.target.value }))}
                  required
                  placeholder="e.g. Aurora Blaze"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(event) => setFormData((previous) => ({ ...previous, username: event.target.value }))}
                  required
                  placeholder="Choose something unique"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Backstory</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(event) => setFormData((previous) => ({ ...previous, bio: event.target.value }))}
                  rows={5}
                  placeholder="Share your origins, influences, or ambitions."
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Music className="h-4 w-4 text-primary" />
                  We'll reopen the full game once your persona is saved.
                </p>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={handleSkip} disabled={saving}>
                    Skip for now
                  </Button>
                  <Button type="submit" className="bg-gradient-primary" disabled={saving}>
                    {saving ? "Saving..." : "Launch New Career"}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CharacterCreation;
