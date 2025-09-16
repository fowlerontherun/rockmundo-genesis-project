import { useState, useEffect, FormEvent } from "react";
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
import { useUserRole } from "@/hooks/useUserRole";
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

interface RecordLabelForm extends Omit<RecordLabel, "id"> {
  id?: string;
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
  const { isAdmin: isAdminRole, loading: roleLoading } = useUserRole();
  const [labels, setLabels] = useState<RecordLabel[]>([]);
  const [playerContracts, setPlayerContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [releasedSongCount, setReleasedSongCount] = useState(0);
  const [bestChartPosition, setBestChartPosition] = useState<number | null>(null);
  const [labelForm, setLabelForm] = useState<RecordLabelForm>(() => ({
    name: "",
    prestige: 1,
    advance_payment: 0,
    royalty_rate: 0.1,
    description: "",
    requirements: {},
    benefits: []
  }));
  const [requirementKey, setRequirementKey] = useState("");
  const [requirementValue, setRequirementValue] = useState("");
  const [benefitInput, setBenefitInput] = useState("");
  const [savingLabel, setSavingLabel] = useState(false);
  const [deletingLabelId, setDeletingLabelId] = useState<string | null>(null);

  const canManageLabels = !roleLoading && isAdminRole();

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
      const { data, error } = await supabase
        .from('record_labels')
        .select('id, name, prestige, advance_payment, royalty_rate, description, requirements, benefits')
        .order('prestige', { ascending: true })
        .order('advance_payment', { ascending: true });

      if (error) throw error;

      const formattedLabels: RecordLabel[] = (data ?? []).map((label) => {
        const requirementsData = (label as { requirements?: Record<string, unknown> }).requirements ?? {};
        const normalizedRequirements = Object.entries(requirementsData).reduce<Record<string, number>>(
          (acc, [key, value]) => {
            const numericValue =
              typeof value === 'number'
                ? value
                : typeof value === 'string'
                  ? Number(value)
                  : 0;

            if (!Number.isNaN(numericValue)) {
              acc[key] = numericValue;
            }
            return acc;
          },
          {}
        );

        const benefitsData = (label as { benefits?: unknown }).benefits;

        return {
          id: (label as { id: string }).id,
          name: (label as { name?: string }).name ?? 'Unknown Label',
          prestige: (label as { prestige?: number }).prestige ?? 0,
          advance_payment: (label as { advance_payment?: number }).advance_payment ?? 0,
          royalty_rate: typeof (label as { royalty_rate?: unknown }).royalty_rate === 'string'
            ? parseFloat((label as { royalty_rate?: string }).royalty_rate ?? '0')
            : (label as { royalty_rate?: number }).royalty_rate ?? 0,
          description: (label as { description?: string }).description ?? '',
          requirements: normalizedRequirements,
          benefits: Array.isArray(benefitsData)
            ? benefitsData.filter((benefit): benefit is string => typeof benefit === 'string')
            : []
        };
      });

      setLabels(formattedLabels);
    } catch (error) {
      console.error('Error loading labels:', error);
      setLabels([]);
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

  const resetLabelForm = () => {
    setLabelForm({
      id: undefined,
      name: "",
      prestige: 1,
      advance_payment: 0,
      royalty_rate: 0.1,
      description: "",
      requirements: {},
      benefits: []
    });
    setRequirementKey("");
    setRequirementValue("");
    setBenefitInput("");
  };

  const startEditLabel = (label: RecordLabel) => {
    setLabelForm({
      id: label.id,
      name: label.name,
      prestige: label.prestige,
      advance_payment: label.advance_payment,
      royalty_rate: label.royalty_rate,
      description: label.description,
      requirements: { ...label.requirements },
      benefits: [...label.benefits]
    });
  };

  const addRequirement = () => {
    const key = requirementKey.trim();
    const value = Number(requirementValue);

    if (!key) {
      toast({
        variant: "destructive",
        title: "Requirement name needed",
        description: "Enter a requirement key before adding it."
      });
      return;
    }

    if (Number.isNaN(value) || value < 0) {
      toast({
        variant: "destructive",
        title: "Invalid requirement value",
        description: "Requirement values must be positive numbers."
      });
      return;
    }

    setLabelForm((prev) => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        [key]: value
      }
    }));
    setRequirementKey("");
    setRequirementValue("");
  };

  const removeRequirement = (key: string) => {
    setLabelForm((prev) => {
      const updatedRequirements = { ...prev.requirements };
      delete updatedRequirements[key];
      return {
        ...prev,
        requirements: updatedRequirements
      };
    });
  };

  const addBenefit = () => {
    const benefit = benefitInput.trim();
    if (!benefit) {
      toast({
        variant: "destructive",
        title: "Benefit description needed",
        description: "Enter a benefit before adding it."
      });
      return;
    }

    setLabelForm((prev) => ({
      ...prev,
      benefits: [...prev.benefits, benefit]
    }));
    setBenefitInput("");
  };

  const removeBenefit = (index: number) => {
    setLabelForm((prev) => ({
      ...prev,
      benefits: prev.benefits.filter((_, benefitIndex) => benefitIndex !== index)
    }));
  };

  const handleLabelFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = labelForm.name.trim();
    const trimmedDescription = labelForm.description.trim();

    if (!trimmedName) {
      toast({
        variant: "destructive",
        title: "Label name required",
        description: "Please provide a name for the record label."
      });
      return;
    }

    if (!trimmedDescription) {
      toast({
        variant: "destructive",
        title: "Description required",
        description: "Add a description so players understand this label."
      });
      return;
    }

    setSavingLabel(true);

    try {
      const payload = {
        name: trimmedName,
        prestige: Math.min(Math.max(labelForm.prestige, 1), 5),
        advance_payment: Math.max(Math.round(labelForm.advance_payment), 0),
        royalty_rate: Math.min(Math.max(Number(labelForm.royalty_rate), 0), 1),
        description: trimmedDescription,
        requirements: labelForm.requirements,
        benefits: labelForm.benefits
      };

      if (labelForm.id) {
        const { error } = await supabase
          .from('record_labels')
          .update(payload)
          .eq('id', labelForm.id);

        if (error) throw error;

        toast({
          title: "Label updated",
          description: `${payload.name} has been updated.`
        });
      } else {
        const { error } = await supabase
          .from('record_labels')
          .insert(payload);

        if (error) throw error;

        toast({
          title: "Label created",
          description: `${payload.name} is now available to players.`
        });
      }

      resetLabelForm();
      await loadLabels();
    } catch (error) {
      console.error('Error saving label:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save record label"
      });
    } finally {
      setSavingLabel(false);
    }
  };

  const handleDeleteLabel = async (labelId: string) => {
    if (!confirm('Are you sure you want to delete this record label? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingLabelId(labelId);

      const { error } = await supabase
        .from('record_labels')
        .delete()
        .eq('id', labelId);

      if (error) throw error;

      if (labelForm.id === labelId) {
        resetLabelForm();
      }

      toast({
        title: "Label deleted",
        description: "The record label has been removed."
      });

      await loadLabels();
    } catch (error) {
      console.error('Error deleting label:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete record label"
      });
    } finally {
      setDeletingLabelId(null);
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
          <TabsList className={`grid w-full ${canManageLabels ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <TabsTrigger value="available">Available Labels</TabsTrigger>
            <TabsTrigger value="contracts">My Contracts ({playerContracts.length})</TabsTrigger>
            {canManageLabels && (
              <TabsTrigger value="manage">Manage Labels</TabsTrigger>
            )}
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
          {canManageLabels && (
            <TabsContent value="manage">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                  <CardHeader>
                    <CardTitle>{labelForm.id ? 'Edit Record Label' : 'Create Record Label'}</CardTitle>
                    <CardDescription>
                      Configure the labels that appear for players. Adjust requirements and benefits to balance progression.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleLabelFormSubmit} className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="label-name">Label Name</Label>
                          <Input
                            id="label-name"
                            placeholder="Thunder Records"
                            value={labelForm.name}
                            onChange={(event) => setLabelForm((prev) => ({ ...prev, name: event.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="label-prestige">Prestige Level</Label>
                          <Input
                            id="label-prestige"
                            type="number"
                            min={1}
                            max={5}
                            value={labelForm.prestige}
                            onChange={(event) => setLabelForm((prev) => ({ ...prev, prestige: Number(event.target.value) }))}
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="label-advance">Advance Payment</Label>
                          <Input
                            id="label-advance"
                            type="number"
                            min={0}
                            step={1000}
                            value={labelForm.advance_payment}
                            onChange={(event) => setLabelForm((prev) => ({ ...prev, advance_payment: Number(event.target.value) }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="label-royalty">Royalty Rate</Label>
                          <Input
                            id="label-royalty"
                            type="number"
                            min={0}
                            max={1}
                            step={0.01}
                            value={labelForm.royalty_rate}
                            onChange={(event) => setLabelForm((prev) => ({ ...prev, royalty_rate: Number(event.target.value) }))}
                          />
                          <p className="text-xs text-muted-foreground">Enter as a decimal (e.g. 0.12 for 12%).</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label>Requirements</Label>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Input
                              placeholder="Requirement (e.g. fame)"
                              value={requirementKey}
                              onChange={(event) => setRequirementKey(event.target.value)}
                              className="sm:flex-1"
                            />
                            <Input
                              type="number"
                              min={0}
                              placeholder="Value"
                              value={requirementValue}
                              onChange={(event) => setRequirementValue(event.target.value)}
                              className="sm:w-32"
                            />
                            <Button type="button" variant="secondary" onClick={addRequirement}>
                              Add
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {Object.keys(labelForm.requirements).length > 0 ? (
                            <div className="space-y-2">
                              {Object.entries(labelForm.requirements).map(([key, value]) => (
                                <div
                                  key={key}
                                  className="flex items-center justify-between rounded-md border border-dashed border-primary/20 bg-secondary/30 px-3 py-2"
                                >
                                  <span className="text-sm font-medium">
                                    {getRequirementLabel(key)}: {getRequirementDisplayValue(key, value)}
                                  </span>
                                  <Button type="button" size="sm" variant="ghost" onClick={() => removeRequirement(key)}>
                                    Remove
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">Add requirements to gate higher prestige labels.</p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label>Benefits</Label>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Input
                              placeholder="Benefit (e.g. Studio access)"
                              value={benefitInput}
                              onChange={(event) => setBenefitInput(event.target.value)}
                              className="sm:flex-1"
                            />
                            <Button type="button" variant="secondary" onClick={addBenefit}>
                              Add
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {labelForm.benefits.length > 0 ? (
                            <div className="space-y-2">
                              {labelForm.benefits.map((benefit, index) => (
                                <div
                                  key={`${benefit}-${index}`}
                                  className="flex items-center justify-between rounded-md border border-dashed border-primary/20 bg-secondary/30 px-3 py-2"
                                >
                                  <span className="text-sm">{benefit}</span>
                                  <Button type="button" size="sm" variant="ghost" onClick={() => removeBenefit(index)}>
                                    Remove
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">Share perks that make signing appealing.</p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button type="submit" disabled={savingLabel}>
                          {savingLabel ? 'Saving...' : labelForm.id ? 'Update Label' : 'Create Label'}
                        </Button>
                        {labelForm.id && (
                          <Button type="button" variant="outline" onClick={resetLabelForm}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </form>
                  </CardContent>
                </Card>
                <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                  <CardHeader>
                    <CardTitle>Existing Labels</CardTitle>
                    <CardDescription>Review current labels and make adjustments as your economy evolves.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {labels.length > 0 ? labels.map((label) => (
                        <div key={label.id} className="space-y-3 rounded-lg border border-primary/20 bg-secondary/20 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-lg font-semibold">{label.name}</h3>
                              <p className="text-sm text-muted-foreground">{label.description}</p>
                            </div>
                            <Badge variant="outline">Prestige {label.prestige}</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-muted-foreground">Advance</p>
                              <p className="font-medium">${label.advance_payment.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Royalty</p>
                              <p className="font-medium">{(label.royalty_rate * 100).toFixed(1)}%</p>
                            </div>
                          </div>
                          {Object.keys(label.requirements).length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(label.requirements).map(([key, value]) => (
                                <Badge key={`${label.id}-${key}`} variant="secondary" className="text-xs">
                                  {getRequirementLabel(key)}: {getRequirementDisplayValue(key, value)}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {label.benefits.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {label.benefits.map((benefit, index) => (
                                <Badge key={`${label.id}-benefit-${index}`} variant="outline" className="text-xs">
                                  {benefit}
                                </Badge>
                              ))}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => startEditLabel(label)}>
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => void handleDeleteLabel(label.id)}
                              disabled={deletingLabelId === label.id}
                            >
                              {deletingLabelId === label.id ? 'Deleting...' : 'Delete'}
                            </Button>
                          </div>
                        </div>
                      )) : (
                        <Card className="border-dashed border-primary/20 bg-secondary/10">
                          <CardContent className="py-8 text-center text-sm text-muted-foreground">
                            No record labels found. Create one to populate the player marketplace.
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default RecordLabel;