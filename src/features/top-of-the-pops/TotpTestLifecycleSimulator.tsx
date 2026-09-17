import { useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clapperboard,
  MapPin,
  MessageCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Tv2,
  Users,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TotpArchivePlayer } from "./TotpArchivePlayer";
import { TotpProgrammeContinuity } from "./TotpProgrammeContinuity";
import { TotpShowIntro } from "./TotpShowIntro";
import { totpAudienceReactionLabel } from "./studioAudience";
import type { TotpTestPreviewPerformance } from "./testPreviewApi";
import {
  TOTP_TEST_INTERVIEW_CHOICES,
  TOTP_TEST_POSTSHOW_CHOICES,
  TOTP_TEST_RECOVERY_CHOICES,
  TOTP_TEST_STYLE_CHOICES,
  buildTotpTestReplay,
  buildTotpTestRewardPreview,
  combineTotpTestEffects,
  getTotpTestIncident,
  getTotpTestInterviewEffects,
  getTotpTestInterviewPrompt,
  getTotpTestPostShowEffects,
  getTotpTestPostShowPrompt,
  getTotpTestRecoveryEffects,
  getTotpTestStyleOutcome,
  type TotpTestInterviewChoice,
  type TotpTestPerformanceStyleChoice,
  type TotpTestPostShowChoice,
  type TotpTestRecoveryChoice,
} from "./testLifecycle";

type TotpTestPhase =
  | "invitation"
  | "accepted"
  | "checked_in"
  | "interview"
  | "incident"
  | "style"
  | "broadcast"
  | "green_room"
  | "complete";

interface TotpTestLifecycleState {
  phase: TotpTestPhase;
  interviewChoice: TotpTestInterviewChoice | null;
  recoveryChoice: TotpTestRecoveryChoice | null;
  styleChoice: TotpTestPerformanceStyleChoice | null;
  postShowChoice: TotpTestPostShowChoice | null;
}

interface TotpTestLifecycleSimulatorProps {
  performance: TotpTestPreviewPerformance;
  seed: string;
  generatedAt: string;
  onExit: () => void;
}

const PHASES: Array<{ key: TotpTestPhase; label: string }> = [
  { key: "invitation", label: "Invite" },
  { key: "accepted", label: "Accept" },
  { key: "checked_in", label: "London" },
  { key: "interview", label: "Interview" },
  { key: "incident", label: "Live TV" },
  { key: "style", label: "Direction" },
  { key: "broadcast", label: "3D show" },
  { key: "green_room", label: "Green room" },
  { key: "complete", label: "Results" },
];

function initialState(): TotpTestLifecycleState {
  return {
    phase: "invitation",
    interviewChoice: null,
    recoveryChoice: null,
    styleChoice: null,
    postShowChoice: null,
  };
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${Number.isInteger(value) ? value : value.toFixed(2)}`;
}

type TotpDemoBroadcastStep = "intro" | "presenter" | "performance";

export function TotpTestLifecycleSimulator({ performance, seed, generatedAt, onExit }: TotpTestLifecycleSimulatorProps) {
  const [state, setState] = useState<TotpTestLifecycleState>(initialState);
  const [broadcastStep, setBroadcastStep] = useState<TotpDemoBroadcastStep>("intro");
  const incident = getTotpTestIncident(seed, performance);
  const interviewEffects = getTotpTestInterviewEffects(state.interviewChoice);
  const recoveryEffects = getTotpTestRecoveryEffects(incident.event_key, state.recoveryChoice);
  const styleOutcome = getTotpTestStyleOutcome(seed, performance, state.styleChoice);
  const postShowEffects = getTotpTestPostShowEffects(state.postShowChoice);
  const zeroEffects = getTotpTestInterviewEffects(null);
  const totalEffects = combineTotpTestEffects(
    incident.effects,
    interviewEffects,
    recoveryEffects,
    styleOutcome?.effects ?? zeroEffects,
    postShowEffects,
  );
  const audienceReaction = combineTotpTestEffects(
    incident.effects,
    recoveryEffects,
    styleOutcome?.effects ?? zeroEffects,
  ).audience_reaction;
  const replay = styleOutcome
    ? buildTotpTestReplay(performance, seed, generatedAt, audienceReaction)
    : null;
  const rewardPreview = styleOutcome
    ? buildTotpTestRewardPreview(performance.qualifying_rank, styleOutcome.fame_multiplier)
    : null;
  const phaseIndex = PHASES.findIndex((phase) => phase.key === state.phase);

  const advance = (phase: TotpTestPhase) => setState((current) => ({ ...current, phase }));
  const beginBroadcast = (choice: TotpTestPerformanceStyleChoice) => {
    setBroadcastStep("intro");
    setState((current) => ({ ...current, styleChoice: choice, phase: "broadcast" }));
  };

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Tv2 className="h-5 w-5" /> Accelerated virtual episode</CardTitle>
            <CardDescription className="mt-1 max-w-3xl">
              Run one selected chart act through the player journey immediately. The 3D broadcast uses the real TOTP camera/stage viewer, but every choice and reward below exists only in this browser simulation.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1"><ShieldCheck className="h-3 w-3" /> zero gameplay writes</Badge>
            <Button size="sm" variant="ghost" onClick={() => { setState(initialState()); setBroadcastStep("intro"); }}><RotateCcw className="mr-2 h-4 w-4" /> Reset</Button>
            <Button size="sm" variant="outline" onClick={onExit}>Choose another act</Button>
          </div>
        </div>

        <div className="rounded-lg border bg-background/80 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="font-semibold">{performance.band_name}</div>
              <div className="text-sm text-muted-foreground">{performance.song_title} · UK chart #{performance.qualifying_rank} · {performance.stage_key.replaceAll("_", " ")}</div>
            </div>
            <Badge variant="secondary">running order #{performance.running_order}</Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {PHASES.map((phase, index) => (
            <Badge key={phase.key} variant={index === phaseIndex ? "default" : index < phaseIndex ? "secondary" : "outline"}>
              {index < phaseIndex ? "✓ " : ""}{phase.label}
            </Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {state.phase === "invitation" && (
          <div className="rounded-lg border bg-background p-4">
            <div className="flex items-center gap-2 font-medium"><Clapperboard className="h-4 w-4" /> Virtual invitation</div>
            <p className="mt-2 text-sm text-muted-foreground">
              {performance.band_name} is invited because {performance.song_title} is currently qualifying at #{performance.qualifying_rank}. This creates no invitation row and sends no player notification.
            </p>
            <Button className="mt-4" onClick={() => advance("accepted")}>Accept virtual invitation</Button>
          </div>
        )}

        {state.phase === "accepted" && (
          <div className="rounded-lg border bg-background p-4">
            <div className="flex items-center gap-2 font-medium"><MapPin className="h-4 w-4" /> London attendance requirement</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Production requires the act in London before studio check-in. Test mode skips real travel, timers and character location changes.
            </p>
            <Button className="mt-4" onClick={() => advance("checked_in")}>Simulate London arrival & check-in</Button>
          </div>
        )}

        {state.phase === "checked_in" && (
          <div className="rounded-lg border bg-background p-4">
            <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4" /> Checked in at RockMundo Television Centre</div>
            <p className="mt-2 text-sm text-muted-foreground">
              The act is virtually cleared by the floor team. In the real flow this is where backstage interactions, production incidents and performance direction become available.
            </p>
            <Button className="mt-4" onClick={() => advance("interview")}>Go backstage with Alex Rayne</Button>
          </div>
        )}

        {state.phase === "interview" && (
          <div className="rounded-lg border bg-background p-4">
            <div className="flex items-center gap-2 font-medium"><MessageCircle className="h-4 w-4" /> Presenter interview</div>
            <p className="mt-3 rounded-md bg-muted/40 p-3 text-sm">{getTotpTestInterviewPrompt(seed, performance)}</p>
            <div className="mt-4 grid gap-2 lg:grid-cols-3">
              {TOTP_TEST_INTERVIEW_CHOICES.map((choice) => (
                <Button
                  key={choice.key}
                  variant="outline"
                  className="h-auto justify-start whitespace-normal p-3 text-left"
                  onClick={() => setState((current) => ({ ...current, interviewChoice: choice.key, phase: "incident" }))}
                >
                  <span>
                    <span className="flex items-center gap-2 font-medium"><Sparkles className="h-3.5 w-3.5" /> {choice.title}</span>
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">{choice.description}</span>
                  </span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {state.phase === "incident" && (
          <div className="rounded-lg border bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-medium"><Activity className="h-4 w-4" /> {incident.title}</div>
              <Badge variant="outline">Audience {signed(incident.effects.audience_reaction)}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{incident.description}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {incident.effects.reputation !== 0 && <Badge variant="outline">Reputation {signed(incident.effects.reputation)}</Badge>}
              {incident.effects.fan_sentiment !== 0 && <Badge variant="outline">Fan sentiment {signed(incident.effects.fan_sentiment)}</Badge>}
              {incident.effects.media_intensity !== 0 && <Badge variant="outline">Media {signed(incident.effects.media_intensity)}</Badge>}
            </div>

            {incident.requires_recovery ? (
              <div className="mt-4 space-y-3 border-t pt-4">
                <div className="flex items-center gap-2 text-sm font-medium"><Wrench className="h-4 w-4" /> Choose the recovery</div>
                <div className="grid gap-2 lg:grid-cols-3">
                  {TOTP_TEST_RECOVERY_CHOICES.map((choice) => (
                    <Button
                      key={choice.key}
                      variant="outline"
                      className="h-auto justify-start whitespace-normal p-3 text-left"
                      onClick={() => setState((current) => ({ ...current, recoveryChoice: choice.key, phase: "style" }))}
                    >
                      <span>
                        <span className="font-medium">{choice.title}</span>
                        <span className="mt-1 block text-xs font-normal text-muted-foreground">{choice.description}</span>
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <Button className="mt-4" onClick={() => advance("style")}>Continue to performance direction</Button>
            )}
          </div>
        )}

        {state.phase === "style" && (
          <div className="rounded-lg border bg-background p-4">
            <div className="flex items-center gap-2 font-medium"><Sparkles className="h-4 w-4" /> Choose performance direction</div>
            <p className="mt-2 text-sm text-muted-foreground">
              These are the same three direction choices used by the real programme. The simulated result feeds the studio-audience reaction and 3D crowd behaviour.
            </p>
            <div className="mt-4 grid gap-2 lg:grid-cols-3">
              {TOTP_TEST_STYLE_CHOICES.map((choice) => (
                <Button
                  key={choice.key}
                  variant="outline"
                  className="h-auto justify-start whitespace-normal p-3 text-left"
                  onClick={() => beginBroadcast(choice.key)}
                >
                  <span>
                    <span className="font-medium">{choice.title}</span>
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">{choice.description}</span>
                  </span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {state.phase === "broadcast" && replay && styleOutcome && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-background p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 font-medium"><Clapperboard className="h-4 w-4" /> Live 3D television performance</div>
                  <p className="mt-1 text-sm text-muted-foreground">“{performance.presenter_intro}”</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge>{styleOutcome.choice.replaceAll("_", " ")}</Badge>
                  <Badge variant="secondary"><Users className="mr-1 h-3 w-3" /> {totpAudienceReactionLabel(audienceReaction)} {signed(audienceReaction)}</Badge>
                </div>
              </div>
              {styleOutcome.raw_live_risk && (
                <p className="mt-3 text-xs text-muted-foreground">Raw-live deterministic outcome: {styleOutcome.raw_live_risk === "rough" ? "rough live take" : "clean high-energy take"}.</p>
              )}
            </div>

            {broadcastStep === "intro" ? (
              <TotpShowIntro playing onEnded={() => setBroadcastStep("presenter")} />
            ) : broadcastStep === "presenter" ? (
              <TotpProgrammeContinuity
                kind="opening"
                replays={[replay]}
                autoPlay
                onEnded={() => setBroadcastStep("performance")}
              />
            ) : (
              <TotpArchivePlayer
                replay={replay}
                autoPlay
                onEnded={() => advance("green_room")}
              />
            )}

            <div className="flex flex-wrap justify-end gap-2">
              {broadcastStep === "intro" && (
                <Button variant="outline" onClick={() => setBroadcastStep("presenter")}>Skip to presenter</Button>
              )}
              {broadcastStep === "presenter" && (
                <Button variant="outline" onClick={() => setBroadcastStep("performance")}>Skip to performance</Button>
              )}
              {broadcastStep === "performance" && (
                <Button onClick={() => advance("green_room")}>Finish virtual broadcast</Button>
              )}
            </div>
          </div>
        )}

        {state.phase === "green_room" && (
          <div className="rounded-lg border bg-background p-4">
            <div className="flex items-center gap-2 font-medium"><Users className="h-4 w-4" /> After the cameras stop</div>
            <p className="mt-3 rounded-md bg-muted/40 p-3 text-sm">{getTotpTestPostShowPrompt(seed, performance)}</p>
            <div className="mt-4 grid gap-2 lg:grid-cols-3">
              {TOTP_TEST_POSTSHOW_CHOICES.map((choice) => (
                <Button
                  key={choice.key}
                  variant="outline"
                  className="h-auto justify-start whitespace-normal p-3 text-left"
                  onClick={() => setState((current) => ({ ...current, postShowChoice: choice.key, phase: "complete" }))}
                >
                  <span>
                    <span className="font-medium">{choice.title}</span>
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">{choice.description}</span>
                  </span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {state.phase === "complete" && replay && styleOutcome && rewardPreview && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-background p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-lg font-semibold"><CheckCircle2 className="h-5 w-5" /> Virtual episode complete</div>
                  <p className="mt-1 text-sm text-muted-foreground">This is a preview of what the real appearance would have produced; nothing below was written to RockMundo progression.</p>
                </div>
                <Badge variant="secondary"><Users className="mr-1 h-3 w-3" /> {totpAudienceReactionLabel(audienceReaction)} audience · {signed(audienceReaction)}</Badge>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-md border p-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Social / media preview</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">Reputation {signed(totalEffects.reputation)}</Badge>
                    <Badge variant="outline">Fan sentiment {signed(totalEffects.fan_sentiment)}</Badge>
                    <Badge variant="outline">Media {signed(totalEffects.media_intensity)}</Badge>
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fame preview</div>
                  <div className="mt-1 text-xl font-semibold">{rewardPreview.style_adjusted_rank_base_fame.toLocaleString()} rank-base fame</div>
                  <div className="text-xs text-muted-foreground">
                    Rank base {rewardPreview.rank_base_fame.toLocaleString()} × style {rewardPreview.style_multiplier.toFixed(2)}. The real final settlement can differ because first-appearance, repeat-appearance and progression scaling use the band's live state.
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Tv2 className="h-4 w-4" /> Virtual archive replay</div>
              <TotpArchivePlayer replay={replay} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
