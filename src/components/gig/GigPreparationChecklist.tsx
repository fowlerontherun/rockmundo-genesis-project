import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, XCircle, Music, Users, Zap } from "lucide-react";

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
}

export const GigPreparationChecklist = ({
  setlistSongs,
  rehearsals,
  equipmentCount,
  crewCount,
  bandChemistry
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
