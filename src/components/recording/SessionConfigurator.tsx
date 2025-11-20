import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Clock, DollarSign, TrendingUp, Music2, Users, Wallet, AlertCircle, NotebookPen } from "lucide-react";
import { useCreateRecordingSession, calculateRecordingQuality, ORCHESTRA_OPTIONS, type RecordingProducer } from "@/hooks/useRecordingData";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RehearsalWarningDialog } from "./RehearsalWarningDialog";
import { useSongwritingEventLogger } from "@/hooks/useSongwritingEventLogger";
import logger from "@/lib/logger";

interface SessionConfiguratorProps {
  userId: string;
  bandId?: string | null;
  studio: any;
  song: any;
  producer: RecordingProducer;
  recordingVersion?: 'standard' | 'remix' | 'acoustic';
  onComplete: () => void;
}

export const SessionConfigurator = ({ userId, bandId, studio, song, producer, recordingVersion, onComplete }: SessionConfiguratorProps) => {
  const [durationHours, setDurationHours] = useState(3);
  const [orchestraSize, setOrchestraSize] = useState<'chamber' | 'small' | 'full' | null>(null);
  const [bandBalance, setBandBalance] = useState<number>(0);
  const [personalCash, setPersonalCash] = useState<number>(0);
  const [bandName, setBandName] = useState<string>("");
  const [rehearsalData, setRehearsalData] = useState<{
    minutes: number;
    stage: 'unrehearsed' | 'tight' | 'perfect';
    penalty: number;
  } | null>(null);
  const [showRehearsalWarning, setShowRehearsalWarning] = useState(false);
  const [sessionTempo, setSessionTempo] = useState<number>(song?.tempo_bpm ?? 120);
  const [annotationMood, setAnnotationMood] = useState('');
  const [annotationGenre, setAnnotationGenre] = useState(song?.genre ?? '');
  const [annotationReferences, setAnnotationReferences] = useState('');
  const [instrumentationNotes, setInstrumentationNotes] = useState('');
  const [currentTake, setCurrentTake] = useState(1);

  const createSession = useCreateRecordingSession();
  const { logEvent: recordingEventLogger } = useSongwritingEventLogger(userId);

  // Fetch band balance, personal cash, and rehearsal data
  useEffect(() => {
    const fetchData = async () => {
      // Fetch balances
      if (bandId) {
        const { data: band, error: bandError } = await supabase
          .from('bands')
          .select('band_balance, name')
          .eq('id', bandId)
          .single();
        
        console.log('💰 Band balance fetch:', { band, bandError, bandId });
        setBandBalance(band?.band_balance || 0);
        setBandName(band?.name || 'Unknown Band');

        // Fetch rehearsal data for band song
        const { data: familiarity } = await supabase
          .from('band_song_familiarity')
          .select('familiarity_minutes, rehearsal_stage')
          .eq('band_id', bandId)
          .eq('song_id', song.id)
          .single();

        if (familiarity) {
          const minutes = familiarity.familiarity_minutes || 0;
          const stage = familiarity.rehearsal_stage as 'unrehearsed' | 'tight' | 'perfect';
          const penalty = stage === 'unrehearsed' ? -20 : stage === 'perfect' ? 10 : 0;
          setRehearsalData({ minutes, stage, penalty });
        } else {
          // No rehearsal record - defaults to unrehearsed
          setRehearsalData({ minutes: 0, stage: 'unrehearsed', penalty: -20 });
        }
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('cash')
        .eq('user_id', userId)
        .single();
      
      console.log('💵 Profile cash fetch:', { profile, profileError, userId });
      setPersonalCash(profile?.cash || 0);
    };
    fetchData();
  }, [bandId, userId, song.id]);

  useEffect(() => {
    setAnnotationGenre(song?.genre ?? '');
    setSessionTempo(song?.tempo_bpm ?? 120);
    setAnnotationMood('');
    setAnnotationReferences('');
    setInstrumentationNotes('');
    setCurrentTake(1);
  }, [song?.id, song?.genre, song?.tempo_bpm]);

  const orchestraOption = orchestraSize ? ORCHESTRA_OPTIONS.find(o => o.size === orchestraSize) : undefined;
  const parseList = (value: string) => value.split(/[\n,]/).map(entry => entry.trim()).filter(Boolean);

  // Calculate quality with rehearsal penalty/bonus
  const rehearsalBonus = bandId && rehearsalData ? rehearsalData.penalty : 0;
  
  const { finalQuality, breakdown } = calculateRecordingQuality(
    song.quality_score || 0,
    studio.quality_rating,
    producer.quality_bonus,
    durationHours,
    orchestraOption?.bonus,
    rehearsalBonus
  );

  const studioCost = studio.hourly_rate * durationHours;
  const producerCost = producer.cost_per_hour * durationHours;
  const orchestraCost = orchestraOption?.cost || 0;
  const totalCost = studioCost + producerCost + orchestraCost;

  const qualityImprovement = finalQuality - (song.quality_score || 0);
  const qualityImprovementPercent = Math.round((qualityImprovement / (song.quality_score || 1)) * 100);

  const availableBalance = bandId ? bandBalance : personalCash;
  const canAfford = availableBalance >= totalCost;
  const balanceShortfall = totalCost - availableBalance;
  
  useEffect(() => {
    console.log('💰 RECORDING BALANCE CHECK:', { 
      bandId, 
      bandBalance, 
      personalCash, 
      availableBalance, 
      totalCost, 
      canAfford,
      studioCost,
      producerCost,
      orchestraCost
    });
  }, [bandId, bandBalance, personalCash, availableBalance, totalCost, canAfford, studioCost, producerCost, orchestraCost]);

  const handleStartRecording = () => {
    // Show rehearsal warning dialog if this is a band recording
    if (bandId && rehearsalData) {
      setShowRehearsalWarning(true);
    } else {
      proceedWithRecording();
    }
  };

  const proceedWithRecording = async () => {
    setShowRehearsalWarning(false);
    const sessionRecord = await createSession.mutateAsync({
      user_id: userId,
      band_id: bandId || null,
      studio_id: studio.id,
      producer_id: producer.id,
      song_id: song.id,
      duration_hours: durationHours,
      orchestra_size: orchestraSize || undefined,
      recording_version: recordingVersion,
      rehearsal_bonus: rehearsalBonus,
    });

    if (recordingEventLogger) {
      const instrumentation = parseList(instrumentationNotes);
      const references = parseList(annotationReferences);

      try {
        await recordingEventLogger.mutateAsync({
          projectId: song?.songwriting_project_id ?? null,
          sessionId: sessionRecord?.id ?? null,
          songId: song.id,
          eventType: "recording_take",
          tempoBpm: sessionTempo,
          chordProgression: song?.chord_progression ?? null,
          lyricsDraft: song?.lyrics ?? null,
          instrumentation: instrumentation.length > 0 ? instrumentation : undefined,
          takeNumber: currentTake,
          mood: annotationMood || undefined,
          genre: annotationGenre || song?.genre || undefined,
          referenceTracks: references,
          metadata: {
            studioId: studio.id,
            studioName: studio.name,
            producerId: producer.id,
            recordingVersion: recordingVersion ?? 'standard',
            orchestraSize: orchestraSize ?? null,
          },
        });
      } catch (error) {
        logger.warn('Failed to persist recording annotations', { error });
      }
    }

    onComplete();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Recording Duration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={durationHours.toString()} onValueChange={(v) => setDurationHours(parseInt(v))}>
            <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer">
              <RadioGroupItem value="2" id="dur-2" />
              <Label htmlFor="dur-2" className="flex-1 cursor-pointer">
                <div className="font-semibold">2 Hours (Rushed)</div>
                <div className="text-sm text-muted-foreground">-5% quality penalty, save time</div>
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer">
              <RadioGroupItem value="3" id="dur-3" />
              <Label htmlFor="dur-3" className="flex-1 cursor-pointer">
                <div className="font-semibold">3 Hours (Standard) ⭐</div>
                <div className="text-sm text-muted-foreground">Optimal quality, recommended</div>
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer">
              <RadioGroupItem value="4" id="dur-4" />
              <Label htmlFor="dur-4" className="flex-1 cursor-pointer">
                <div className="font-semibold">4 Hours (Polished)</div>
                <div className="text-sm text-muted-foreground">+5% quality bonus, extra refinement</div>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Orchestra (Optional)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50">
            <Checkbox
              id="orch-chamber"
              checked={orchestraSize === 'chamber'}
              onCheckedChange={(checked) => setOrchestraSize(checked ? 'chamber' : null)}
            />
            <Label htmlFor="orch-chamber" className="flex-1 cursor-pointer">
              <div className="font-semibold">Chamber Orchestra (15 musicians)</div>
              <div className="text-sm text-muted-foreground">+10% quality • ${ORCHESTRA_OPTIONS[0].cost.toLocaleString()}</div>
            </Label>
          </div>
          <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50">
            <Checkbox
              id="orch-small"
              checked={orchestraSize === 'small'}
              onCheckedChange={(checked) => setOrchestraSize(checked ? 'small' : null)}
            />
            <Label htmlFor="orch-small" className="flex-1 cursor-pointer">
              <div className="font-semibold">Small Orchestra (30 musicians)</div>
              <div className="text-sm text-muted-foreground">+17% quality • ${ORCHESTRA_OPTIONS[1].cost.toLocaleString()}</div>
            </Label>
          </div>
          <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50">
            <Checkbox
              id="orch-full"
              checked={orchestraSize === 'full'}
              onCheckedChange={(checked) => setOrchestraSize(checked ? 'full' : null)}
            />
            <Label htmlFor="orch-full" className="flex-1 cursor-pointer">
              <div className="font-semibold">Full Orchestra (80 musicians)</div>
              <div className="text-sm text-muted-foreground">+25% quality • ${ORCHESTRA_OPTIONS[2].cost.toLocaleString()}</div>
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Cost Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Studio ({durationHours} hrs × ${studio.hourly_rate.toLocaleString()})</span>
            <span className="font-semibold">${studioCost.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Producer ({durationHours} hrs × ${producer.cost_per_hour.toLocaleString()})</span>
            <span className="font-semibold">${producerCost.toLocaleString()}</span>
          </div>
          {orchestraOption && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Orchestra ({orchestraOption.size})</span>
              <span className="font-semibold">${orchestraCost.toLocaleString()}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-lg font-bold">
            <span>Total Cost</span>
            <span className="text-primary">${totalCost.toLocaleString()}</span>
          </div>
          <div className="space-y-1 pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                {bandId ? `Band Balance (${bandName})` : 'Your Cash'}
              </span>
              <span className={`font-semibold ${canAfford ? 'text-green-600' : 'text-red-600'}`}>
                ${availableBalance.toLocaleString()}
              </span>
            </div>
            {bandId && (
              <p className="text-xs text-muted-foreground">
                Recording with {bandName}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <NotebookPen className="h-5 w-5 text-primary" />
            Session Notes & Annotations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="annotation-mood">Mood</Label>
              <Input
                id="annotation-mood"
                value={annotationMood}
                onChange={(event) => setAnnotationMood(event.target.value)}
                placeholder="Euphoric, cinematic, moody..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="annotation-genre">Session Genre Focus</Label>
              <Input
                id="annotation-genre"
                value={annotationGenre}
                onChange={(event) => setAnnotationGenre(event.target.value)}
                placeholder={song.genre || 'Alt Pop'}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="session-tempo">Session Tempo (BPM)</Label>
              <Input
                id="session-tempo"
                type="number"
                min={40}
                max={220}
                value={sessionTempo}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  setSessionTempo(Number.isNaN(parsed) ? 120 : Math.max(40, Math.min(220, parsed)));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="take-number">Current Take</Label>
              <Input
                id="take-number"
                type="number"
                min={1}
                value={currentTake}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  setCurrentTake(Number.isNaN(parsed) ? 1 : Math.max(1, parsed));
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="annotation-references">Reference Tracks & Influences</Label>
            <Textarea
              id="annotation-references"
              value={annotationReferences}
              onChange={(event) => setAnnotationReferences(event.target.value)}
              placeholder="Artist - Song, Producer, Film score..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">Separate entries with commas or new lines.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="instrumentation-notes">Instrumentation Notes</Label>
            <Textarea
              id="instrumentation-notes"
              value={instrumentationNotes}
              onChange={(event) => setInstrumentationNotes(event.target.value)}
              placeholder="Warm pads, stacked vocals, analog bass, etc."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {!canAfford && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-semibold mb-1">Insufficient funds!</div>
            <div className="space-y-1 text-sm">
              <div>Current balance: ${availableBalance.toLocaleString()}</div>
              <div>Total cost: ${totalCost.toLocaleString()}</div>
              <div>Shortfall: ${balanceShortfall.toLocaleString()}</div>
              {bandId && (
                <div className="mt-2 text-xs">
                  💡 Go to Band Manager → Earnings tab to deposit funds into your band balance.
                </div>
              )}
              {!bandId && (
                <div className="mt-2 text-xs">
                  💡 Complete gigs, sell songs, or find other ways to earn cash.
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Estimated Quality
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Current Quality</div>
              <div className="text-2xl font-bold">{song.quality_score || 0}</div>
            </div>
            <Music2 className="h-8 w-8 text-muted-foreground" />
            <div className="text-right">
              <div className="text-sm text-muted-foreground">After Recording</div>
              <div className="text-2xl font-bold text-primary">{finalQuality}</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Quality Improvement</span>
              <Badge variant="default">+{qualityImprovement} ({qualityImprovementPercent}%)</Badge>
            </div>
            <Progress value={Math.min(100, qualityImprovementPercent)} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between p-2 rounded bg-background">
              <span className="text-muted-foreground">Studio:</span>
              <span className="font-semibold">+{breakdown.studioBonus}%</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-background">
              <span className="text-muted-foreground">Producer:</span>
              <span className="font-semibold">+{breakdown.producerBonus}%</span>
            </div>
            {breakdown.durationBonus !== 0 && (
              <div className="flex justify-between p-2 rounded bg-background">
                <span className="text-muted-foreground">Duration:</span>
                <span className="font-semibold">{breakdown.durationBonus > 0 ? '+' : ''}{breakdown.durationBonus}%</span>
              </div>
            )}
            {breakdown.orchestraBonus > 0 && (
              <div className="flex justify-between p-2 rounded bg-background">
                <span className="text-muted-foreground">Orchestra:</span>
                <span className="font-semibold">+{breakdown.orchestraBonus}%</span>
              </div>
            )}
            {breakdown.rehearsalBonus !== 0 && (
              <div className="flex justify-between p-2 rounded bg-background">
                <span className="text-muted-foreground">Rehearsal:</span>
                <span className={`font-semibold ${breakdown.rehearsalBonus > 0 ? 'text-primary' : 'text-destructive'}`}>
                  {breakdown.rehearsalBonus > 0 ? '+' : ''}{breakdown.rehearsalBonus}%
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <RehearsalWarningDialog
        open={showRehearsalWarning}
        onOpenChange={setShowRehearsalWarning}
        songTitle={song.title}
        rehearsalStage={rehearsalData?.stage || 'unrehearsed'}
        familiarityMinutes={rehearsalData?.minutes || 0}
        qualityPenalty={rehearsalBonus}
        onConfirm={proceedWithRecording}
      />

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" disabled>
          Cancel
        </Button>
        <Button
          onClick={handleStartRecording}
          disabled={createSession.isPending || !canAfford}
          className="flex-1"
        >
          {createSession.isPending ? 'Starting...' : `Start Recording ($${totalCost.toLocaleString()})`}
        </Button>
      </div>
    </div>
  );
};
