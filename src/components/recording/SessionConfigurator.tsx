import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Clock, DollarSign, TrendingUp, Music2, Users, Wallet, AlertCircle, CalendarIcon, Sparkles } from "lucide-react";
import { useCreateRecordingSession, calculateRecordingQuality, ORCHESTRA_OPTIONS, type RecordingProducer } from "@/hooks/useRecordingData";
import { calculateIndependentPenalty } from "./RecordingTypeSelector";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RehearsalWarningDialog } from "./RehearsalWarningDialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { STUDIO_SLOTS, getSlotTimeRange } from "@/utils/facilitySlots";
import { useStudioAvailability } from "@/hooks/useStudioAvailability";
import { isSlotInPast } from "@/utils/timeSlotValidation";
import { cn } from "@/lib/utils";
import { calculateRecordingSkillBonus, type RecordingSkillBonus } from "@/utils/skillRecordingBonus";
import type { SkillProgressEntry } from "@/utils/skillGearPerformance";

interface SessionConfiguratorProps {
  userId: string;
  bandId?: string | null;
  studio: any;
  song: any;
  producer: RecordingProducer;
  recordingType: 'demo' | 'professional';
  recordingVersion?: 'standard' | 'remix' | 'acoustic';
  onComplete: () => void;
}

export const SessionConfigurator = ({ userId, bandId, studio, song, producer, recordingType, recordingVersion, onComplete }: SessionConfiguratorProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
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
  const [skillBonus, setSkillBonus] = useState<RecordingSkillBonus>({
    multiplier: 1.0,
    totalBonusPercent: 0,
    breakdown: { mixing: 0, daw: 0, production: 0, vocalProduction: 0, theory: 0 },
  });
  const [isLabelSigned, setIsLabelSigned] = useState(false);
  const [playerFame, setPlayerFame] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1);
  const createSession = useCreateRecordingSession();

  // Fetch slot availability
  const { data: slotAvailability, isLoading: loadingSlots } = useStudioAvailability(
    studio.id,
    selectedDate,
    bandId,
    true
  );

  // Duration depends on recording type
  const durationHours = recordingType === 'demo' ? 4 : 8;

  // Fetch band balance, personal cash, label status, and rehearsal data
  useEffect(() => {
    const fetchData = async () => {
      if (bandId) {
        const { data: band } = await supabase
          .from('bands')
          .select('band_balance, name')
          .eq('id', bandId)
          .single();
        
        setBandBalance(band?.band_balance || 0);
        setBandName(band?.name || 'Unknown Band');

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
          setRehearsalData({ minutes: 0, stage: 'unrehearsed', penalty: -20 });
        }

        // Check label contract
        const { data: contract } = await supabase
          .from('artist_label_contracts')
          .select('id')
          .eq('band_id', bandId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();
        
        setIsLabelSigned(!!contract);
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('cash, id, fame, level')
        .eq('user_id', userId)
        .single();
      
      setPersonalCash(profile?.cash || 0);
      setPlayerFame(profile?.fame || 0);
      setPlayerLevel(profile?.level || 1);

      // Fetch player skill progress for recording bonus
      if (profile?.id) {
        const { data: skillData } = await supabase
          .from('skill_progress')
          .select('skill_slug, current_level')
          .eq('profile_id', profile.id);
        
        const bonus = calculateRecordingSkillBonus(
          (skillData || []) as SkillProgressEntry[]
        );
        setSkillBonus(bonus);
      }
    };
    fetchData();
  }, [bandId, userId, song.id]);

  const orchestraOption = orchestraSize ? ORCHESTRA_OPTIONS.find(o => o.size === orchestraSize) : undefined;

  const studioQualityRating = Number(studio?.quality_rating ?? 0);
  const studioHourlyRate = Number(studio?.hourly_rate ?? 0);
  const songQualityScore = Number(song?.quality_score ?? 0);
  const producerQualityBonus = Number((producer as any)?.quality_bonus ?? 0);
  const producerCostPerHour = Number((producer as any)?.cost_per_hour ?? 0);
  
  const rehearsalBonus = bandId && rehearsalData ? rehearsalData.penalty : 0;

  // Recording type multipliers
  const isDemo = recordingType === 'demo';
  const demoQualityMultiplier = isDemo ? 0.7 : 1.0;
  const demoCap = isDemo ? Math.round(studioQualityRating * 0.6) : Infinity;
  const independentPenalty = (!isDemo && !isLabelSigned) ? calculateIndependentPenalty(playerFame, playerLevel) : 0;
  const labelBonus = (!isDemo && isLabelSigned) ? 15 : 0;
  const typeMultiplier = demoQualityMultiplier * (1 - independentPenalty / 100) * (1 + labelBonus / 100);
  
  const { finalQuality: rawQuality, breakdown } = calculateRecordingQuality(
    songQualityScore,
    studioQualityRating,
    producerQualityBonus,
    durationHours,
    orchestraOption?.bonus,
    rehearsalBonus,
    skillBonus.totalBonusPercent
  );

  // Apply type multiplier and demo cap
  const finalQuality = Math.min(Math.round(rawQuality * typeMultiplier), isDemo ? demoCap : rawQuality * 10);

  // Cost: professional = 2.5x studio rate, label-owned = free
  const isLabelOwnedStudio = !!(studio as any)?.isLabelOwned;
  const costMultiplier = isDemo ? 1 : 2.5;
  const studioCost = isLabelOwnedStudio ? 0 : studioHourlyRate * durationHours * costMultiplier;
  const producerCost = producerCostPerHour * durationHours;
  const orchestraCost = orchestraOption?.cost || 0;
  const totalCost = studioCost + producerCost + orchestraCost;

  const qualityImprovement = finalQuality - songQualityScore;
  const qualityImprovementPercent = Math.round((qualityImprovement / (songQualityScore || 1)) * 100);

  const availableBalance = bandId ? bandBalance : personalCash;
  const canAfford = availableBalance >= totalCost;
  const balanceShortfall = totalCost - availableBalance;

  const handleStartRecording = () => {
    if (bandId && rehearsalData) {
      setShowRehearsalWarning(true);
    } else {
      proceedWithRecording();
    }
  };

  const proceedWithRecording = async () => {
    setShowRehearsalWarning(false);
    
    const slot = STUDIO_SLOTS.find(s => s.id === selectedSlotId);
    if (!slot) {
      return;
    }
    const { start, end } = getSlotTimeRange(slot, selectedDate);

    await createSession.mutateAsync({
      user_id: userId,
      band_id: bandId || null,
      studio_id: studio.id,
      producer_id: producer.id,
      song_id: song.id,
      duration_hours: durationHours,
      orchestra_size: orchestraSize || undefined,
      recording_version: recordingVersion,
      recording_type: recordingType,
      rehearsal_bonus: rehearsalBonus,
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
    });
    onComplete();
  };

  const canBook = selectedSlotId && canAfford;

  return (
    <div className="space-y-6">
      {/* Date Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Recording Date
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, 'PPP')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => { 
                  if (date) { 
                    setSelectedDate(date); 
                    setSelectedSlotId(''); 
                  }
                }}
                disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {/* Time Slot Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Time Slot ({durationHours} hours)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSlots ? (
            <div className="text-center py-4 text-muted-foreground">Loading availability...</div>
          ) : (
            <RadioGroup value={selectedSlotId} onValueChange={setSelectedSlotId}>
              <div className="grid grid-cols-2 gap-2">
                {STUDIO_SLOTS.map(slot => {
                  const slotData = slotAvailability?.find(s => s.slot.id === slot.id);
                  const isBooked = slotData?.isBooked || false;
                  const isPast = isSlotInPast(slot, selectedDate);
                  const canSelect = !isBooked && !isPast;
                  
                  return (
                    <div 
                      key={slot.id} 
                      className={cn(
                        'flex items-center space-x-2 rounded-lg border p-3 transition-colors',
                        selectedSlotId === slot.id && 'border-primary bg-primary/5',
                        isPast && 'opacity-50 cursor-not-allowed',
                        isBooked && 'bg-destructive/10 border-destructive/30',
                        canSelect && 'cursor-pointer hover:bg-accent/50'
                      )} 
                      onClick={() => canSelect && setSelectedSlotId(slot.id)}
                    >
                      <RadioGroupItem value={slot.id} disabled={!canSelect} />
                      <div className="flex-1">
                        <Label className="font-semibold">{slot.name}</Label>
                        <div className="text-xs text-muted-foreground">
                          {slot.startTime} - {slot.endTime}
                        </div>
                        <div className="mt-1">
                          {isBooked && <Badge variant="destructive" className="text-xs">Booked</Badge>}
                          {isPast && !isBooked && <Badge variant="secondary" className="text-xs">Passed</Badge>}
                          {canSelect && <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 border-green-500/30">Available</Badge>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </RadioGroup>
          )}
        </CardContent>
      </Card>

      {/* Orchestra */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Orchestra (Optional)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ORCHESTRA_OPTIONS.map((opt) => (
            <div key={opt.size} className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50">
              <Checkbox
                id={`orch-${opt.size}`}
                checked={orchestraSize === opt.size}
                onCheckedChange={(checked) => setOrchestraSize(checked ? opt.size : null)}
              />
              <Label htmlFor={`orch-${opt.size}`} className="flex-1 cursor-pointer">
                <div className="font-semibold capitalize">{opt.size} Orchestra ({opt.musicians} musicians)</div>
                <div className="text-sm text-muted-foreground">+{opt.bonus}% quality • ${opt.cost.toLocaleString()}</div>
              </Label>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Cost Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Cost Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Studio ({durationHours} hrs × ${studioHourlyRate.toLocaleString()}{!isDemo ? ' × 2.5' : ''})
            </span>
            {isLabelOwnedStudio ? (
              <div className="flex items-center gap-2">
                <span className="line-through text-muted-foreground text-xs">${(studioHourlyRate * durationHours * costMultiplier).toLocaleString()}</span>
                <span className="font-semibold text-green-600">FREE (Label Studio)</span>
              </div>
            ) : (
              <span className="font-semibold">${studioCost.toLocaleString()}</span>
            )}
          </div>
          {!isDemo && (
            <div className="text-xs text-muted-foreground">Professional rate: 2.5× standard</div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Producer ({durationHours} hrs × ${producerCostPerHour.toLocaleString()})</span>
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
          </div>
        </CardContent>
      </Card>

      {!canAfford && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-semibold mb-1">Insufficient funds!</div>
            <div className="text-sm">Shortfall: ${balanceShortfall.toLocaleString()}</div>
          </AlertDescription>
        </Alert>
      )}

      {/* Quality Preview */}
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
              <div className="text-sm text-muted-foreground">Current</div>
              <div className="text-2xl font-bold">{songQualityScore}</div>
            </div>
            <Music2 className="h-8 w-8 text-muted-foreground" />
            <div className="text-right">
              <div className="text-sm text-muted-foreground">After Recording</div>
              <div className="text-2xl font-bold text-primary">{finalQuality}</div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Improvement</span>
              <Badge variant="default">+{qualityImprovement} ({qualityImprovementPercent}%)</Badge>
            </div>
            <Progress value={Math.min(100, qualityImprovementPercent)} className="h-2" />
          </div>
          {/* Type-specific modifiers */}
          <div className="space-y-1 border-t pt-3">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Recording Type</span>
              <Badge variant={isDemo ? 'secondary' : 'default'} className="text-xs">
                {isDemo ? 'Demo' : 'Professional'}
              </Badge>
            </div>
            {isDemo && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Demo quality cap</span>
                <span className="text-orange-500 font-medium">Max {demoCap}</span>
              </div>
            )}
            {isDemo && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Demo multiplier</span>
                <span className="text-orange-500 font-medium">0.7×</span>
              </div>
            )}
            {!isDemo && isLabelSigned && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Label bonus</span>
                <span className="text-green-600 font-medium">+15%</span>
              </div>
            )}
            {!isDemo && !isLabelSigned && independentPenalty > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Independent penalty</span>
                <span className="text-orange-500 font-medium">-{independentPenalty}%</span>
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
          disabled={createSession.isPending || !canBook}
          className="flex-1"
        >
          {createSession.isPending ? 'Booking...' : `Book Recording ($${totalCost.toLocaleString()})`}
        </Button>
      </div>
    </div>
  );
};