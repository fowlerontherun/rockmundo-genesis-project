import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import {
  DollarSign,
  TrendingUp,
  Music,
  Users,
  Store,
  ArrowUpCircle,
  ArrowDownCircle,
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

export function BandEarnings({ bandId, isLeader = false }: BandEarningsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [bandInfo, setBandInfo] = useState<BandInfo | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    gigs: 0,
    streaming: 0,
    merchandise: 0,
    other: 0,
  });
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [transactionNote, setTransactionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

        // Calculate stats
        const statsCalc = {
          total: earningsData.reduce((sum, e) => sum + e.amount, 0),
          gigs: earningsData.filter(e => e.source === 'gig').reduce((sum, e) => sum + e.amount, 0),
          streaming: earningsData.filter(e => e.source === 'streaming').reduce((sum, e) => sum + e.amount, 0),
          merchandise: earningsData.filter(e => e.source === 'merchandise').reduce((sum, e) => sum + e.amount, 0),
          other: earningsData.filter(e => !['gig', 'streaming', 'merchandise'].includes(e.source)).reduce((sum, e) => sum + e.amount, 0),
        };
        setStats(statsCalc);
      } else {
        setEarnings([]);
        setStats({ total: 0, gigs: 0, streaming: 0, merchandise: 0, other: 0 });
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

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'leader_deposit':
        return <DollarSign className="h-4 w-4" />;
      case 'leader_withdrawal':
        return <Users className="h-4 w-4" />;
      case 'gig':
        return <Music className="h-4 w-4" />;
      case 'streaming':
        return <TrendingUp className="h-4 w-4" />;
      case 'merchandise':
        return <Store className="h-4 w-4" />;
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
      case 'gig':
        return 'bg-blue-500/10 text-blue-500';
      case 'streaming':
        return 'bg-green-500/10 text-green-500';
      case 'merchandise':
        return 'bg-purple-500/10 text-purple-500';
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

    if (type === 'withdraw' && (bandInfo.band_balance ?? 0) < parsedAmount) {
      toast({
        title: 'Insufficient funds',
        description: 'Your band balance is too low for this withdrawal.',
        variant: 'destructive',
      });
      return;
    }

    const note = transactionNote.trim();
    const delta = type === 'deposit' ? parsedAmount : -parsedAmount;

    setSubmitting(true);

    try {
      const currentBalance = bandInfo.band_balance ?? 0;
      const newBalance = currentBalance + delta;

      const { data: updatedBand, error: updateError } = await supabase
        .from('bands')
        .update({ band_balance: newBalance })
        .eq('id', bandId)
        .select('band_balance, name')
        .single();

      if (updateError) throw updateError;

      const { error: insertError } = await supabase.from('band_earnings').insert({
        band_id: bandId,
        amount: delta,
        source: type === 'deposit' ? 'leader_deposit' : 'leader_withdrawal',
        description: note || null,
        earned_by_user_id: user.id,
      });

      if (insertError) throw insertError;

      setBandInfo(prev => (prev ? { ...prev, band_balance: updatedBand.band_balance } : updatedBand));

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

      await loadEarningsData();
    } catch (error: any) {
      console.error('Error managing band funds:', error);
      toast({
        title: 'Unable to update funds',
        description: error.message || 'Something went wrong while updating the band balance.',
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
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="band-deposit">Deposit amount</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="band-deposit"
                    type="number"
                    min="1"
                    value={depositAmount}
                    onChange={(event) => setDepositAmount(event.target.value)}
                    placeholder="Enter amount"
                  />
                  <Button
                    type="button"
                    onClick={() => handleManualTransaction('deposit')}
                    disabled={submitting || !depositAmount}
                    className="flex items-center gap-2"
                  >
                    <ArrowUpCircle className="h-4 w-4" />
                    Deposit
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use this to fund upcoming rehearsals, studio time, or marketing pushes.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="band-withdraw">Withdraw amount</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="band-withdraw"
                    type="number"
                    min="1"
                    value={withdrawAmount}
                    onChange={(event) => setWithdrawAmount(event.target.value)}
                    placeholder="Enter amount"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => handleManualTransaction('withdraw')}
                    disabled={submitting || !withdrawAmount}
                    className="flex items-center gap-2"
                  >
                    <ArrowDownCircle className="h-4 w-4" />
                    Withdraw
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Funds cannot exceed the current band balance (${bandInfo?.band_balance?.toLocaleString() || 0}).
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

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Music className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Gigs</span>
            </div>
            <p className="text-2xl font-bold">${stats.gigs.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Streaming</span>
            </div>
            <p className="text-2xl font-bold">${stats.streaming.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Store className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">Merch</span>
            </div>
            <p className="text-2xl font-bold">${stats.merchandise.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-muted-foreground">Other</span>
            </div>
            <p className="text-2xl font-bold">${stats.other.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Earnings History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Earnings</CardTitle>
          <CardDescription>Latest income transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {earnings.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No earnings yet. Start performing gigs to earn money!
            </div>
          ) : (
            <div className="space-y-3">
              {earnings.map((earning) => (
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
