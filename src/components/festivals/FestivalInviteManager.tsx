import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Send, Check, X } from "lucide-react";

interface FestivalInviteManagerProps {
  festivalId: string;
}

export function FestivalInviteManager({ festivalId }: FestivalInviteManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBandId, setSelectedBandId] = useState("");
  const [slotType, setSlotType] = useState("supporting");
  const [payoutAmount, setPayoutAmount] = useState("5000");
  const [performanceDate, setPerformanceDate] = useState("");

  const { data: bands } = useQuery({
    queryKey: ["bands-for-invite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bands")
        .select("id, name, fame")
        .order("fame", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const { data: participants } = useQuery({
    queryKey: ["festival-participants", festivalId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("festival_participants")
        .select("*, bands(name, fame)")
        .eq("event_id", festivalId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("festival_participants").insert({
        event_id: festivalId,
        band_id: selectedBandId,
        slot_type: slotType,
        performance_date: performanceDate,
        payout_amount: parseInt(payoutAmount),
        status: "invited",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["festival-participants", festivalId] });
      toast({ title: "Band invited successfully" });
      setSelectedBandId("");
      setPayoutAmount("5000");
      setPerformanceDate("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to invite band",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ participantId, status }: { participantId: string; status: string }) => {
      const { error } = await (supabase as any)
        .from("festival_participants")
        .update({ status })
        .eq("id", participantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["festival-participants", festivalId] });
      toast({ title: "Status updated" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (participantId: string) => {
      const { error } = await (supabase as any)
        .from("festival_participants")
        .delete()
        .eq("id", participantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["festival-participants", festivalId] });
      toast({ title: "Participant removed" });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Invite Band</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="band">Band</Label>
            <Select value={selectedBandId} onValueChange={setSelectedBandId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a band" />
              </SelectTrigger>
              <SelectContent>
                {bands?.map((band) => (
                  <SelectItem key={band.id} value={band.id}>
                    {band.name} (Fame: {band.fame})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="slot">Slot Type</Label>
              <Select value={slotType} onValueChange={setSlotType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="headliner">Headliner</SelectItem>
                  <SelectItem value="co_headliner">Co-Headliner</SelectItem>
                  <SelectItem value="supporting">Supporting</SelectItem>
                  <SelectItem value="opener">Opener</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="payout">Payout ($)</Label>
              <Input
                id="payout"
                type="number"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="date">Performance Date</Label>
              <Input
                id="date"
                type="date"
                value={performanceDate}
                onChange={(e) => setPerformanceDate(e.target.value)}
              />
            </div>
          </div>

          <Button
            onClick={() => inviteMutation.mutate()}
            disabled={!selectedBandId || inviteMutation.isPending}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            Send Invitation
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Participants & Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {participants?.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Badge variant={
                    participant.status === "confirmed" ? "default" :
                    participant.status === "invited" ? "secondary" : "outline"
                  }>
                    {participant.status}
                  </Badge>
                  <div>
                    <div className="font-medium">{participant.bands?.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {participant.slot_type} • ${participant.payout_amount?.toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {participant.status === "invited" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatusMutation.mutate({ 
                          participantId: participant.id, 
                          status: "confirmed" 
                        })}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatusMutation.mutate({ 
                          participantId: participant.id, 
                          status: "declined" 
                        })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => removeMutation.mutate(participant.id)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
