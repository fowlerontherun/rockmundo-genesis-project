import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import {
  DollarSign,
  TrendingUp,
  Music,
  Users,
  Store,
  ArrowUpCircle,
  ArrowDownCircle,
  Video,
  Radio,
  ShoppingBag,
  Filter,
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth-context';

interface BandEarningsProps {
  bandId: string;
  isLeader?: boolean;
}

interface Earning {
  id: string;
  amount: number;
  source: string;
  description: string | null;
  created_at: string;
  earned_by_user_id: string | null;
  profile?: {
    display_name: string;
  };
}

interface BandInfo {
  band_balance: number | null;
  name: string;
}

interface LeaderProfileSummary {
  id: string;
  cash: number;
}

export function BandEarnings({ bandId, isLeader = false }: BandEarningsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [bandInfo, setBandInfo] = useState<BandInfo | null>(null);
  const [leaderProfile, setLeaderProfile] = useState<LeaderProfileSummary | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    gigs: 0,
    streaming: 0,
    merchandise: 0,
    music_video: 0,
    release_sales: 0,
    pr: 0,
    other: 0,
  });
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [transactionNote, setTransactionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadLeaderProfile = useCallback(async () => {
    if (!user) {
      setLeaderProfile(null);
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, cash')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Failed to load leader profile balance:', error);
        return null;
      }

      const normalized: LeaderProfileSummary = {
        id: data.id,
        cash: typeof data.cash === 'number' ? data.cash : 0,
      };

      setLeaderProfile(normalized);
      return normalized;
    } catch (profileError) {
      console.error('Error loading leader profile balance:', profileError);
      return null;
    }
  }, [user]);

  const loadEarningsData = useCallback(async () => {
    setLoading(true);
    try {
      // Load band info
      const { data: band } = await supabase
        .from('bands')
        .select('band_balance, name')
        .eq('id', bandId)
        .single();

      setBandInfo(band);

      // Load earnings
      const { data: earningsData, error } = await supabase
        .from('band_earnings')
        .select('id, amount, source, description, created_at, earned_by_user_id')
        .eq('band_id', bandId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Load profiles for earnings
      if (earningsData && earningsData.length > 0) {
        const userIds = [...new Set(earningsData.map(e => e.earned_by_user_id).filter(Boolean))];
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, display_name')
            .in('user_id', userIds);

          const earningsWithProfiles = earningsData.map(earning => ({
            ...earning,
            profile: profiles?.find(p => p.user_id === earning.earned_by_user_id),
          }));

          setEarnings(earningsWithProfiles as Earning[]);
        } else {
          setEarnings(earningsData as Earning[]);
        }

        // Calculate stats - match actual source values from database
        const gigSources = ['gig', 'gig_performance', 'gig_revenue', 'ticket_sales'];
        const streamingSources = ['streaming', 'stream', 'radio'];
        const merchSources = ['merchandise', 'merch', 'merch_sales'];
        const videoSources = ['music_video'];
        const salesSources = ['release_sales', 'release'];
        const prSources = ['pr_appearance'];
        const allKnownSources = [...gigSources, ...streamingSources, ...merchSources, ...videoSources, ...salesSources, ...prSources, 'leader_deposit', 'leader_withdrawal', 'recording', 'refund'];
        
        const statsCalc = {
          total: earningsData.reduce((sum, e) => sum + e.amount, 0),
          gigs: earningsData.filter(e => gigSources.includes(e.source)).reduce((sum, e) => sum + e.amount, 0),
          streaming: earningsData.filter(e => streamingSources.includes(e.source)).reduce((sum, e) => sum + e.amount, 0),
          merchandise: earningsData.filter(e => merchSources.includes(e.source)).reduce((sum, e) => sum + e.amount, 0),
          music_video: earningsData.filter(e => videoSources.includes(e.source)).reduce((sum, e) => sum + e.amount, 0),
          release_sales: earningsData.filter(e => salesSources.includes(e.source)).reduce((sum, e) => sum + e.amount, 0),
          pr: earningsData.filter(e => prSources.includes(e.source)).reduce((sum, e) => sum + e.amount, 0),
          other: earningsData.filter(e => !allKnownSources.includes(e.source)).reduce((sum, e) => sum + e.amount, 0),
        };
        setStats(statsCalc);
      } else {
        setEarnings([]);
        setStats({ total: 0, gigs: 0, streaming: 0, merchandise: 0, music_video: 0, release_sales: 0, pr: 0, other: 0 });
      }
    } catch (error) {
      console.error('Error loading earnings:', error);
    } finally {
      setLoading(false);
    }
  }, [bandId]);

  useEffect(() => {
    loadEarningsData();
  }, [loadEarningsData]);

  useEffect(() => {
    if (isLeader) {
      void loadLeaderProfile();
    }
  }, [isLeader, loadLeaderProfile]);

  const SOURCE_GROUPS: Record<string, string[]> = {
    gigs: ['gig', 'gig_performance', 'gig_revenue', 'ticket_sales'],
    streaming: ['streaming', 'stream', 'radio'],
    merchandise: ['merchandise', 'merch', 'merch_sales'],
    music_video: ['music_video'],
    release_sales: ['release_sales', 'release'],
    pr: ['pr_appearance'],
    other: [],
  };

  const filteredEarnings = useMemo(() => {
    if (!sourceFilter) return earnings;
    const sources = SOURCE_GROUPS[sourceFilter];
    if (!sources || sources.length === 0) {
      // "other" = everything not in known groups
      const allKnown = Object.values(SOURCE_GROUPS).flat();
      return earnings.filter(e => !allKnown.includes(e.source));
    }
    return earnings.filter(e => sources.includes(e.source));
  }, [earnings, sourceFilter]);

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'leader_deposit':
        return <DollarSign className="h-4 w-4" />;
      case 'leader_withdrawal':
        return <Users className="h-4 w-4" />;
      case 'gig': case 'gig_performance': case 'gig_revenue': case 'ticket_sales':
        return <Music className="h-4 w-4" />;
      case 'streaming': case 'stream': case 'radio':
        return <TrendingUp className="h-4 w-4" />;
      case 'merchandise': case 'merch': case 'merch_sales':
        return <Store className="h-4 w-4" />;
      case 'music_video':
        return <Video className="h-4 w-4" />;
      case 'release_sales': case 'release':
        return <ShoppingBag className="h-4 w-4" />;
      case 'pr_appearance':
        return <Radio className="h-4 w-4" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'leader_deposit':
        return 'bg-amber-500/10 text-amber-500';
      case 'leader_withdrawal':
        return 'bg-red-500/10 text-red-500';
      case 'gig': case 'gig_performance': case 'gig_revenue': case 'ticket_sales':
        return 'bg-blue-500/10 text-blue-500';
      case 'streaming': case 'stream': case 'radio':
        return 'bg-green-500/10 text-green-500';
      case 'merchandise': case 'merch': case 'merch_sales':
        return 'bg-purple-500/10 text-purple-500';
      case 'music_video':
        return 'bg-pink-500/10 text-pink-500';
      case 'release_sales': case 'release':
        return 'bg-cyan-500/10 text-cyan-500';
      case 'pr_appearance':
        return 'bg-orange-500/10 text-orange-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  const handleManualTransaction = async (type: 'deposit' | 'withdraw') => {
    if (!bandInfo) {
      return;
    }

    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'You must be signed in to manage band funds.',
        variant: 'destructive',
      });
      return;
    }

    const rawAmount = type === 'deposit' ? depositAmount : withdrawAmount;
    const parsedAmount = Math.floor(Number(rawAmount));

    if (!rawAmount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Enter a positive amount to continue.',
        variant: 'destructive',
      });
      return;
    }

    const note = transactionNote.trim();
    const bandDelta = type === 'deposit' ? parsedAmount : -parsedAmount;
    const personalDelta = -bandDelta;

    setSubmitting(true);

    try {
      // Get latest profile balance
      const { data: latestProfile } = await supabase
        .from('profiles')
        .select('id, cash')
        .eq('user_id', user.id)
        .single();

      if (!latestProfile) {
        toast({
          title: 'Profile required',
          description: 'Create your artist profile before managing shared funds.',
          variant: 'destructive',
        });
        return;
      }

      const currentPersonalCash = latestProfile.cash || 0;
      const nextPersonalCash = currentPersonalCash + personalDelta;
      const currentBandBalance = bandInfo.band_balance || 0;
      const nextBandBalance = currentBandBalance + bandDelta;

      // Validation checks
      if (type === 'withdraw' && nextBandBalance < 0) {
        toast({
          title: 'Insufficient funds',
          description: 'Your band balance is too low for this withdrawal.',
          variant: 'destructive',
        });
        return;
      }

      if (type === 'deposit' && nextPersonalCash < 0) {
        toast({
          title: 'Not enough personal funds',
          description: 'You do not have enough personal cash to make this deposit.',
          variant: 'destructive',
        });
        return;
      }

      // Update personal cash
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ cash: nextPersonalCash })
        .eq('id', latestProfile.id);

      if (profileError) throw profileError;

      // Insert into band_earnings - trigger will update band_balance automatically
      const { error: earningsError } = await supabase
        .from('band_earnings')
        .insert({
          band_id: bandId,
          amount: bandDelta,
          source: type === 'deposit' ? 'leader_deposit' : 'leader_withdrawal',
          description: note || null,
          earned_by_user_id: user.id,
        });

      if (earningsError) throw earningsError;

      toast({
        title: type === 'deposit' ? 'Deposit successful' : 'Withdrawal successful',
        description:
          type === 'deposit'
            ? `Added $${parsedAmount.toLocaleString()} to the band balance.`
            : `Withdrawn $${parsedAmount.toLocaleString()} from the band balance.`,
      });

      if (type === 'deposit') {
        setDepositAmount('');
      } else {
        setWithdrawAmount('');
      }
      setTransactionNote('');

      // Reload data
      await Promise.all([loadEarningsData(), loadLeaderProfile()]);
    } catch (error) {
      console.error('Error managing band funds:', error);

      const fallbackMessage =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : 'Something went wrong while updating the band balance.';

      toast({
        title: 'Unable to update funds',
        description: fallbackMessage,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Loading earnings...</p>
      </div>
    );
  }

  const availablePersonalCash = leaderProfile?.cash ?? 0;
  const currentBandBalance = bandInfo?.band_balance ?? 0;
  const plannedDeposit = Number(depositAmount || 0);
  const plannedWithdrawal = Number(withdrawAmount || 0);

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Band Balance</CardTitle>
              <CardDescription>Current funds available</CardDescription>
            </div>
            <DollarSign className="h-8 w-8 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold">${bandInfo?.band_balance?.toLocaleString() || 0}</p>
        </CardContent>
      </Card>

      {isLeader && (
        <Card>
          <CardHeader>
            <CardTitle>Manage Band Funds</CardTitle>
            <CardDescription>
              Deposit personal money into the band or withdraw funds for expenses.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              <p>
                Personal cash available: <span className="font-semibold text-foreground">${availablePersonalCash.toLocaleString()}</span>
              </p>
              <p>
                Band balance after adjustments cannot fall below $0, and deposits draw from your personal funds.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="band-deposit">Deposit amount</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="band-deposit"
                    type="number"
                    min="1"
                    max={availablePersonalCash > 0 ? availablePersonalCash : undefined}
                    value={depositAmount}
                    onChange={(event) => setDepositAmount(event.target.value)}
                    placeholder="Enter amount"
                  />
                  <Button
                    type="button"
                    onClick={() => handleManualTransaction('deposit')}
                    disabled={
                      submitting ||
                      !depositAmount ||
                      (leaderProfile != null && plannedDeposit > availablePersonalCash)
                    }
                    className="flex items-center gap-2"
                  >
                    <ArrowUpCircle className="h-4 w-4" />
                    Deposit
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use this to fund upcoming rehearsals, studio time, or marketing pushes. You can only deposit up to your
                  available personal cash.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="band-withdraw">Withdraw amount</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="band-withdraw"
                    type="number"
                    min="1"
                    max={currentBandBalance > 0 ? currentBandBalance : undefined}
                    value={withdrawAmount}
                    onChange={(event) => setWithdrawAmount(event.target.value)}
                    placeholder="Enter amount"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => handleManualTransaction('withdraw')}
                    disabled={
                      submitting ||
                      !withdrawAmount ||
                      (bandInfo != null && plannedWithdrawal > currentBandBalance)
                    }
                    className="flex items-center gap-2"
                  >
                    <ArrowDownCircle className="h-4 w-4" />
                    Withdraw
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Funds cannot exceed the current band balance (${currentBandBalance.toLocaleString()}). Withdrawals add to
                  your personal cash.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="band-transaction-note">Note (optional)</Label>
              <Input
                id="band-transaction-note"
                placeholder="Add context for this transaction"
                value={transactionNote}
                onChange={(event) => setTransactionNote(event.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {!isLeader && (
        <Card>
          <CardHeader>
            <CardTitle>Band Fund Access</CardTitle>
            <CardDescription>
              Only the band leader can deposit into or withdraw from the shared balance. Reach out to your
              leader if you need funds moved.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Stats Grid - clickable filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { key: 'gigs', label: 'Gigs', icon: <Music className="h-4 w-4 text-blue-500" />, value: stats.gigs, sources: ['gig', 'gig_performance', 'gig_revenue', 'ticket_sales'] },
          { key: 'streaming', label: 'Streaming', icon: <TrendingUp className="h-4 w-4 text-green-500" />, value: stats.streaming, sources: ['streaming', 'stream', 'radio'] },
          { key: 'merchandise', label: 'Merch', icon: <Store className="h-4 w-4 text-purple-500" />, value: stats.merchandise, sources: ['merchandise', 'merch', 'merch_sales'] },
          { key: 'music_video', label: 'Music Videos', icon: <Video className="h-4 w-4 text-pink-500" />, value: stats.music_video, sources: ['music_video'] },
          { key: 'release_sales', label: 'Sales', icon: <ShoppingBag className="h-4 w-4 text-cyan-500" />, value: stats.release_sales, sources: ['release_sales', 'release'] },
          { key: 'pr', label: 'PR & Media', icon: <Radio className="h-4 w-4 text-orange-500" />, value: stats.pr, sources: ['pr_appearance'] },
          { key: 'other', label: 'Other', icon: <DollarSign className="h-4 w-4 text-muted-foreground" />, value: stats.other, sources: [] },
        ].filter(s => s.value !== 0).map(stat => (
          <Card 
            key={stat.key} 
            className={`cursor-pointer transition-all hover:ring-1 hover:ring-primary/50 ${sourceFilter === stat.key ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setSourceFilter(sourceFilter === stat.key ? null : stat.key)}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                {stat.icon}
                <span className="text-sm text-muted-foreground">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold">${stat.value.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active filter indicator */}
      {sourceFilter && (
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filtered by:</span>
          <Badge variant="secondary" className="cursor-pointer" onClick={() => setSourceFilter(null)}>
            {sourceFilter.replace(/_/g, ' ')} ✕
          </Badge>
        </div>
      )}

      {/* Earnings History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Earnings</CardTitle>
          <CardDescription>Latest income transactions {sourceFilter ? `(${sourceFilter.replace(/_/g, ' ')})` : ''}</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredEarnings.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {sourceFilter ? `No ${sourceFilter.replace(/_/g, ' ')} earnings found.` : 'No earnings yet. Start performing gigs to earn money!'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEarnings.map((earning) => (
                <div
                  key={earning.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${getSourceColor(earning.source)}`}>
                      {getSourceIcon(earning.source)}
                    </div>
                    <div>
                      <p className="font-medium capitalize">{earning.source.replace(/_/g, ' ')}</p>
                      {earning.description && (
                        <p className="text-sm text-muted-foreground">{earning.description}</p>
                      )}
                      {earning.profile && (
                        <p className="text-xs text-muted-foreground">
                          Earned by {earning.profile.display_name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-lg font-bold ${earning.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}
                    >
                      {earning.amount >= 0 ? '+' : '-'}${Math.abs(earning.amount).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(earning.created_at), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
