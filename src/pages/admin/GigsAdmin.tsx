import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Mic, DollarSign, Star, TrendingUp, Save, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const GigsAdmin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Payout settings
  const [basePayPerGig, setBasePayPerGig] = useState(100);
  const [attendanceMultiplier, setAttendanceMultiplier] = useState(2);
  const [venuePrestigeMultiplier, setVenuePrestigeMultiplier] = useState(1.5);
  const [bookingFeePercent, setBookingFeePercent] = useState(10);
  const [bandRevenueShare, setBandRevenueShare] = useState(50);

  // Performance ratings
  const [skillWeight, setSkillWeight] = useState(40);
  const [chemistryWeight, setChemistryWeight] = useState(30);
  const [setlistWeight, setSetlistWeight] = useState(20);
  const [equipmentWeight, setEquipmentWeight] = useState(10);

  // Fame & Hype
  const [famePerGig, setFamePerGig] = useState(50);
  const [famePerSoldOutShow, setFamePerSoldOutShow] = useState(100);
  const [hypeDecayPerDay, setHypeDecayPerDay] = useState(5);
  const [fanConversionRate, setFanConversionRate] = useState(3);

  // Gig mechanics
  const [minDaysAdvanceBooking, setMinDaysAdvanceBooking] = useState(1);
  const [maxDaysAdvanceBooking, setMaxDaysAdvanceBooking] = useState(30);
  const [venueCooldownDays, setVenueCooldownDays] = useState(14);

  const { data: config, isLoading } = useQuery({
    queryKey: ["gig-balance-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_balance_config")
        .select("*")
        .like("key", "gig_%");
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (config) {
      const getVal = (key: string, defaultVal: number) => {
        const item = config.find((c: any) => c.key === key);
        return item ? Number(item.value) : defaultVal;
      };
      setBasePayPerGig(getVal("gig_base_pay", 100));
      setAttendanceMultiplier(getVal("gig_attendance_multiplier", 2));
      setVenuePrestigeMultiplier(getVal("gig_venue_prestige_multiplier", 1.5));
      setBookingFeePercent(getVal("gig_booking_fee_percent", 10));
      setBandRevenueShare(getVal("gig_band_revenue_share", 50));
      setSkillWeight(getVal("gig_skill_weight", 40));
      setChemistryWeight(getVal("gig_chemistry_weight", 30));
      setSetlistWeight(getVal("gig_setlist_weight", 20));
      setEquipmentWeight(getVal("gig_equipment_weight", 10));
      setFamePerGig(getVal("gig_fame_per_gig", 50));
      setFamePerSoldOutShow(getVal("gig_fame_sold_out", 100));
      setHypeDecayPerDay(getVal("gig_hype_decay_day", 5));
      setFanConversionRate(getVal("gig_fan_conversion_rate", 3));
      setMinDaysAdvanceBooking(getVal("gig_min_advance_days", 1));
      setMaxDaysAdvanceBooking(getVal("gig_max_advance_days", 30));
      setVenueCooldownDays(getVal("gig_venue_cooldown_days", 14));
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (configs: { key: string; value: number; category: string; description: string }[]) => {
      for (const cfg of configs) {
        const { error } = await supabase
          .from("game_balance_config")
          .upsert({ key: cfg.key, value: cfg.value, category: cfg.category, description: cfg.description }, { onConflict: "key" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gig-balance-config"] });
      toast({ title: "Gig settings saved successfully" });
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
  });

  const saveAllSettings = () => {
    saveMutation.mutate([
      { key: "gig_base_pay", value: basePayPerGig, category: "gig_payouts", description: "Base payment per gig" },
      { key: "gig_attendance_multiplier", value: attendanceMultiplier, category: "gig_payouts", description: "Multiplier applied based on attendance" },
      { key: "gig_venue_prestige_multiplier", value: venuePrestigeMultiplier, category: "gig_payouts", description: "Multiplier for prestigious venues" },
      { key: "gig_booking_fee_percent", value: bookingFeePercent, category: "gig_payouts", description: "Booking fee percentage" },
      { key: "gig_band_revenue_share", value: bandRevenueShare, category: "gig_payouts", description: "Band's share of ticket revenue (%)" },
      { key: "gig_skill_weight", value: skillWeight, category: "gig_performance", description: "Weight of skills in performance rating" },
      { key: "gig_chemistry_weight", value: chemistryWeight, category: "gig_performance", description: "Weight of chemistry in performance rating" },
      { key: "gig_setlist_weight", value: setlistWeight, category: "gig_performance", description: "Weight of setlist quality in rating" },
      { key: "gig_equipment_weight", value: equipmentWeight, category: "gig_performance", description: "Weight of equipment in rating" },
      { key: "gig_fame_per_gig", value: famePerGig, category: "gig_fame", description: "Base fame gained per gig" },
      { key: "gig_fame_sold_out", value: famePerSoldOutShow, category: "gig_fame", description: "Bonus fame for sold-out shows" },
      { key: "gig_hype_decay_day", value: hypeDecayPerDay, category: "gig_fame", description: "Hype points lost per day" },
      { key: "gig_fan_conversion_rate", value: fanConversionRate, category: "gig_fame", description: "% of attendees converted to fans" },
      { key: "gig_min_advance_days", value: minDaysAdvanceBooking, category: "gig_mechanics", description: "Minimum days to book in advance" },
      { key: "gig_max_advance_days", value: maxDaysAdvanceBooking, category: "gig_mechanics", description: "Maximum days to book in advance" },
      { key: "gig_venue_cooldown_days", value: venueCooldownDays, category: "gig_mechanics", description: "Days before rebooking same venue" },
    ]);
  };

  if (isLoading) {
    return (
      <AdminRoute>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AdminRoute>
    );
  }

  return (
    <AdminRoute>
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Gigs Administration</h1>
              <p className="text-muted-foreground">Manage gig mechanics, payouts, and performance calculations</p>
            </div>
          </div>
          <Button onClick={saveAllSettings} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save All Settings
          </Button>
        </div>

        <Tabs defaultValue="payouts" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="payouts" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Payouts</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              <span className="hidden sm:inline">Performance</span>
            </TabsTrigger>
            <TabsTrigger value="fame" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Fame & Hype</span>
            </TabsTrigger>
            <TabsTrigger value="mechanics" className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              <span className="hidden sm:inline">Mechanics</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="payouts">
            <Card>
              <CardHeader>
                <CardTitle>Payout Formulas</CardTitle>
                <CardDescription>Configure how gig earnings are calculated</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Base Pay per Gig ($)</Label>
                    <Input type="number" value={basePayPerGig} onChange={(e) => setBasePayPerGig(Number(e.target.value))} min={0} />
                    <p className="text-xs text-muted-foreground">Minimum guaranteed payment</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Attendance Multiplier: {attendanceMultiplier}x</Label>
                    <Slider value={[attendanceMultiplier]} onValueChange={([v]) => setAttendanceMultiplier(v)} min={0.5} max={5} step={0.1} />
                    <p className="text-xs text-muted-foreground">Payment multiplied by (attendance/capacity) × this value</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Venue Prestige Multiplier: {venuePrestigeMultiplier}x</Label>
                    <Slider value={[venuePrestigeMultiplier]} onValueChange={([v]) => setVenuePrestigeMultiplier(v)} min={1} max={3} step={0.1} />
                    <p className="text-xs text-muted-foreground">Bonus for high-prestige venues</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Booking Fee: {bookingFeePercent}%</Label>
                    <Slider value={[bookingFeePercent]} onValueChange={([v]) => setBookingFeePercent(v)} min={0} max={30} step={1} />
                    <p className="text-xs text-muted-foreground">Fee deducted when booking</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Band Revenue Share: {bandRevenueShare}%</Label>
                    <Slider value={[bandRevenueShare]} onValueChange={([v]) => setBandRevenueShare(v)} min={20} max={80} step={5} />
                    <p className="text-xs text-muted-foreground">Band's cut of ticket sales</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance">
            <Card>
              <CardHeader>
                <CardTitle>Performance Rating Weights</CardTitle>
                <CardDescription>How different factors contribute to performance score (should total 100%)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Skill Weight: {skillWeight}%</Label>
                    <Slider value={[skillWeight]} onValueChange={([v]) => setSkillWeight(v)} min={0} max={100} step={5} />
                    <p className="text-xs text-muted-foreground">Weight of member skills</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Chemistry Weight: {chemistryWeight}%</Label>
                    <Slider value={[chemistryWeight]} onValueChange={([v]) => setChemistryWeight(v)} min={0} max={100} step={5} />
                    <p className="text-xs text-muted-foreground">Weight of band chemistry</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Setlist Weight: {setlistWeight}%</Label>
                    <Slider value={[setlistWeight]} onValueChange={([v]) => setSetlistWeight(v)} min={0} max={100} step={5} />
                    <p className="text-xs text-muted-foreground">Weight of setlist quality/familiarity</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Equipment Weight: {equipmentWeight}%</Label>
                    <Slider value={[equipmentWeight]} onValueChange={([v]) => setEquipmentWeight(v)} min={0} max={100} step={5} />
                    <p className="text-xs text-muted-foreground">Weight of equipment quality</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Current total: {skillWeight + chemistryWeight + setlistWeight + equipmentWeight}%
                  {skillWeight + chemistryWeight + setlistWeight + equipmentWeight !== 100 && (
                    <span className="text-destructive ml-2">(Should be 100%)</span>
                  )}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fame">
            <Card>
              <CardHeader>
                <CardTitle>Fame & Hype Configuration</CardTitle>
                <CardDescription>How gig performance translates to fame and audience growth</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Base Fame per Gig</Label>
                    <Input type="number" value={famePerGig} onChange={(e) => setFamePerGig(Number(e.target.value))} min={0} />
                    <p className="text-xs text-muted-foreground">Fame points gained from any gig</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Sold-Out Show Bonus</Label>
                    <Input type="number" value={famePerSoldOutShow} onChange={(e) => setFamePerSoldOutShow(Number(e.target.value))} min={0} />
                    <p className="text-xs text-muted-foreground">Extra fame for selling out</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Hype Decay per Day: {hypeDecayPerDay}</Label>
                    <Slider value={[hypeDecayPerDay]} onValueChange={([v]) => setHypeDecayPerDay(v)} min={0} max={20} step={1} />
                    <p className="text-xs text-muted-foreground">Hype lost daily without activity</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Fan Conversion Rate: {fanConversionRate}%</Label>
                    <Slider value={[fanConversionRate]} onValueChange={([v]) => setFanConversionRate(v)} min={0} max={20} step={0.5} />
                    <p className="text-xs text-muted-foreground">% of attendees who become fans</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mechanics">
            <Card>
              <CardHeader>
                <CardTitle>Gig Mechanics</CardTitle>
                <CardDescription>Booking rules and venue restrictions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>Min Advance Booking (days)</Label>
                    <Input type="number" value={minDaysAdvanceBooking} onChange={(e) => setMinDaysAdvanceBooking(Number(e.target.value))} min={0} max={14} />
                    <p className="text-xs text-muted-foreground">Minimum notice to book a gig</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Max Advance Booking (days)</Label>
                    <Input type="number" value={maxDaysAdvanceBooking} onChange={(e) => setMaxDaysAdvanceBooking(Number(e.target.value))} min={7} max={90} />
                    <p className="text-xs text-muted-foreground">How far ahead gigs can be booked</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Venue Cooldown (days)</Label>
                    <Input type="number" value={venueCooldownDays} onChange={(e) => setVenueCooldownDays(Number(e.target.value))} min={0} max={30} />
                    <p className="text-xs text-muted-foreground">Days before rebooking same venue</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminRoute>
  );
};

export default GigsAdmin;
