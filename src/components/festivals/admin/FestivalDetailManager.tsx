import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, Music, Users, DollarSign, Star, Shield, Trash2, 
  Headphones, MapPin, Layers 
} from "lucide-react";
import { useFestivalStages, useFestivalStageSlots, useCreateFestivalStage, useAssignBandToSlot, useFillNpcDjSlot } from "@/hooks/useFestivalStages";
import { useFestivalFinances, useFestivalQuality, useCreateFestivalFinances, useUpdateFestivalQuality, calculateFestivalBudget } from "@/hooks/useFestivalFinances";
import { useAvailableSecurityFirms } from "@/hooks/useSecurityFirm";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MUSIC_GENRES } from "@/data/genres";
import { toast } from "sonner";

interface FestivalDetailManagerProps {
  festivalId: string;
  festival: any;
}

export function FestivalDetailManager({ festivalId, festival }: FestivalDetailManagerProps) {
  return (
    <Tabs defaultValue="stages" className="space-y-4">
      <TabsList className="grid grid-cols-4 w-full">
        <TabsTrigger value="stages"><Layers className="h-4 w-4 mr-1" /> Stages</TabsTrigger>
        <TabsTrigger value="finances"><DollarSign className="h-4 w-4 mr-1" /> Finances</TabsTrigger>
        <TabsTrigger value="quality"><Star className="h-4 w-4 mr-1" /> Quality</TabsTrigger>
        <TabsTrigger value="security"><Shield className="h-4 w-4 mr-1" /> Security</TabsTrigger>
      </TabsList>

      <TabsContent value="stages">
        <StageManager festivalId={festivalId} festival={festival} />
      </TabsContent>
      <TabsContent value="finances">
        <FinancesManager festivalId={festivalId} festival={festival} />
      </TabsContent>
      <TabsContent value="quality">
        <QualityManager festivalId={festivalId} />
      </TabsContent>
      <TabsContent value="security">
        <SecurityManager festivalId={festivalId} festival={festival} />
      </TabsContent>
    </Tabs>
  );
}

function StageManager({ festivalId, festival }: { festivalId: string; festival: any }) {
  const { data: stages = [] } = useFestivalStages(festivalId);
  const { data: allSlots = [] } = useFestivalStageSlots(festivalId);
  const createStage = useCreateFestivalStage();
  const assignBand = useAssignBandToSlot();
  const fillNpcDj = useFillNpcDjSlot();
  const queryClient = useQueryClient();
  const [addStageOpen, setAddStageOpen] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [newStageGenre, setNewStageGenre] = useState("");
  const [newStageCapacity, setNewStageCapacity] = useState("500");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [selectedBandId, setSelectedBandId] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");

  const durationDays = festival?.duration_days || 2;
  const maxStages = festival?.max_stages || 5;

  const { data: bands = [] } = useQuery({
    queryKey: ["all-bands-for-festival"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bands").select("id, name, fame").order("fame", { ascending: false }).limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const createSlotsMutation = useMutation({
    mutationFn: async (stageId: string) => {
      const slots = [];
      for (let day = 1; day <= durationDays; day++) {
        // 1 headliner, 2 support, 3 openers per day
        const slotTypes = ["headliner", "support", "support", "opener", "opener", "opener"];
        for (let slot = 1; slot <= 6; slot++) {
          slots.push({
            stage_id: stageId,
            festival_id: festivalId,
            day_number: day,
            slot_number: slot,
            slot_type: slotTypes[slot - 1],
          });
        }
      }
      const { error } = await (supabase as any).from("festival_stage_slots").insert(slots);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["festival-stage-slots", festivalId] });
      toast.success("Slots generated for stage!");
    },
  });

  const handleCreateStage = () => {
    if (!newStageName) return;
    const nextNumber = stages.length + 1;
    if (nextNumber > maxStages) {
      toast.error(`Maximum ${maxStages} stages allowed`);
      return;
    }
    createStage.mutate({
      festival_id: festivalId,
      stage_name: newStageName,
      stage_number: nextNumber,
      capacity: parseInt(newStageCapacity) || 500,
      genre_focus: newStageGenre || null,
    }, {
      onSuccess: (data) => {
        createSlotsMutation.mutate(data.id);
        setAddStageOpen(false);
        setNewStageName("");
        setNewStageGenre("");
      },
    });
  };

  const handleAssignBand = () => {
    if (!selectedSlot || !selectedBandId) return;
    assignBand.mutate({
      slotId: selectedSlot.id,
      bandId: selectedBandId,
      payoutAmount: parseInt(payoutAmount) || 0,
      festivalId,
    }, {
      onSuccess: () => {
        setAssignDialogOpen(false);
        setSelectedSlot(null);
        setSelectedBandId("");
        setPayoutAmount("");
      },
    });
  };

  const handleFillDj = (slot: any, stageGenre: string | null) => {
    const genre = stageGenre || MUSIC_GENRES[Math.floor(Math.random() * MUSIC_GENRES.length)];
    fillNpcDj.mutate({ slotId: slot.id, genre, festivalId });
  };

  const handleAutoFillEmpty = () => {
    const emptySlots = allSlots.filter((s) => s.status === "open" && !s.band_id && !s.is_npc_dj);
    emptySlots.forEach((slot) => {
      const stage = stages.find((s) => s.id === slot.stage_id);
      handleFillDj(slot, stage?.genre_focus || null);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Stages ({stages.length}/{maxStages})</h3>
        <div className="flex gap-2">
          {allSlots.some((s) => s.status === "open") && (
            <Button variant="outline" size="sm" onClick={handleAutoFillEmpty}>
              <Headphones className="h-4 w-4 mr-1" /> Auto-fill NPC DJs
            </Button>
          )}
          <Button size="sm" onClick={() => setAddStageOpen(true)} disabled={stages.length >= maxStages}>
            <Plus className="h-4 w-4 mr-1" /> Add Stage
          </Button>
        </div>
      </div>

      {stages.map((stage) => {
        const stageSlots = allSlots.filter((s) => s.stage_id === stage.id);
        const dayGroups: Record<number, typeof stageSlots> = {};
        stageSlots.forEach((s) => {
          if (!dayGroups[s.day_number]) dayGroups[s.day_number] = [];
          dayGroups[s.day_number].push(s);
        });

        return (
          <Card key={stage.id}>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Music className="h-4 w-4" />
                {stage.stage_name}
                {stage.genre_focus && <Badge variant="secondary">{stage.genre_focus}</Badge>}
                <Badge variant="outline">Cap: {stage.capacity}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.entries(dayGroups).sort(([a], [b]) => Number(a) - Number(b)).map(([day, slots]) => (
                <div key={day} className="mb-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Day {day}</p>
                  <div className="space-y-1">
                    {slots.sort((a, b) => a.slot_number - b.slot_number).map((slot) => (
                      <div key={slot.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-muted/50">
                        <div className="flex items-center gap-2">
                          <Badge variant={slot.slot_type === "headliner" ? "default" : "outline"} className="text-xs w-20 justify-center">
                            {slot.slot_type}
                          </Badge>
                          {slot.band_id && slot.band ? (
                            <span className="font-medium">{slot.band.name}</span>
                          ) : slot.is_npc_dj ? (
                            <span className="text-muted-foreground italic">{slot.npc_dj_name} (Q:{slot.npc_dj_quality})</span>
                          ) : (
                            <span className="text-muted-foreground">Empty</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {slot.payout_amount > 0 && (
                            <span className="text-xs text-muted-foreground">${slot.payout_amount}</span>
                          )}
                          {slot.status === "open" && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => {
                                setSelectedSlot(slot);
                                setAssignDialogOpen(true);
                              }}>
                                <Users className="h-3 w-3 mr-1" /> Assign
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => handleFillDj(slot, stage.genre_focus)}>
                                <Headphones className="h-3 w-3 mr-1" /> DJ
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {stageSlots.length === 0 && (
                <p className="text-sm text-muted-foreground">No slots yet. They are auto-created when a stage is added.</p>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Add Stage Dialog */}
      <Dialog open={addStageOpen} onOpenChange={setAddStageOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Stage</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Stage Name</Label>
              <Input value={newStageName} onChange={(e) => setNewStageName(e.target.value)} placeholder="Main Stage" />
            </div>
            <div>
              <Label>Genre Focus (optional)</Label>
              <Select value={newStageGenre} onValueChange={setNewStageGenre}>
                <SelectTrigger><SelectValue placeholder="Mixed / Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mixed">Mixed</SelectItem>
                  {MUSIC_GENRES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Capacity</Label>
              <Input type="number" value={newStageCapacity} onChange={(e) => setNewStageCapacity(e.target.value)} />
            </div>
            <Button onClick={handleCreateStage} className="w-full">Create Stage & Generate Slots</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Band Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Band to {selectedSlot?.slot_type} Slot</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Band</Label>
              <Select value={selectedBandId} onValueChange={setSelectedBandId}>
                <SelectTrigger><SelectValue placeholder="Select band" /></SelectTrigger>
                <SelectContent>
                  <ScrollArea className="h-48">
                    {bands.map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.name} (Fame: {b.fame})</SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payout ($)</Label>
              <Input type="number" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} placeholder="0" />
            </div>
            <Button onClick={handleAssignBand} className="w-full">Assign Band</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FinancesManager({ festivalId, festival }: { festivalId: string; festival: any }) {
  const { data: finances } = useFestivalFinances(festivalId);
  const createFinances = useCreateFestivalFinances();
  const [ticketPrice, setTicketPrice] = useState(festival?.ticket_price || 50);
  const [projectedAttendance, setProjectedAttendance] = useState(festival?.attendance_projection || 5000);
  const [sponsorshipIncome, setSponsorshipIncome] = useState(finances?.sponsorship_income || 0);
  const [securityCost, setSecurityCost] = useState(finances?.security_cost || 0);
  const [stageCosts, setStageCosts] = useState(finances?.stage_costs || 0);

  const calculated = calculateFestivalBudget({
    ticketPrice, projectedAttendance, sponsorshipIncome, securityCost, stageCosts,
  });

  const handleSave = () => {
    createFinances.mutate({
      festival_id: festivalId,
      ticket_revenue: ticketPrice * projectedAttendance,
      sponsorship_income: sponsorshipIncome,
      security_cost: securityCost,
      stage_costs: stageCosts,
      band_payouts_total: 0,
      festival_tax_rate: 0.15,
      festival_tax_amount: calculated.taxAmount,
      total_profit: calculated.budget,
      budget: calculated.budget,
    });
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Festival Finances</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Ticket Price ($)</Label><Input type="number" value={ticketPrice} onChange={(e) => setTicketPrice(Number(e.target.value))} /></div>
          <div><Label>Projected Attendance</Label><Input type="number" value={projectedAttendance} onChange={(e) => setProjectedAttendance(Number(e.target.value))} /></div>
          <div><Label>Sponsorship Income ($)</Label><Input type="number" value={sponsorshipIncome} onChange={(e) => setSponsorshipIncome(Number(e.target.value))} /></div>
          <div><Label>Security Cost ($)</Label><Input type="number" value={securityCost} onChange={(e) => setSecurityCost(Number(e.target.value))} /></div>
          <div><Label>Stage Costs ($)</Label><Input type="number" value={stageCosts} onChange={(e) => setStageCosts(Number(e.target.value))} /></div>
        </div>

        <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-muted/50">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Total Revenue</p>
            <p className="text-lg font-bold text-green-600">${calculated.totalRevenue.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Tax (15%)</p>
            <p className="text-lg font-bold text-red-500">-${calculated.taxAmount.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Band Budget</p>
            <p className="text-lg font-bold text-primary">${calculated.budget.toLocaleString()}</p>
          </div>
        </div>

        <Button onClick={handleSave} className="w-full">Save Finances</Button>
      </CardContent>
    </Card>
  );
}

function QualityManager({ festivalId }: { festivalId: string }) {
  const { data: quality } = useFestivalQuality(festivalId);
  const updateQuality = useUpdateFestivalQuality();
  const [comfort, setComfort] = useState(quality?.comfort_rating || 3);
  const [food, setFood] = useState(quality?.food_rating || 3);
  const [safety, setSafety] = useState(quality?.safety_rating || 3);
  const [lineup, setLineup] = useState(quality?.lineup_rating || 3);

  const overall = ((comfort + food + safety + lineup) / 4).toFixed(1);

  const handleSave = () => {
    updateQuality.mutate({
      festival_id: festivalId,
      comfort_rating: comfort,
      food_rating: food,
      safety_rating: safety,
      lineup_rating: lineup,
      overall_rating: Number(overall),
    });
  };

  const ratingLabel = (val: number) => ["", "Poor", "Below Avg", "Average", "Good", "Excellent"][val] || "";

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Star className="h-5 w-5" /> Quality Ratings</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        {[
          { label: "Comfort", value: comfort, setter: setComfort, desc: "Seating, shade, facilities" },
          { label: "Food", value: food, setter: setFood, desc: "Vendor quality and variety" },
          { label: "Safety", value: safety, setter: setSafety, desc: "Security coverage and emergency response" },
          { label: "Lineup", value: lineup, setter: setLineup, desc: "Band fame and skill quality" },
        ].map((item) => (
          <div key={item.label} className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label>{item.label}</Label>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Badge variant="outline">{item.value}/5 - {ratingLabel(item.value)}</Badge>
            </div>
            <Slider
              min={1} max={5} step={1}
              value={[item.value]}
              onValueChange={([v]) => item.setter(v)}
            />
          </div>
        ))}

        <div className="p-4 rounded-lg bg-muted/50 text-center">
          <p className="text-sm text-muted-foreground">Overall Rating</p>
          <p className="text-2xl font-bold">{overall}/5</p>
        </div>

        <Button onClick={handleSave} className="w-full">Save Quality Ratings</Button>
      </CardContent>
    </Card>
  );
}

function SecurityManager({ festivalId, festival }: { festivalId: string; festival: any }) {
  const { data: firms = [] } = useAvailableSecurityFirms(undefined);
  const queryClient = useQueryClient();
  const [selectedFirmId, setSelectedFirmId] = useState(festival?.security_firm_id || undefined);

  const assignSecurity = useMutation({
    mutationFn: async (firmId: string) => {
      // Update the festival
      const { error } = await (supabase as any)
        .from("game_events")
        .update({ security_firm_id: firmId })
        .eq("id", festivalId);
      if (error) throw error;

      // Create a security contract
      const stageCount = festival?.max_stages || 1;
      const capacity = festival?.requirements?.capacity || 5000;
      const guardsRequired = stageCount * 4 + Math.floor(capacity / 500);

      const { error: contractError } = await (supabase as any)
        .from("security_contracts")
        .insert({
          security_firm_id: firmId,
          contract_type: "event",
          festival_id: festivalId,
          guards_required: guardsRequired,
          fee_per_event: guardsRequired * 200,
          status: "active",
        });
      if (contractError) throw contractError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-festivals"] });
      toast.success("Security firm assigned!");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Security</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Security Firm</Label>
          <Select value={selectedFirmId} onValueChange={setSelectedFirmId}>
            <SelectTrigger><SelectValue placeholder="Select security firm" /></SelectTrigger>
            <SelectContent>
              {firms.map((firm) => (
                <SelectItem key={firm.id} value={firm.id}>{firm.name} ({firm.company_name})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedFirmId && (
          <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
            <p>Guards needed: <strong>{(festival?.max_stages || 1) * 4 + Math.floor((festival?.requirements?.capacity || 5000) / 500)}</strong></p>
            <p>Est. cost: <strong>${((festival?.max_stages || 1) * 4 + Math.floor((festival?.requirements?.capacity || 5000) / 500)) * 200}</strong></p>
          </div>
        )}

        <Button onClick={() => selectedFirmId && assignSecurity.mutate(selectedFirmId)} disabled={!selectedFirmId} className="w-full">
          Assign Security Firm
        </Button>
      </CardContent>
    </Card>
  );
}
