import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Disc, Users, FileText, DollarSign, Music, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VipGate } from "@/components/company/VipGate";

// Hook to fetch label by ID or company_id (dual lookup pattern)
function useLabelByIdOrCompanyId(idOrCompanyId: string | undefined) {
  return useQuery({
    queryKey: ['label-management', idOrCompanyId],
    queryFn: async () => {
      if (!idOrCompanyId) return null;
      
      // Dual lookup: try by id OR company_id for subsidiary navigation
      const { data, error } = await supabase
        .from('labels')
        .select(`
          *,
          cities:headquarters_city_id(name, country)
        `)
        .or(`id.eq.${idOrCompanyId},company_id.eq.${idOrCompanyId}`)
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!idOrCompanyId,
  });
}

// Hook to fetch artists signed to this label
function useLabelArtists(labelId: string | undefined) {
  return useQuery({
    queryKey: ['label-artists', labelId],
    queryFn: async () => {
      if (!labelId) return [];
      
      const { data, error } = await supabase
        .from('artist_label_contracts')
        .select(`
          *,
          bands:band_id(id, name, genre)
        `)
        .eq('label_id', labelId)
        .eq('status', 'active');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!labelId,
  });
}

// Hook to fetch demo submissions to this label
function useLabelDemoSubmissions(labelId: string | undefined) {
  return useQuery({
    queryKey: ['label-demos', labelId],
    queryFn: async () => {
      if (!labelId) return [];
      
      const { data, error } = await supabase
        .from('demo_submissions')
        .select(`
          *,
          bands:band_id(id, name),
          songs:song_id(title)
        `)
        .eq('label_id', labelId)
        .order('submitted_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!labelId,
  });
}

export default function LabelManagement() {
  const { labelId } = useParams();
  const navigate = useNavigate();
  
  const { data: label, isLoading } = useLabelByIdOrCompanyId(labelId);
  const { data: artists } = useLabelArtists(label?.id);
  const { data: demos } = useLabelDemoSubmissions(label?.id);
  
  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }
  
  if (!label) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <Disc className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Record Label Not Found</h2>
          <p className="text-muted-foreground mb-4">The record label you're looking for doesn't exist or you don't have access.</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const pendingDemos = demos?.filter(d => d.status === 'pending') || [];
  const activeArtists = artists?.length || 0;
  const isPlayerOwned = !!label?.owner_id;
  
  return (
    <VipGate feature="Record Label" description="Manage your record label, sign artists, and oversee releases.">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Disc className="h-6 w-6" />
              {label.name}
              {isPlayerOwned && (
                <Crown className="h-5 w-5 text-warning" />
              )}
            </h1>
            <p className="text-muted-foreground">
              {label.genre_focus?.join(', ') || 'All Genres'}
            </p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Balance</p>
              <p className={`text-xl font-bold ${(label.balance || 0) < 0 ? 'text-destructive' : ''}`}>
                {formatCurrency(label.balance || 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">label funds</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Signed Artists</p>
              <p className="text-xl font-bold">{activeArtists}</p>
              <p className="text-xs text-muted-foreground mt-1">active contracts</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Roster Slots</p>
              <p className="text-xl font-bold">{label.roster_slot_capacity || 5}</p>
              <p className="text-xs text-muted-foreground mt-1">max artists</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Pending Demos</p>
              <p className="text-xl font-bold">{pendingDemos.length}</p>
              <p className="text-xs text-muted-foreground mt-1">awaiting review</p>
            </CardContent>
          </Card>
        </div>
        
        <Tabs defaultValue="roster" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="roster" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Roster</span>
            </TabsTrigger>
            <TabsTrigger value="demos" className="flex items-center gap-2">
              <Music className="h-4 w-4" />
              <span className="hidden sm:inline">Demos</span>
            </TabsTrigger>
            <TabsTrigger value="contracts" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Contracts</span>
            </TabsTrigger>
            <TabsTrigger value="finances" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Finances</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="roster">
            <Card>
              <CardContent className="pt-6">
                {artists && artists.length > 0 ? (
                  <div className="space-y-4">
                    {artists.map((contract) => (
                      <div key={contract.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                            <Users className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-semibold">{contract.bands?.name || 'Unknown Artist'}</p>
                            <p className="text-sm text-muted-foreground">{contract.bands?.genre}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">{contract.royalty_artist_pct}% royalty</p>
                          <p className="text-xs text-muted-foreground">
                            {contract.releases_completed}/{contract.release_quota} releases
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No artists signed yet</p>
                    <p className="text-sm">Review demo submissions to sign new artists</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="demos">
            <Card>
              <CardContent className="pt-6">
                {demos && demos.length > 0 ? (
                  <div className="space-y-4">
                    {demos.map((demo) => (
                      <div key={demo.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-semibold">{demo.bands?.name || 'Unknown Band'}</p>
                          <p className="text-sm text-muted-foreground">{demo.songs?.title || 'Untitled Demo'}</p>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs px-2 py-1 rounded ${
                            demo.status === 'pending' ? 'bg-amber-500/20 text-amber-500' :
                            demo.status === 'accepted' ? 'bg-emerald-500/20 text-emerald-500' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {demo.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No demo submissions</p>
                    <p className="text-sm">Artists will submit demos for your review</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="contracts">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Contract management coming soon</p>
                  <p className="text-sm">View and manage artist contracts</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="finances">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Current Balance</p>
                      <p className="text-xl font-bold">{formatCurrency(label.balance || 0)}</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">A&R Budget</p>
                      <p className="text-xl font-bold">{formatCurrency(label.a_and_r_budget || 0)}</p>
                    </div>
                  </div>
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    <p>Use the Finance button on the Company card for deposits/withdrawals</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </VipGate>
  );
}
