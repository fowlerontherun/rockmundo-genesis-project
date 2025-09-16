import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building, 
  DollarSign, 
  TrendingUp, 
  Star, 
  Music, 
  Users,
  AlertCircle,
  Handshake,
  Calendar,
  Award,
  FileText,
  Crown
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useGameData } from "@/hooks/useGameData";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { meetsRequirements, calculateGigPayment } from "@/utils/gameBalance";

interface RecordLabel {
  id: string;
  name: string;
  prestige: number;
  advance_payment: number;
  royalty_rate: number;
  requirements: Record<string, number>;
  description: string;
  benefits: string[];
}

interface Contract {
  id: string;
  label_id: string | null;
  label_name: string;
  contract_type: 'demo' | 'single' | 'album' | 'exclusive';
  duration_months: number;
  advance_payment: number;
  advance_balance: number;
  recouped_amount: number;
  royalty_rate: number;
  signed_at: string;
  status: 'pending' | 'active' | 'completed' | 'terminated';
}

const RecordLabel = () => {
  const { user } = useAuth();
  const { profile, skills, refetch } = useGameData();
  const { toast } = useToast();
  const [labels, setLabels] = useState<RecordLabel[]>([]);
  const [playerContracts, setPlayerContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [releasedSongCount, setReleasedSongCount] = useState(0);
  const [bestChartPosition, setBestChartPosition] = useState<number | null>(null);

  const parseNumeric = (value: unknown): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const formatCurrency = (value: number) =>
    parseNumeric(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  useEffect(() => {
    if (user) {
      loadLabels();
      loadPlayerContracts();
      loadPlayerCareerStats();
    }
  }, [user]);

  const loadLabels = async () => {
    try {
      // Mock record labels data (in a real app, these would be in the database)
      const mockLabels: RecordLabel[] = [
        {
          id: '1',
          name: 'Indie Underground Records',
          prestige: 1,
          advance_payment: 5000,
          royalty_rate: 0.15,
          requirements: { fame: 500, songs: 3 },
          description: 'A small independent label focusing on emerging artists.',
          benefits: ['Studio access', 'Basic promotion', 'Digital distribution']
        },
        {
          id: '2',
          name: 'City Sounds Music',
          prestige: 2,
          advance_payment: 15000,
          royalty_rate: 0.12,
          requirements: { fame: 2000, songs: 5, performance: 60 },
          description: 'Regional label with good distribution network.',
          benefits: ['Professional recording', 'Radio promotion', 'Regional touring support']
        },
        {
          id: '3',
          name: 'Thunder Records',
          prestige: 3,
          advance_payment: 50000,
          royalty_rate: 0.10,
          requirements: { fame: 10000, songs: 8, performance: 80, chart_position: 50 },
          description: 'Major label with national reach and big budgets.',
          benefits: ['Top-tier studios', 'National radio', 'Music videos', 'Tour support']
        },
        {
          id: '4',
          name: 'Global Megacorp Music',
          prestige: 4,
          advance_payment: 200000,
          royalty_rate: 0.08,
          requirements: { fame: 50000, songs: 12, performance: 95, chart_position: 10 },
          description: 'International mega-label for superstar artists only.',
          benefits: ['World-class production', 'Global promotion', 'International tours', 'Award campaigns']
        }
      ];

      setLabels(mockLabels);
    } catch (error) {
      console.error('Error loading labels:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load record labels"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPlayerContracts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('contracts')
        .select(
          'id, label_id, label_name, contract_type, duration_months, advance_payment, advance_balance, recouped_amount, royalty_rate, signed_at, status'
        )
        .eq('user_id', user.id)
        .order('signed_at', { ascending: false });

      if (error) throw error;

      const parsedContracts: Contract[] = (data ?? []).map((contract) => ({
        id: contract.id,
        label_id: contract.label_id,
        label_name: contract.label_name,
        contract_type: contract.contract_type as Contract['contract_type'],
        duration_months: contract.duration_months,
        advance_payment: parseNumeric(contract.advance_payment),
        advance_balance: parseNumeric(contract.advance_balance),
        recouped_amount: parseNumeric(contract.recouped_amount),
        royalty_rate: typeof contract.royalty_rate === 'string'
          ? parseFloat(contract.royalty_rate)
          : contract.royalty_rate ?? 0,
        signed_at: contract.signed_at ?? new Date().toISOString(),
        status: (contract.status as Contract['status']) ?? 'active'
      }));

      setPlayerContracts(parsedContracts);
    } catch (error) {
      console.error('Error loading contracts:', error);
      setPlayerContracts([]);
    }
  };

  const loadPlayerCareerStats = async () => {
    if (!user) return;

    try {
      const { data: songsData, error: songsError } = await supabase
        .from('songs')
        .select('id, status, chart_position')
        .eq('user_id', user.id);

      if (songsError) throw songsError;

      const songs = songsData || [];
      const releasedSongs = songs.filter(song => song.status === 'released');
      setReleasedSongCount(releasedSongs.length);

      let bestPosition: number | null = null;
      const releasedSongIds = releasedSongs.map(song => song.id);

      if (releasedSongIds.length > 0) {
        const { data: chartData, error: chartError } = await supabase
          .from('chart_entries')
          .select('rank')
          .in('song_id', releasedSongIds)
          .order('rank', { ascending: true })
          .limit(1);

        if (chartError) throw chartError;

        if (chartData && chartData.length > 0) {
          bestPosition = chartData[0].rank;
        }
      }

      if (bestPosition === null) {
        const songPositions = songs
          .map(song => song.chart_position)
          .filter((position): position is number => typeof position === 'number' && position > 0);

        if (songPositions.length > 0) {
          bestPosition = Math.min(...songPositions);
        }
      }

      setBestChartPosition(bestPosition);
    } catch (error) {
      console.error('Error loading player career stats:', error);
    }
  };

  const requirementLabels: Record<string, string> = {
    fame: 'Fame',
    songs: 'Released Songs',
    performance: 'Performance',
    chart_position: 'Chart Peak'
  };

  const getRequirementThresholdValue = (key: string, value: number): number => {
    if (key === 'chart_position') {
      return Math.max(0, 101 - value);
    }
    return value;
  };

  const getPlayerStatValue = (key: string): number => {
    switch (key) {
      case 'fame':
        return profile?.fame ?? 0;
      case 'songs':
        return releasedSongCount;
      case 'performance':
        return skills?.performance ?? 0;
      case 'chart_position':
        return bestChartPosition !== null ? Math.max(0, 101 - bestChartPosition) : 0;
      default: {
        const profileRecord = profile as Record<string, unknown> | null;
        if (profileRecord && typeof profileRecord[key] === 'number') {
          return profileRecord[key] as number;
        }
        const skillsRecord = skills as Record<string, unknown> | null;
        if (skillsRecord && typeof skillsRecord[key] === 'number') {
          return skillsRecord[key] as number;
        }
        return 0;
      }
    }
  };

  const getRequirementLabel = (key: string): string => {
    if (requirementLabels[key]) {
      return requirementLabels[key];
    }
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const getPlayerDisplayValue = (key: string): string => {
    switch (key) {
      case 'fame':
        return (profile?.fame ?? 0).toLocaleString();
      case 'songs':
        return releasedSongCount.toString();
      case 'performance':
        return (skills?.performance ?? 0).toString();
      case 'chart_position':
        return bestChartPosition !== null ? `#${bestChartPosition}` : 'Uncharted';
      default: {
        const profileRecord = profile as Record<string, unknown> | null;
        if (profileRecord && typeof profileRecord[key] === 'number') {
          return (profileRecord[key] as number).toLocaleString();
        }
        const skillsRecord = skills as Record<string, unknown> | null;
        if (skillsRecord && typeof skillsRecord[key] === 'number') {
          return (skillsRecord[key] as number).toLocaleString();
        }
        return '0';
      }
    }
  };

  const getRequirementDisplayValue = (key: string, value: number): string => {
    switch (key) {
      case 'fame':
        return value.toLocaleString();
      case 'songs':
        return value.toString();
      case 'performance':
        return value.toString();
      case 'chart_position':
        return `Top ${value}`;
      default:
        return value.toString();
    }
  };

  const buildNormalizedRequirements = (requirements: Record<string, number>): Record<string, number> => {
    return Object.fromEntries(
      Object.entries(requirements).map(([key, value]) => [key, getRequirementThresholdValue(key, value)])
    ) as Record<string, number>;
  };

  const buildPlayerStats = (requirements: Record<string, number>): Record<string, number> => {
    return Object.fromEntries(
      Object.keys(requirements).map((key) => [key, getPlayerStatValue(key)])
    ) as Record<string, number>;
  };

  const getUnmetRequirementMessages = (requirements: Record<string, number>): string[] => {
    const unmetMessages: string[] = [];

    Object.entries(requirements).forEach(([key, value]) => {
      if (getPlayerStatValue(key) < getRequirementThresholdValue(key, value)) {
        unmetMessages.push(
          `${getRequirementLabel(key)}: ${getRequirementDisplayValue(key, value)} required (you have ${getPlayerDisplayValue(key)})`
        );
      }
    });

    return unmetMessages;
  };

  const signContract = async (label: RecordLabel, contractType: string) => {
    if (!user || !profile || !skills) return;

    try {
      // Check if player meets requirements
      const normalizedRequirements = buildNormalizedRequirements(label.requirements);
      const playerStats = buildPlayerStats(label.requirements);
      const { meets } = meetsRequirements(normalizedRequirements, playerStats);

      if (!meets) {
        const missing = getUnmetRequirementMessages(label.requirements);
        toast({
          variant: "destructive",
          title: "Requirements Not Met",
          description: `You need: ${missing.join(', ')}`
        });
        return;
      }

      // Calculate contract terms based on type
      let duration, advance, royalty;
      switch (contractType) {
        case 'demo':
          duration = 6;
          advance = Math.floor(label.advance_payment * 0.2);
          royalty = label.royalty_rate * 0.8;
          break;
        case 'single':
          duration = 12;
          advance = Math.floor(label.advance_payment * 0.5);
          royalty = label.royalty_rate;
          break;
        case 'album':
          duration = 24;
          advance = label.advance_payment;
          royalty = label.royalty_rate;
          break;
        case 'exclusive':
          duration = 36;
          advance = Math.floor(label.advance_payment * 1.5);
          royalty = label.royalty_rate * 0.9;
          break;
        default:
          return;
      }

      const currentCash = profile.cash ?? 0;

      const { data: newContract, error: contractError } = await supabase
        .from('contracts')
        .insert({
          user_id: user.id,
          label_id: label.id,
          label_name: label.name,
          contract_type: contractType,
          duration_months: duration,
          advance_payment: advance,
          advance_balance: advance,
          recouped_amount: 0,
          royalty_rate: royalty,
          status: 'active'
        })
        .select()
        .single();

      if (contractError) throw contractError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ cash: currentCash + advance })
        .eq('user_id', user.id);

      if (profileError) {
        if (newContract?.id) {
          await supabase.from('contracts').delete().eq('id', newContract.id);
        }
        throw profileError;
      }

      const { error: activityError } = await supabase
        .from('activity_feed')
        .insert({
          user_id: user.id,
          activity_type: 'contract',
          message: `Signed ${contractType} contract with ${label.name}`,
          earnings: advance
        });

      if (activityError) throw activityError;

      await loadPlayerContracts();
      await refetch();

      toast({
        title: "Contract Signed!",
        description: `Welcome to ${label.name}! You received $${advance.toLocaleString()} advance payment.`
      });
    } catch (error) {
      console.error('Error signing contract:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to sign contract"
      });
    }
  };

  const getPrestigeIcon = (prestige: number) => {
    switch (prestige) {
      case 1: return <Building className="h-5 w-5" />;
      case 2: return <Star className="h-5 w-5" />;
      case 3: return <Award className="h-5 w-5" />;
      case 4: return <Crown className="h-5 w-5" />;
      default: return <Building className="h-5 w-5" />;
    }
  };

  const getPrestigeColor = (prestige: number) => {
    switch (prestige) {
      case 1: return 'text-muted-foreground';
      case 2: return 'text-primary';
      case 3: return 'text-warning';
      case 4: return 'text-success';
      default: return 'text-muted-foreground';
    }
  };

  const canSign = (label: RecordLabel) => {
    if (!profile || !skills) return false;

    const normalizedRequirements = buildNormalizedRequirements(label.requirements);
    const playerStats = buildPlayerStats(label.requirements);
    const { meets } = meetsRequirements(normalizedRequirements, playerStats);
    return meets;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-oswald">Loading record labels...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bebas tracking-wider bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
            Record Labels
          </h1>
          <p className="text-muted-foreground font-oswald">Get signed and boost your music career</p>
        </div>

        <Tabs defaultValue="available" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="available">Available Labels</TabsTrigger>
            <TabsTrigger value="contracts">My Contracts ({playerContracts.length})</TabsTrigger>
          </TabsList>

          {/* Available Labels */}
          <TabsContent value="available">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {labels.map((label) => (
                <Card key={label.id} className="bg-card/80 backdrop-blur-sm border-primary/20">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-secondary ${getPrestigeColor(label.prestige)}`}>
                          {getPrestigeIcon(label.prestige)}
                        </div>
                        <div>
                          <CardTitle className="text-xl">{label.name}</CardTitle>
                          <CardDescription>
                            {Array.from({ length: label.prestige }, (_, i) => '⭐').join('')} Prestige Level {label.prestige}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{label.description}</p>

                    {/* Contract Terms */}
                    <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-secondary/30">
                      <div>
                        <p className="text-sm text-muted-foreground">Advance Payment</p>
                        <p className="font-semibold text-success">${label.advance_payment.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Royalty Rate</p>
                        <p className="font-semibold text-primary">{(label.royalty_rate * 100).toFixed(1)}%</p>
                      </div>
                    </div>

                    {/* Requirements */}
                    <div>
                      <h4 className="font-semibold mb-2">Requirements</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {Object.entries(label.requirements).map(([req, value]) => {
                          const threshold = getRequirementThresholdValue(req, value);
                          const playerValue = getPlayerStatValue(req);
                          const meets = playerValue >= threshold;
                          const requirementLabel = getRequirementLabel(req);
                          const playerDisplay = getPlayerDisplayValue(req);
                          const requirementDisplay = getRequirementDisplayValue(req, value);
                          return (
                            <div key={req} className={`flex justify-between ${meets ? 'text-success' : 'text-muted-foreground'}`}>
                              <span>{requirementLabel}</span>
                              <span>{playerDisplay} / {requirementDisplay} {meets ? '✓' : '✗'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Benefits */}
                    <div>
                      <h4 className="font-semibold mb-2">Label Benefits</h4>
                      <div className="flex flex-wrap gap-1">
                        {label.benefits.map((benefit, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {benefit}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Contract Options */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {['demo', 'single', 'album', 'exclusive'].map((type) => (
                        <Button
                          key={type}
                          size="sm"
                          variant={canSign(label) ? "default" : "outline"}
                          disabled={!canSign(label)}
                          onClick={() => signContract(label, type)}
                          className="capitalize"
                        >
                          <Handshake className="h-3 w-3 mr-1" />
                          {type} Deal
                        </Button>
                      ))}
                    </div>

                    {!canSign(label) && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Build your career to meet this label's requirements
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Player Contracts */}
          <TabsContent value="contracts">
            <div className="space-y-4">
              {playerContracts.length > 0 ? playerContracts.map((contract) => {
                const totalAdvance = parseNumeric(contract.advance_payment);
                const remainingBalance = Math.max(0, parseNumeric(contract.advance_balance));
                const recoupedAmount = Math.max(0, totalAdvance - remainingBalance);
                const recoupProgress = totalAdvance > 0
                  ? Math.min(100, (recoupedAmount / totalAdvance) * 100)
                  : 100;
                const isRecouped = remainingBalance <= 0.01;

                return (
                  <Card key={contract.id} className="bg-card/80 backdrop-blur-sm border-primary/20">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            {contract.label_name}
                          </CardTitle>
                          <CardDescription className="capitalize">
                            {contract.contract_type} Contract • {contract.duration_months} months
                          </CardDescription>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            contract.status === 'active' ? 'text-success border-success' :
                            contract.status === 'pending' ? 'text-warning border-warning' :
                            'text-muted-foreground'
                          }
                        >
                          {contract.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Advance Received</p>
                          <p className="font-semibold text-success">${formatCurrency(totalAdvance)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Royalty Rate</p>
                          <p className="font-semibold text-primary">{(contract.royalty_rate * 100).toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Signed Date</p>
                          <p className="font-semibold">{new Date(contract.signed_at).toLocaleDateString()}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Recoup Progress</span>
                          <span>{Math.round(recoupProgress)}%</span>
                        </div>
                        <Progress value={recoupProgress} className="h-2" />
                        <div className="flex justify-between text-sm">
                          <span className="text-success">Recouped: ${formatCurrency(recoupedAmount)}</span>
                          <span>
                            Remaining:
                            <span className={`font-semibold ml-1 ${isRecouped ? 'text-success' : 'text-warning'}`}>
                              ${formatCurrency(remainingBalance)}
                            </span>
                          </span>
                        </div>
                        {isRecouped && (
                          <p className="text-sm text-success font-medium">
                            Advance fully recouped! Future royalties go directly to you.
                          </p>
                        )}
                      </div>

                      {contract.status === 'active' && (
                        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                          <p className="text-sm text-primary font-medium">
                            ✨ Active contract benefits: Professional recording, promotion support, and higher royalties
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              }) : (
                <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                  <CardContent className="text-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Record Deals</h3>
                    <p className="text-muted-foreground mb-4">
                      Sign with a record label to boost your career and get financial support
                    </p>
                    <Button onClick={() => (document.querySelector('[value="available"]') as HTMLElement)?.click()}>
                      Browse Labels
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default RecordLabel;