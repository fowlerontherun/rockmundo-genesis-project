import { useMemo, type ElementType } from "react";
import {
  Cake,
  CalendarDays,
  MapPin,
  Mic,
  Music,
  Sparkles,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useGameData, type PlayerProfile } from "@/hooks/useGameData";

const formatDate = (input: string | null | undefined) => {
  if (!input) {
    return null;
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleDateString();
};

const sanitizeSkillLabel = (label: string) =>
  label
    .replace(/_/g, " ")
    .split(" ")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const PROFILE_META_FIELDS: Array<{ key: keyof PlayerProfile; label: string; icon: ElementType }> = [
  { key: "current_location", label: "Hometown", icon: MapPin },
  { key: "age", label: "Age", icon: Cake },
  { key: "genre", label: "Primary Genre", icon: Music },
  { key: "fame", label: "Fame", icon: Sparkles },
  { key: "fans", label: "Fans", icon: Users },
];

const HIDDEN_SKILL_FIELDS = new Set(["id", "user_id", "created_at", "updated_at"]);

const MyCharacter = () => {
  const { profile, skills, loading, error, currentCity } = useGameData();

  const displayName = profile?.display_name || profile?.username || "Performer";

  const profileInitials = useMemo(() => {
    const source = displayName;
    if (!source) {
      return "RM";
    }

    return source
      .split(" ")
      .map((segment) => segment.charAt(0).toUpperCase())
      .join("")
      .slice(0, 2) || "RM";
  }, [displayName]);

  const currentCityLabel = useMemo(() => {
    if (!currentCity) {
      return null;
    }

    if (currentCity.country && currentCity.country.trim().length > 0) {
      return `${currentCity.name}, ${currentCity.country}`;
    }

    return currentCity.name ?? null;
  }, [currentCity]);

  if (loading) {
    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center p-6">
        <p className="text-lg font-semibold">Loading your character...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Unable to load your character</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center p-6">
        <Card className="max-w-lg text-center">
          <CardHeader>
            <CardTitle>Create your artist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-muted-foreground">
            <p>Set up your performer details to unlock the rest of Rockmundo.</p>
            <p className="text-sm">Head to the onboarding flow to choose a name and hometown.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const joinedDate = formatDate(profile.created_at);
  const updatedDate = formatDate(profile.updated_at);

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Character</h1>
          <p className="text-muted-foreground">A snapshot of your artist profile and core skills.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="text-base">
            Level {profile.level ?? 1}
          </Badge>
          {typeof profile.experience === "number" && (
            <Badge variant="secondary" className="text-base">
              {profile.experience.toLocaleString()} XP
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px),1fr]">
        <Card>
          <CardHeader className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary">
              {profileInitials}
            </div>
            <div className="mt-4 space-y-1">
              <h2 className="text-2xl font-semibold">{displayName}</h2>
              {profile.username && profile.username !== displayName && (
                <p className="text-sm text-muted-foreground">@{profile.username}</p>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile.bio ? (
              <p className="text-sm text-muted-foreground">{profile.bio}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Add a bio to share your origin story.</p>
            )}

            <Separator />

            <div className="space-y-3 text-sm">
              {PROFILE_META_FIELDS.map(({ key, label, icon: Icon }) => {
                const value = profile[key];

                if (value === null || value === undefined || value === "") {
                  return null;
                }

                return (
                  <div key={key as string} className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{label}:</span>
                    <span className="text-muted-foreground">{String(value)}</span>
                  </div>
                );
              })}
              {currentCityLabel && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Current City:</span>
                  <span className="text-muted-foreground">{currentCityLabel}</span>
                </div>
              )}
              {joinedDate && (
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Joined:</span>
                  <span className="text-muted-foreground">{joinedDate}</span>
                </div>
              )}
              {updatedDate && (
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Last Active:</span>
                  <span className="text-muted-foreground">{updatedDate}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Player Skills
            </CardTitle>
          </CardHeader>
          <CardContent>
            {skills ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Object.entries(skills).map(([skillKey, score]) => {
                  if (HIDDEN_SKILL_FIELDS.has(skillKey)) {
                    return null;
                  }

                  const displayScore = typeof score === "number" ? score : 0;

                  return (
                    <div key={skillKey} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{sanitizeSkillLabel(skillKey)}</span>
                        <Badge variant="secondary">{displayScore}</Badge>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-2 rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(100, Math.max(0, displayScore))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground">No skill data available yet. Start performing to earn stats!</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MyCharacter;
