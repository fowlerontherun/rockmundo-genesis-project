import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Megaphone, TrendingUp, DollarSign, Clock, Zap, Target } from "lucide-react";

interface PromotionalCampaignCardProps {
  releaseId: string;
  releaseTitle: string;
  bandBalance: number;
}

interface Campaign {
  id: string;
  campaign_name: string;
  start_date: string;
  end_date: string;
  effects: Record<string, number>;
}

const CAMPAIGN_TYPES = [
  { id: "social_media_blitz", name: "Social Media Blitz", description: "Boost visibility on Twaater and DikCok", cost: 500, duration: 3, effects: { hypeBoost: 15, streamBoost: 10, followerBoost: 50 } },
  { id: "radio_push", name: "Radio Push Campaign", description: "Get more radio station submissions reviewed", cost: 1000, duration: 5, effects: { hypeBoost: 25, radioBoost: 30, chartsBoost: 5 } },
  { id: "playlist_placement", name: "Playlist Placement Drive", description: "Increase chances of playlist adds", cost: 750, duration: 7, effects: { streamBoost: 40, playlistBoost: 20, hypeBoost: 10 } },
  { id: "press_tour", name: "Virtual Press Tour", description: "Media coverage and interviews", cost: 2000, duration: 5, effects: { hypeBoost: 50, fameBoost: 25, followerBoost: 100 } },
  { id: "influencer_campaign", name: "Influencer Campaign", description: "Partner with DikCok creators", cost: 1500, duration: 4, effects: { hypeBoost: 35, streamBoost: 25, viralChance: 10 } },
];

export const PromotionalCampaignCard = ({ releaseId, releaseTitle, bandBalance }: PromotionalCampaignCardProps) => {
  const queryClient = useQueryClient();
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");

  const { data: activeCampaigns } = useQuery({
    queryKey: ["release-campaigns", releaseId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("promotional_campaigns" as any) as any)
        .select("*")
        .eq("release_id", releaseId)
        .in("status", ["active", "scheduled"]);
      if (error) throw error;
      return (data || []) as Campaign[];
    },
  });

  const launchCampaign = useMutation({
    mutationFn: async (campaignType: string) => {
      const campaign = CAMPAIGN_TYPES.find(c => c.id === campaignType);
      if (!campaign) throw new Error("Invalid campaign type");
      if (bandBalance < campaign.cost) throw new Error("Insufficient funds");

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + campaign.duration);

      const { error } = await (supabase.from("promotional_campaigns" as any) as any).insert({
        release_id: releaseId,
        campaign_type: campaign.id,
        campaign_name: campaign.name,
        budget: campaign.cost,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: "active",
        effects: campaign.effects,
      });
      if (error) throw error;
      return campaign;
    },
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: ["release-campaigns", releaseId] });
      toast.success(`${campaign.name} launched!`);
      setSelectedCampaign("");
    },
    onError: (error) => toast.error("Failed to launch campaign", { description: error.message }),
  });

  const selectedCampaignData = CAMPAIGN_TYPES.find(c => c.id === selectedCampaign);
  const hasActiveCampaign = (activeCampaigns?.length || 0) > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Promotional Campaigns</CardTitle>
        </div>
        <CardDescription>Boost "{releaseTitle}" with marketing</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasActiveCampaign && activeCampaigns?.map(campaign => {
          const daysRemaining = Math.max(0, Math.ceil((new Date(campaign.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
          const totalDays = Math.ceil((new Date(campaign.end_date).getTime() - new Date(campaign.start_date).getTime()) / (1000 * 60 * 60 * 24));
          const progress = ((totalDays - daysRemaining) / totalDays) * 100;

          return (
            <div key={campaign.id} className="p-3 border rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{campaign.campaign_name}</span>
                <Badge variant="default" className="bg-green-500"><Clock className="h-3 w-3 mr-1" />{daysRemaining}d left</Badge>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          );
        })}

        {!hasActiveCampaign && (
          <>
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger><SelectValue placeholder="Select campaign type..." /></SelectTrigger>
              <SelectContent>
                {CAMPAIGN_TYPES.map(campaign => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name} - ${campaign.cost}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedCampaignData && (
              <div className="p-3 bg-secondary/50 rounded-lg text-sm">
                <p>{selectedCampaignData.description}</p>
                <p className="mt-1 text-muted-foreground">${selectedCampaignData.cost} • {selectedCampaignData.duration} days</p>
              </div>
            )}

            <Button onClick={() => launchCampaign.mutate(selectedCampaign)} disabled={!selectedCampaign || launchCampaign.isPending} className="w-full">
              {launchCampaign.isPending ? "Launching..." : "Launch Campaign"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
