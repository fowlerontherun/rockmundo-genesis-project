import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileText, Plus, Star, Trash2, Edit, Copy, 
  DollarSign, TrendingUp, Users, CheckCircle
} from 'lucide-react';
import { useBandRiders, RIDER_TIERS, BandRider } from '@/hooks/useBandRiders';
import { RiderBuilder } from '@/components/riders/RiderBuilder';
import { useAuth } from '@/hooks/use-auth-context';
import { usePrimaryBand } from '@/hooks/usePrimaryBand';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const TIER_COLORS: Record<string, string> = {
  basic: 'bg-slate-500',
  standard: 'bg-blue-500',
  professional: 'bg-purple-500',
  star: 'bg-amber-500',
  legendary: 'bg-gradient-to-r from-amber-500 to-orange-500',
};

export default function BandRiders() {
  const { user } = useAuth();
  const { data: primaryBandRecord, isLoading: bandLoading } = usePrimaryBand();
  const band = primaryBandRecord?.bands;
  const { riders, ridersLoading, deleteRider, setDefaultRider, createRider } = useBandRiders(band?.id || null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [showBuilder, setShowBuilder] = useState(false);
  const [editingRider, setEditingRider] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('my-riders');

  const handleCreateRider = () => {
    setEditingRider(null);
    setShowBuilder(true);
  };

  const handleEditRider = (riderId: string) => {
    setEditingRider(riderId);
    setShowBuilder(true);
  };

  const handleDeleteRider = async (rider: BandRider) => {
    if (!confirm(`Delete "${rider.name}"? This cannot be undone.`)) return;
    await deleteRider.mutateAsync(rider.id);
  };

  const handleDuplicateRider = async (rider: BandRider) => {
    await createRider.mutateAsync({
      band_id: rider.band_id,
      name: `${rider.name} (Copy)`,
      description: rider.description,
      tier: rider.tier,
      is_default: false,
      total_cost_estimate: rider.total_cost_estimate,
    });
    toast({ title: 'Rider duplicated', description: 'You can now edit the copy.' });
  };

  if (bandLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (!band) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Band Found</h2>
            <p className="text-muted-foreground mb-4">
              You need to be in a band to create riders
            </p>
            <Button onClick={() => navigate('/band')}>
              Create or Join a Band
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Band Riders</h1>
          <p className="text-muted-foreground">
            Create and manage your technical and hospitality requirements for gigs
          </p>
        </div>
        <Button onClick={handleCreateRider}>
          <Plus className="mr-2 h-4 w-4" />
          Create Rider
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="my-riders">My Riders</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="my-riders" className="space-y-4">
          {ridersLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-20 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : riders && riders.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {riders.map((rider) => {
                const tierConfig = RIDER_TIERS.find(t => t.id === rider.tier);
                
                return (
                  <Card key={rider.id} className="relative group">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2">
                            {rider.name}
                            {rider.is_default && (
                              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                            )}
                          </CardTitle>
                          <CardDescription>
                            {rider.description || 'No description'}
                          </CardDescription>
                        </div>
                        <Badge className={cn("text-white", TIER_COLORS[rider.tier])}>
                          {tierConfig?.name || rider.tier}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <DollarSign className="h-4 w-4" />
                          <span>${rider.total_cost_estimate?.toLocaleString() || 0}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => handleEditRider(rider.id)}
                        >
                          <Edit className="mr-2 h-3 w-3" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDuplicateRider(rider)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        {!rider.is_default && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDefaultRider.mutateAsync(rider.id)}
                          >
                            <Star className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteRider(rider)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Riders Yet</h3>
                <p className="text-muted-foreground mb-4 max-w-md">
                  Riders specify your technical equipment, hospitality, and backstage requirements. 
                  Create one to ensure your shows have everything you need!
                </p>
                <Button onClick={handleCreateRider}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Rider
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {RIDER_TIERS.map((tier) => (
              <Card key={tier.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {tier.name}
                    <Badge className={cn("text-white", TIER_COLORS[tier.id])}>
                      Template
                    </Badge>
                  </CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div>Max items: {tier.maxItems}</div>
                    <div>Cost modifier: {tier.costMultiplier}x</div>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      setEditingRider(null);
                      setShowBuilder(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Use Template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Rider Builder Dialog */}
      <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {editingRider ? 'Edit Rider' : 'Create New Rider'}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-120px)]">
            <div className="pr-4">
              <RiderBuilder
                bandId={band?.id || ''}
                bandFame={band?.fame || 0}
                riderId={editingRider || undefined}
                onSave={() => setShowBuilder(false)}
                onCancel={() => setShowBuilder(false)}
              />
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
