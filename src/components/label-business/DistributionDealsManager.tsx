import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Truck, Plus, Globe, Calendar } from "lucide-react";
import { useLabelDistributionDeals, useCreateDistributionDeal } from "@/hooks/useLabelBusiness";
import { DISTRIBUTION_TYPES } from "@/types/label-business";
import { formatDistanceToNow } from "date-fns";

interface DistributionDealsManagerProps {
  labelId: string;
}

const DISTRIBUTORS = [
  { name: 'DistroKid', digitalCut: 0, description: 'Keep 100% of royalties' },
  { name: 'TuneCore', digitalCut: 0, description: 'Annual fee, keep all royalties' },
  { name: 'CD Baby', digitalCut: 9, description: 'One-time fee + 9% cut' },
  { name: 'AWAL', digitalCut: 15, description: 'Premium distribution services' },
  { name: 'The Orchard', digitalCut: 20, description: 'Full-service major distributor' },
  { name: 'Warner Music', digitalCut: 25, description: 'Major label distribution' },
  { name: 'Universal', digitalCut: 30, description: 'Global major distribution' },
];

export function DistributionDealsManager({ labelId }: DistributionDealsManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [distributorName, setDistributorName] = useState("");
  const [dealType, setDealType] = useState<string>("digital");
  const [revenueShare, setRevenueShare] = useState("15");
  const [advanceAmount, setAdvanceAmount] = useState("0");
  const [minReleases, setMinReleases] = useState("");
  
  const { data: deals, isLoading } = useLabelDistributionDeals(labelId);
  const createDeal = useCreateDistributionDeal();
  
  const handleDistributorSelect = (name: string) => {
    setDistributorName(name);
    const dist = DISTRIBUTORS.find(d => d.name === name);
    if (dist) {
      setRevenueShare(dist.digitalCut.toString());
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await createDeal.mutateAsync({
      label_id: labelId,
      distributor_name: distributorName,
      deal_type: dealType,
      revenue_share_pct: parseFloat(revenueShare),
      advance_amount: parseFloat(advanceAmount) || 0,
      minimum_releases: minReleases ? parseInt(minReleases) : undefined,
      territories: ['worldwide'],
    });
    
    setDialogOpen(false);
    setDistributorName("");
    setDealType("digital");
    setRevenueShare("15");
    setAdvanceAmount("0");
    setMinReleases("");
  };
  
  if (isLoading) {
    return <div className="text-center py-4">Loading distribution deals...</div>;
  }
  
  const activeDeal = deals?.find(d => d.is_active);
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Distribution Deals
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Deal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Distribution Deal</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Distributor</Label>
                <Select value={distributorName} onValueChange={handleDistributorSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select distributor" />
                  </SelectTrigger>
                  <SelectContent>
                    {DISTRIBUTORS.map((dist) => (
                      <SelectItem key={dist.name} value={dist.name}>
                        <div className="flex items-center justify-between w-full">
                          <span>{dist.name}</span>
                          <span className="text-muted-foreground ml-2">({dist.digitalCut}% cut)</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Deal Type</Label>
                <Select value={dealType} onValueChange={setDealType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select deal type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DISTRIBUTION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div>
                          <span>{type.label}</span>
                          <span className="text-muted-foreground text-xs ml-2">- {type.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Revenue Share (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={revenueShare}
                    onChange={(e) => setRevenueShare(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Advance Amount ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Minimum Releases (Optional)</Label>
                <Input
                  type="number"
                  min="1"
                  value={minReleases}
                  onChange={(e) => setMinReleases(e.target.value)}
                  placeholder="No minimum"
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={createDeal.isPending}>
                {createDeal.isPending ? "Creating..." : "Create Deal"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {deals?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Truck className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No distribution deals</p>
            <p className="text-sm">Sign a deal to distribute your releases</p>
          </div>
        ) : (
          <div className="space-y-4">
            {deals?.map((deal) => (
              <div 
                key={deal.id} 
                className={`p-4 rounded-lg border ${deal.is_active ? 'border-primary bg-primary/5' : 'border-border'}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{deal.distributor_name}</h4>
                      {deal.is_active && <Badge>Active</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground capitalize">
                      {deal.deal_type} distribution
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{deal.revenue_share_pct}% cut</p>
                    {deal.advance_amount > 0 && (
                      <p className="text-sm text-green-500">
                        ${deal.advance_amount.toLocaleString()} advance
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    <span>{deal.territories?.join(', ') || 'Worldwide'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>Started {formatDistanceToNow(new Date(deal.start_date), { addSuffix: true })}</span>
                  </div>
                  {deal.minimum_releases && (
                    <span>Min {deal.minimum_releases} releases</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
