import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { usePrisonStatus } from "@/hooks/usePrisonStatus";
import { useGameData } from "@/hooks/useGameData";
import { useTranslation } from "@/hooks/useTranslation";
import { Link, Navigate } from "react-router-dom";
import { Lock, Calendar, User, DollarSign, Music, AlertTriangle, Scale, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Prison() {
  const { imprisonment, isImprisoned, isLoading, pendingEvents, bailAmount, daysRemaining, behaviorScore, payBail, isPayingBail, chooseEvent, isChoosingEvent, communityService, criminalRecord } = usePrisonStatus();
  const { profile } = useGameData();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  if (!isImprisoned && !communityService) {
    return <Navigate to="/dashboard" replace />;
  }

  const handlePayBail = () => {
    if ((profile as any)?.cash < bailAmount) {
      toast({ title: t('prison.insufficientFunds'), description: `${t('prison.needBailAmount').replace('${amount}', bailAmount.toString())}`, variant: "destructive" });
      return;
    }
    payBail(undefined, {
      onSuccess: () => toast({ title: t('prison.bailPaid'), description: t('prison.youAreFree') }),
      onError: (e) => toast({ title: t('common.error'), description: e.message, variant: "destructive" }),
    });
  };

  const handleEventChoice = (choice: "a" | "b") => {
    if (!selectedEvent) return;
    chooseEvent({ eventId: selectedEvent.id, choice }, {
      onSuccess: (data) => {
        toast({ title: t('prison.choiceMade'), description: data.message });
        setSelectedEvent(null);
      },
      onError: (e) => toast({ title: t('common.error'), description: e.message, variant: "destructive" }),
    });
  };

  // Community Service View
  if (communityService && !isImprisoned) {
    const deadline = new Date(communityService.deadline);
    return (
      <div className="container mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Scale className="h-6 w-6 text-yellow-500" />
          <h1 className="text-2xl font-bold">{t('prison.communityService')}</h1>
        </div>
        <Alert><AlertTriangle className="h-4 w-4" /><AlertTitle>{t('prison.activeAssignment')}</AlertTitle><AlertDescription>{t('prison.completeSessionsBy').replace('{required}', communityService.required_busking_sessions.toString()).replace('{deadline}', deadline.toLocaleDateString())}</AlertDescription></Alert>
        <Card>
          <CardHeader><CardTitle>{t('prison.progress')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm"><span>{t('prison.sessionsCompleted')}</span><span>{communityService.completed_sessions} / {communityService.required_busking_sessions}</span></div>
            <Progress value={(communityService.completed_sessions / communityService.required_busking_sessions) * 100} />
            <div className="flex justify-between text-sm text-muted-foreground"><span>{t('prison.debtToClear')}</span><span>${communityService.debt_amount}</span></div>
            <div className="flex justify-between text-sm text-muted-foreground"><span>{t('prison.timeRemaining')}</span><span>{formatDistanceToNow(deadline)}</span></div>
            <Button asChild className="w-full"><Link to="/busking">{t('prison.goBusking')}</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Prison View
  const prison = imprisonment?.prisons as any;
  const releaseDate = imprisonment?.release_date ? new Date(imprisonment.release_date) : null;

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Lock className="h-6 w-6 text-destructive" />
        <h1 className="text-2xl font-bold">{t('prison.title')}</h1>
        <Badge variant="destructive">{t('prison.imprisoned')}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Status Card */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />{t('prison.sentenceStatus')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-4xl font-bold text-destructive">{daysRemaining}</div>
              <div className="text-sm text-muted-foreground">{t('prison.daysRemaining')}</div>
            </div>
            {releaseDate && <div className="text-sm text-center">{t('prison.release')}: {releaseDate.toLocaleDateString()}</div>}
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span>{t('prison.title')}</span><span>{prison?.name || "Unknown"}</span></div>
              <div className="flex justify-between text-sm"><span>{t('prison.reason')}</span><span className="capitalize">{imprisonment?.reason?.replace(/_/g, " ")}</span></div>
              <div className="flex justify-between text-sm"><span>{t('prison.debtCleared')}</span><span>${imprisonment?.debt_amount_cleared || 0}</span></div>
            </div>
          </CardContent>
        </Card>

        {/* Behavior Card */}
        <Card>
          <CardHeader><CardTitle>{t('prison.behaviorScore')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold">{behaviorScore}</div>
              <Progress value={behaviorScore} className="flex-1" />
            </div>
            <p className="text-sm text-muted-foreground">
              {behaviorScore >= 90 ? t('prison.exemplaryBehavior') : behaviorScore >= 75 ? t('prison.goodBehavior') : behaviorScore >= 60 ? t('prison.averageBehavior') : t('prison.needsImprovement')}
            </p>
            <div className="text-sm"><span className="font-medium">{t('prison.songsWritten')}:</span> {imprisonment?.songs_written || 0}</div>
            {imprisonment?.good_behavior_days_earned > 0 && <Badge variant="secondary">{t('prison.daysOffGoodBehavior').replace('{days}', imprisonment.good_behavior_days_earned.toString())}</Badge>}
          </CardContent>
        </Card>

        {/* Cellmate Card */}
        {imprisonment?.cellmate_name && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />{t('prison.cellmate')}</CardTitle></CardHeader>
            <CardContent>
              <div className="font-medium">{imprisonment.cellmate_name}</div>
              <div className="text-sm text-muted-foreground">{t('prison.expertIn')}: {imprisonment.cellmate_skill}</div>
              <div className="text-sm text-green-600">{t('prison.skillBonusAvailable').replace('{bonus}', imprisonment.cellmate_skill_bonus.toString())}</div>
            </CardContent>
          </Card>
        )}

        {/* Bail Card */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" />{t('prison.bail')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-2xl font-bold">${bailAmount}</div>
            <div className="text-sm text-muted-foreground">{t('prison.yourCash')}: ${(profile as any)?.cash || 0}</div>
            <Button onClick={handlePayBail} disabled={isPayingBail || (profile as any)?.cash < bailAmount} className="w-full">
              {isPayingBail ? t('prison.processing') : t('prison.payBail')}
            </Button>
          </CardContent>
        </Card>

        {/* Actions Card */}
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><Music className="h-5 w-5" />{t('prison.availableActivities')}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{t('prison.activitiesRestricted')}</p>
            <Button asChild><Link to="/songwriting">{t('prison.writeSongs')}</Link></Button>
          </CardContent>
        </Card>
      </div>

      {/* Pending Events */}
      {pendingEvents && pendingEvents.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t('prison.prisonEvents')}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {pendingEvents.map((pe: any) => (
              <div key={pe.id} className="p-3 border rounded-lg cursor-pointer hover:bg-accent" onClick={() => setSelectedEvent(pe)}>
                <div className="font-medium">{pe.prison_events?.title}</div>
                <div className="text-sm text-muted-foreground">{pe.prison_events?.description?.slice(0, 100)}...</div>
                <Badge variant="outline" className="mt-1">{pe.prison_events?.category}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Criminal Record */}
      {criminalRecord && criminalRecord.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t('prison.criminalRecord')}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {criminalRecord.map((record: any) => (
                <div key={record.id} className="flex justify-between text-sm p-2 border rounded">
                  <span className="capitalize">{record.offense_type?.replace(/_/g, " ")}</span>
                  <span>{record.sentence_served_days} {t('prison.daysRemaining').toLowerCase()}</span>
                  <Badge variant={record.behavior_rating === "exemplary" ? "default" : "secondary"}>{record.behavior_rating}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Event Choice Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedEvent?.prison_events?.title}</DialogTitle>
            <DialogDescription>{selectedEvent?.prison_events?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={() => handleEventChoice("a")} disabled={isChoosingEvent}>
              A: {selectedEvent?.prison_events?.option_a_text}
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => handleEventChoice("b")} disabled={isChoosingEvent}>
              B: {selectedEvent?.prison_events?.option_b_text}
            </Button>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setSelectedEvent(null)}>{t('common.cancel')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
