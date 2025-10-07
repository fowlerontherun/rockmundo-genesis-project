import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, TrendingUp, Music, Users, Store } from 'lucide-react';
import { format } from 'date-fns';

interface BandEarningsProps {
  bandId: string;
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
  band_balance: number;
  name: string;
}

export function BandEarnings({ bandId }: BandEarningsProps) {
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

  useEffect(() => {
    loadEarningsData();
  }, [bandId]);

  const loadEarningsData = async () => {
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
      }
    } catch (error) {
      console.error('Error loading earnings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
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
                      <p className="font-medium capitalize">{earning.source}</p>
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
                    <p className="text-lg font-bold text-green-500">
                      +${earning.amount.toLocaleString()}
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
