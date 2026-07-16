import { useState } from "react";
import {
  Skull,
  Baby,
  Sparkles,
  Loader2,
  HeartPulse,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Trophy,
  Coins,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import type { DeadCharacter } from "@/hooks/useCharacterDeath";

interface CharacterDeathScreenProps {
  deadCharacter: DeadCharacter;
  onResurrect: (profileId: string) => void;
  onCreateChild: (parentId: string, opts: { displayName: string; username: string }) => void;
  onCreateFresh: (opts: { displayName: string; username: string }) => void;
  isLoading: boolean;
}

type WizardStep = "welcome" | "choose" | "configure" | "confirm";
type Choice = "resurrect" | "child" | "fresh";

const slugifyUsername = (input: string) =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);

export function CharacterDeathScreen({
  deadCharacter,
  onResurrect,
  onCreateChild,
  onCreateFresh,
  isLoading,
}: CharacterDeathScreenProps) {
  const [step, setStep] = useState<WizardStep>("welcome");
  const [choice, setChoice] = useState<Choice | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameEdited, setUsernameEdited] = useState(false);

  const skillCount = Object.keys(deadCharacter.final_skills || {}).length;
  const inheritedCash = Math.floor(deadCharacter.total_cash_at_death * 0.5);
  const livesRemaining = deadCharacter.resurrection_lives ?? 0;

  const stepIndex: Record<WizardStep, number> = {
    welcome: 1,
    choose: 2,
    configure: 3,
    confirm: 4,
  };
  const totalSteps = 4;
  const currentStepNum = stepIndex[step];

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    if (!usernameEdited) setUsername(slugifyUsername(value));
  };

  const validName = displayName.trim().length >= 2 && username.trim().length >= 3;

  const canAdvance = (): boolean => {
    if (step === "welcome") return true;
    if (step === "choose") return choice !== null;
    if (step === "configure") return choice === "resurrect" ? true : validName;
    return false;
  };

  const goNext = () => {
    if (step === "welcome") setStep("choose");
    else if (step === "choose") setStep("configure");
    else if (step === "configure") setStep("confirm");
  };
  const goBack = () => {
    if (step === "confirm") setStep("configure");
    else if (step === "configure") setStep("choose");
    else if (step === "choose") setStep("welcome");
  };

  const handleConfirm = () => {
    if (choice === "resurrect") onResurrect(deadCharacter.profile_id);
    else if (choice === "child")
      onCreateChild(deadCharacter.id, { displayName: displayName.trim(), username: username.trim() });
    else if (choice === "fresh")
      onCreateFresh({ displayName: displayName.trim(), username: username.trim() });
  };

  const diedAgo = deadCharacter.died_at
    ? formatDistanceToNow(new Date(deadCharacter.died_at), { addSuffix: true })
    : "recently";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-stage px-4 py-8">
      <div className="w-full max-w-lg space-y-4">
        {/* Progress */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium uppercase tracking-wider">
            Returning Player · Step {currentStepNum} of {totalSteps}
          </span>
          <span>
            {step === "welcome" && "Welcome back"}
            {step === "choose" && "Choose your path"}
            {step === "configure" && (choice === "resurrect" ? "Review" : "Name your character")}
            {step === "confirm" && "Confirm"}
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(currentStepNum / totalSteps) * 100}%` }}
          />
        </div>

        {/* Step 1: Welcome / Memorial */}
        {step === "welcome" && (
          <Card className="border-destructive/30 bg-card/95">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/20">
                <Skull className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-2xl font-oswald text-destructive">
                Welcome back to RockMundo
              </CardTitle>
              <p className="text-sm text-muted-foreground pt-2">
                Your last character passed away {diedAgo}. Take a moment to reflect
                before starting your next chapter.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 p-3">
                <Avatar className="h-14 w-14 border-2 border-destructive/30">
                  <AvatarImage src={deadCharacter.avatar_url || undefined} />
                  <AvatarFallback className="bg-destructive/20 text-destructive font-bold text-lg">
                    {(deadCharacter.character_name || "?")[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold truncate">{deadCharacter.character_name}</h3>
                  <p className="text-xs text-muted-foreground">
                    Cause: {deadCharacter.cause_of_death}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {deadCharacter.generation_number > 1 && (
                      <Badge variant="outline" className="text-[10px]">
                        Gen {deadCharacter.generation_number}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px]">
                      {livesRemaining}/3 lives left
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/50 p-3">
                  <Trophy className="mx-auto h-4 w-4 text-amber-500 mb-1" />
                  <div className="text-[10px] text-muted-foreground uppercase">Fame</div>
                  <div className="font-bold text-sm">
                    {(deadCharacter.total_fame || 0).toLocaleString()}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <Coins className="mx-auto h-4 w-4 text-emerald-500 mb-1" />
                  <div className="text-[10px] text-muted-foreground uppercase">Cash</div>
                  <div className="font-bold text-sm">
                    ${(deadCharacter.total_cash_at_death || 0).toLocaleString()}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <BookOpen className="mx-auto h-4 w-4 text-primary mb-1" />
                  <div className="text-[10px] text-muted-foreground uppercase">Skills</div>
                  <div className="font-bold text-sm">{skillCount}</div>
                </div>
              </div>

              <p className="text-xs text-center text-muted-foreground italic">
                Immortalized in the Hall of Immortals.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Choose */}
        {step === "choose" && (
          <div className="grid gap-3">
            {livesRemaining > 0 && (
              <ChoiceCard
                active={choice === "resurrect"}
                onClick={() => setChoice("resurrect")}
                icon={<HeartPulse className="h-5 w-5 text-emerald-500" />}
                iconBg="bg-emerald-500/20"
                title={`Resurrect ${deadCharacter.character_name}`}
                description={
                  <>
                    Continue exactly where you left off. Uses{" "}
                    <span className="font-medium text-emerald-500">1 life</span> ({livesRemaining} left).
                  </>
                }
              />
            )}
            <ChoiceCard
              active={choice === "child"}
              onClick={() => setChoice("child")}
              icon={<Baby className="h-5 w-5 text-primary" />}
              iconBg="bg-primary/20"
              title={`Play as child of ${deadCharacter.character_name}`}
              description={
                <>
                  Inherit <span className="font-medium text-primary">10% of skills</span> ({skillCount}) and{" "}
                  <span className="font-medium text-primary">50% of cash</span> ($
                  {inheritedCash.toLocaleString()}).
                </>
              }
            />
            <ChoiceCard
              active={choice === "fresh"}
              onClick={() => setChoice("fresh")}
              icon={<Sparkles className="h-5 w-5 text-accent" />}
              iconBg="bg-accent/20"
              title="Start fresh"
              description="A brand-new character with $10,000 starting cash and no inheritance."
            />
          </div>
        )}

        {/* Step 3: Configure */}
        {step === "configure" && (
          <Card className="bg-card/95">
            <CardHeader>
              <CardTitle className="text-lg">
                {choice === "resurrect" ? "Review resurrection" : "Name your character"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {choice === "resurrect" ? (
                <div className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    {deadCharacter.character_name} will be restored with their fame,
                    cash, skills, and relationships intact. Health and energy reset to 100.
                  </p>
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
                    <p className="font-medium text-emerald-500">
                      This will use 1 resurrection life. {livesRemaining - 1} will remain.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="display-name">Stage / display name</Label>
                    <Input
                      id="display-name"
                      value={displayName}
                      onChange={(e) => handleDisplayNameChange(e.target.value)}
                      placeholder="e.g. Jax Reeves"
                      maxLength={40}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => {
                        setUsername(slugifyUsername(e.target.value));
                        setUsernameEdited(true);
                      }}
                      placeholder="lowercase-letters-and-numbers"
                      maxLength={30}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Lowercase letters, numbers and hyphens only. 3-30 characters.
                    </p>
                  </div>
                  {choice === "child" && (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs space-y-1">
                      <p className="font-medium text-primary">Legacy inheritance</p>
                      <p className="text-muted-foreground">
                        Starting cash: ${inheritedCash.toLocaleString()} · Inherited
                        skills: {skillCount} · Generation:{" "}
                        {(deadCharacter.generation_number || 1) + 1}
                      </p>
                    </div>
                  )}
                  {choice === "fresh" && (
                    <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs">
                      <p className="text-muted-foreground">
                        Starting cash: $10,000 · No inherited skills · Generation 1.
                        Old fame, fans and money remain with your retired characters.
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 4: Confirm */}
        {step === "confirm" && (
          <Card className="bg-card/95">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Confirm and begin
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <SummaryRow label="Path">
                {choice === "resurrect" && "Resurrect existing character"}
                {choice === "child" && "Play as child (Generation legacy)"}
                {choice === "fresh" && "Fresh start"}
              </SummaryRow>
              {choice !== "resurrect" && (
                <>
                  <SummaryRow label="Display name">{displayName}</SummaryRow>
                  <SummaryRow label="Username">@{username}</SummaryRow>
                </>
              )}
              {choice === "resurrect" && (
                <SummaryRow label="Character">{deadCharacter.character_name}</SummaryRow>
              )}
              <Separator className="my-1" />
              <SummaryRow label="Starting cash">
                {choice === "resurrect"
                  ? `$${deadCharacter.total_cash_at_death.toLocaleString()} (restored)`
                  : choice === "child"
                    ? `$${inheritedCash.toLocaleString()}`
                    : "$10,000"}
              </SummaryRow>
              <SummaryRow label="Fame">
                {choice === "resurrect"
                  ? `${deadCharacter.total_fame.toLocaleString()} (restored)`
                  : "0"}
              </SummaryRow>
              <SummaryRow label="Skills">
                {choice === "resurrect"
                  ? `${skillCount} restored`
                  : choice === "child"
                    ? `${skillCount} inherited at 10%`
                    : "None"}
              </SummaryRow>
              <p className="text-[11px] text-muted-foreground pt-2">
                {choice === "resurrect"
                  ? "You will be taken directly back into the game."
                  : "You will be taken to onboarding to finish setting up your character."}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex gap-3">
          {step !== "welcome" && (
            <Button variant="outline" size="lg" onClick={goBack} disabled={isLoading}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          )}
          {step !== "confirm" ? (
            <Button
              className="flex-1"
              size="lg"
              disabled={!canAdvance() || isLoading}
              onClick={goNext}
            >
              Continue
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button
              className="flex-1"
              size="lg"
              disabled={isLoading}
              onClick={handleConfirm}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Working...
                </>
              ) : choice === "resurrect" ? (
                "Resurrect and continue"
              ) : choice === "child" ? (
                "Continue the legacy"
              ) : (
                "Start fresh"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChoiceCard({
  active,
  onClick,
  icon,
  iconBg,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: React.ReactNode;
}) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:border-primary/50 ${
        active ? "border-primary ring-2 ring-primary/20" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
            {icon}
          </div>
          <div>
            <h4 className="font-bold">{title}</h4>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{children}</span>
    </div>
  );
}
