import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, XCircle, Music, Users, Zap, Sparkles, Loader2 } from "lucide-react";
import { EMPTY_GEAR_EFFECTS, type GearModifierEffects } from "@/utils/gearModifiers";
import { GEAR_TARGETS } from "@/utils/gigNarrative";

interface RehearsalData {
  song_id: string;
  song_title: string;
  rehearsal_level: number;
}

interface GigPreparationChecklistProps {
  setlistSongs: Array<{ song_id: string; songs?: { title: string } }>;
  rehearsals: RehearsalData[];
  equipmentCount: number;
  crewCount: number;
  bandChemistry: number;
  gearEffects?: GearModifierEffects | null;
  equippedGearCount?: number;
  gearLoading?: boolean;
}

export const GigPreparationChecklist = ({
  setlistSongs,
  rehearsals,
  equipmentCount,
  crewCount,
  bandChemistry,
  gearEffects,
  equippedGearCount = 0,
  gearLoading = false
}: GigPreparationChecklistProps) => {
  
  // Calculate rehearsal readiness
  const songsWithRehearsals = setlistSongs.map(song => {
    const rehearsal = rehearsals.find(r => r.song_id === song.song_id);
    return {
      title: song.songs?.title || 'Unknown',
      rehearsalLevel: rehearsal?.rehearsal_level || 0,
      isReady: (rehearsal?.rehearsal_level || 0) >= 5
    };
  });

  const rehearsedSongs = songsWithRehearsals.filter(s => s.isReady).length;
  const rehearsalPercentage = (rehearsedSongs / setlistSongs.length) * 100;

  // Determine overall readiness
  const hasEquipment = equipmentCount > 0;
  const hasCrew = crewCount > 0;
  const goodChemistry = bandChemistry >= 50;
  const wellRehearsed = rehearsalPercentage >= 80;

  const readinessScore = [hasEquipment, hasCrew, goodChemistry, wellRehearsed].filter(Boolean).length;

  const hasGearBonuses = Boolean(gearEffects && gearEffects.breakdown.length > 0);
  const formattedGearEffects = gearEffects;
  const baselineGearEffects = EMPTY_GEAR_EFFECTS;

  const gearComparisons = formattedGearEffects
    ? [
        {
          key: "attendance",
          label: "Crowd Energy",
          current: formattedGearEffects.attendanceBonusPercent,
          baseline: baselineGearEffects.attendanceBonusPercent,
          target: GEAR_TARGETS.attendanceBonusPercent,
          formatCurrent: (value: number) => `+${value.toFixed(1)}%`,
          formatReference: (value: number) => `+${value.toFixed(1)}%`,
          gapLabel: "boost",
          onTrackCopy: "Crowd is primed—expect a noticeable bump in turnout.",
        },
        {
          key: "reliability",
          label: "Rig Stability",
          current: formattedGearEffects.reliabilitySwingReductionPercent,
          baseline: baselineGearEffects.reliabilitySwingReductionPercent,
          target: GEAR_TARGETS.reliabilitySwingReductionPercent,
          formatCurrent: (value: number) => `-${value.toFixed(1)}% swing`,
          formatReference: (value: number) => `-${value.toFixed(1)}%`,
          gapLabel: "stability",
          onTrackCopy: "Dialed-in pedals should keep the set steady throughout.",
        },
        {
          key: "revenue",
          label: "Payout Lift",
          current: formattedGearEffects.revenueBonusPercent,
          baseline: baselineGearEffects.revenueBonusPercent,
          target: GEAR_TARGETS.revenueBonusPercent,
          formatCurrent: (value: number) => `+${value.toFixed(1)}%`,
          formatReference: (value: number) => `+${value.toFixed(1)}%`,
          gapLabel: "revenue",
          onTrackCopy: "Merch and tickets are positioned for a healthy upsell.",
        },
        {
          key: "fame",
          label: "Reputation Boost",
          current: formattedGearEffects.fameBonusPercent,
          baseline: baselineGearEffects.fameBonusPercent,
          target: GEAR_TARGETS.fameBonusPercent,
          formatCurrent: (value: number) => `+${value.toFixed(1)}%`,
          formatReference: (value: number) => `+${value.toFixed(1)}%`,
          gapLabel: "buzz",
          onTrackCopy: "Signature rigs should leave a strong impression on promoters.",
        },
      ]
    : [];

  const gearGaps = gearComparisons.filter((metric) => metric.current < metric.target);

  const getReadinessColor = () => {
    if (readinessScore >= 4) return "default";
    if (readinessScore >= 2) return "secondary";
    return "destructive";
  };

  const getReadinessLabel = () => {
    if (readinessScore >= 4) return "Excellent";
    if (readinessScore >= 3) return "Good";
    if (readinessScore >= 2) return "Fair";
    return "Poor";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Gig Preparation
          </CardTitle>
          <Badge variant={getReadinessColor()}>
            {getReadinessLabel()} ({readinessScore}/4)
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Rehearsal Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4" />
              <span className="font-semibold">Setlist Rehearsals</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {rehearsedSongs}/{setlistSongs.length} songs ready
            </span>
          </div>
          
          {!wellRehearsed && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Only {Math.round(rehearsalPercentage)}% of setlist is well-rehearsed. 
                Performance quality will suffer! Aim for 80%+ rehearsal coverage.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-1 pl-6">
            {songsWithRehearsals.map((song, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  {song.isReady ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500" />
                  )}
                  {song.title}
                </span>
                <Badge variant={song.isReady ? "outline" : "destructive"} className="text-xs">
                  Level {song.rehearsalLevel}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Equipment Status */}
        <div className="flex items-center justify-between">
          <span className="font-semibold">Equipment</span>
          <div className="flex items-center gap-2">
            {hasEquipment ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">{equipmentCount} items</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-muted-foreground">No equipment</span>
              </>
            )}
          </div>
        </div>

        {/* Crew Status */}
        <div className="flex items-center justify-between">
          <span className="font-semibold">Crew Members</span>
          <div className="flex items-center gap-2">
            {hasCrew ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">{crewCount} crew</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-muted-foreground">No crew</span>
              </>
            )}
          </div>
        </div>

        {/* Chemistry Status */}
        <div className="flex items-center justify-between">
          <span className="font-semibold">Band Chemistry</span>
          <div className="flex items-center gap-2">
            {goodChemistry ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">{bandChemistry}%</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-muted-foreground">{bandChemistry}% (low)</span>
              </>
            )}
          </div>
        </div>

        {/* Gear Impact */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Gear Impact</span>
            <div className="flex items-center gap-2">
              {gearLoading ? (
                <Badge variant="outline" className="flex items-center gap-1 text-xs">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading
                </Badge>
              ) : hasGearBonuses ? (
                <Badge variant="default" className="flex items-center gap-1 text-xs">
                  <Sparkles className="h-3 w-3" />
                  Active Bonuses
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  No Bonuses
                </Badge>
              )}
            </div>
          </div>

          {equippedGearCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {equippedGearCount} bonus {equippedGearCount === 1 ? 'item is' : 'items are'} equipped by your bandmates.
            </p>
          )}

          {!gearLoading && (!formattedGearEffects || formattedGearEffects.breakdown.length === 0) && (
            <p className="text-sm text-muted-foreground">
              Equip high-end microphones, pedals, and processors to unlock capped performance boosts and keep breakdown risk low.
            </p>
          )}

          {gearComparisons.length > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {gearComparisons.map((metric) => {
                  const meetsTarget = metric.current >= metric.target;
                  const gapAmount = Math.max(0, metric.target - metric.current);

                  return (
                    <div
                      key={metric.key}
                      className={`rounded-md border border-dashed p-2 text-xs ${
                        meetsTarget ? 'border-primary/40' : 'border-destructive/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{metric.label}</span>
                        <span className={`font-semibold ${meetsTarget ? 'text-primary' : 'text-destructive'}`}>
                          {metric.formatCurrent(metric.current)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Baseline {metric.formatReference(metric.baseline)}</span>
                        <span>Target {metric.formatReference(metric.target)}</span>
                      </div>
                      {meetsTarget ? (
                        <p className="mt-2 text-[11px] text-muted-foreground">{metric.onTrackCopy}</p>
                      ) : (
                        <div className="mt-2 flex items-start gap-1 text-[11px] text-destructive">
                          <AlertCircle className="mt-[2px] h-3 w-3" />
                          <span>
                            Needs {gapAmount.toFixed(1)}% more {metric.gapLabel} to hit the target.
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {gearGaps.length > 0 && (
                <Alert variant="destructive" className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {gearGaps.length === gearComparisons.length
                      ? 'Gear bonuses are below target across the board. Consider equipping higher-tier items before showtime.'
                      : 'Some bonuses are below the recommended targets. Swap or upgrade gear to close the gaps before the gig.'}
                  </AlertDescription>
                </Alert>
              )}

              {formattedGearEffects && formattedGearEffects.breakdown.length > 0 && (
                <div className="space-y-1 pl-6">
                  {formattedGearEffects.breakdown.map((entry) => (
                    <div key={entry.key} className="flex flex-col text-sm">
                      <span className="flex items-center gap-2 font-medium">
                        <CheckCircle2 className="h-3 w-3 text-primary" />
                        {entry.label}
                        <Badge variant="outline" className="text-xs">{entry.value}</Badge>
                      </span>
                      <span className="pl-5 text-xs text-muted-foreground">{entry.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {readinessScore < 3 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your preparation is lacking. Consider rehearsing more, hiring crew, or acquiring better equipment before the gig.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
