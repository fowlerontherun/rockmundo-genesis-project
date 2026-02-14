import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Clock, DollarSign, TrendingDown, TrendingUp, Shield, AlertTriangle, Disc3, Music } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface RecordingTypeSelectorProps {
  studio: any;
  bandId?: string | null;
  userId: string;
  selectedType: 'demo' | 'professional' | null;
  onSelect: (type: 'demo' | 'professional') => void;
}

interface LabelStatus {
  isLabelSigned: boolean;
  labelName?: string;
}

interface PlayerStats {
  fame: number;
  level: number;
}

export const calculateIndependentPenalty = (fame: number, level: number): number => {
  if (fame >= 500000 || level >= 50) return 0;
  const fameReduction = Math.floor(fame / 100000) * 3;
  const levelReduction = Math.floor(level / 10) * 3;
  const totalReduction = Math.min(fameReduction + levelReduction, 15);
  return Math.max(0, 15 - totalReduction);
};

export const RecordingTypeSelector = ({ studio, bandId, userId, selectedType, onSelect }: RecordingTypeSelectorProps) => {
  const [labelStatus, setLabelStatus] = useState<LabelStatus>({ isLabelSigned: false });
  const [playerStats, setPlayerStats] = useState<PlayerStats>({ fame: 0, level: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Fetch label contract status
      if (bandId) {
        const { data: contract } = await supabase
          .from('artist_label_contracts')
          .select('id, label_id, labels:label_id(name)')
          .eq('band_id', bandId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        if (contract) {
          setLabelStatus({
            isLabelSigned: true,
            labelName: (contract as any).labels?.name || 'Label',
          });
        }
      }

      // Fetch player fame & level
      const { data: profile } = await supabase
        .from('profiles')
        .select('fame, level')
        .eq('user_id', userId)
        .single();

      if (profile) {
        setPlayerStats({ fame: profile.fame || 0, level: profile.level || 1 });
      }

      setLoading(false);
    };
    fetchData();
  }, [bandId, userId]);

  const studioQuality = Number(studio?.quality_rating ?? 0);
  const studioRate = Number(studio?.hourly_rate ?? 0);
  const demoCap = Math.round(studioQuality * 0.6);
  const penalty = calculateIndependentPenalty(playerStats.fame, playerStats.level);
  const penaltyProgress = Math.round(((15 - penalty) / 15) * 100);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading recording options...</div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Choose your recording approach. Demos are quick and cheap but quality-capped. Professional recordings produce release-quality tracks.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Demo Card */}
        <Card
          className={`cursor-pointer transition-all hover:border-primary/50 ${selectedType === 'demo' ? 'border-primary ring-2 ring-primary/20' : ''}`}
          onClick={() => onSelect('demo')}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Disc3 className="h-5 w-5 text-muted-foreground" />
                Demo
              </CardTitle>
              <Badge variant="secondary">Quick & Cheap</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>1 slot (4 hours)</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span>${(studioRate * 4).toLocaleString()} (standard rate)</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <TrendingDown className="h-4 w-4 text-orange-500" />
              <span>0.7x quality multiplier</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span>Quality capped at <strong>{demoCap}</strong> (studio: {studioQuality})</span>
            </div>
            <div className="border-t pt-3 mt-3">
              <p className="text-xs text-muted-foreground">
                Good for testing ideas and early-career recordings. No label needed.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Professional Card */}
        <Card
          className={`cursor-pointer transition-all hover:border-primary/50 ${selectedType === 'professional' ? 'border-primary ring-2 ring-primary/20' : ''}`}
          onClick={() => onSelect('professional')}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Music className="h-5 w-5 text-primary" />
                Professional
              </CardTitle>
              <Badge variant="default">Release Quality</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>2 slots (8 hours)</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span>${(studioRate * 8 * 2.5).toLocaleString()} (2.5x rate)</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span>Full quality potential (no cap)</span>
            </div>

            {/* Label Status */}
            {labelStatus.isLabelSigned ? (
              <div className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-green-500" />
                <span className="text-green-600">+15% label bonus ({labelStatus.labelName})</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span className="text-orange-600">
                    {penalty > 0 ? `-${penalty}% independent penalty` : 'No penalty (fame/level override)'}
                  </span>
                </div>
                {penalty > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Overcoming penalty</span>
                      <span>{penaltyProgress}%</span>
                    </div>
                    <Progress value={penaltyProgress} className="h-1.5" />
                    <p className="text-xs text-muted-foreground">
                      Fame ({(playerStats.fame / 1000).toFixed(0)}k/500k) or Level ({playerStats.level}/50) removes penalty
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="border-t pt-3 mt-3">
              <p className="text-xs text-muted-foreground">
                Full studio sessions for release-ready tracks. Label backing gives a quality boost.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
