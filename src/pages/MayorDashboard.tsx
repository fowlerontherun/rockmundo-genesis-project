import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Crown, 
  ArrowLeft, 
  Save, 
  History, 
  Landmark,
  AlertCircle,
  CheckCircle2,
  Loader2,
  TrendingUp,
  Calendar
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCityMayor, useIsCurrentMayor, useUpdateCityLaws } from "@/hooks/useMayorDashboard";
import { useCityLaws, useCityLawHistory } from "@/hooks/useCityLaws";
import { useAuth } from "@/hooks/use-auth-context";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import type { CityLaws, DrugPolicyStatus } from "@/types/city-governance";
import { DRUG_POLICY_LABELS, LAW_FIELD_LABELS } from "@/types/city-governance";

import { MUSIC_GENRES } from "@/data/genres";

export default function MayorDashboard() {
  const { cityId } = useParams<{ cityId: string }>();
  const { user } = useAuth();
  
  const { data: city } = useQuery({
    queryKey: ["city", cityId],
    queryFn: async () => {
      if (!cityId) return null;
      const { data, error } = await supabase
        .from("cities")
        .select("id, name, country")
        .eq("id", cityId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!cityId,
  });

  const { data: isMayor, isLoading: mayorCheckLoading } = useIsCurrentMayor(cityId);
  const { data: mayor } = useCityMayor(cityId);
  const { data: currentLaws, isLoading: lawsLoading } = useCityLaws(cityId);
  const { data: lawHistory } = useCityLawHistory(cityId);
  const updateLaws = useUpdateCityLaws();

  // Form state
  const [laws, setLaws] = useState<Partial<CityLaws>>({});
  const [changeReason, setChangeReason] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form with current laws
  useEffect(() => {
    if (currentLaws) {
      setLaws(currentLaws);
    }
  }, [currentLaws]);

  // Check for changes
  useEffect(() => {
    if (!currentLaws) return;
    
    const changed = Object.keys(laws).some(key => {
      const k = key as keyof CityLaws;
      return JSON.stringify(laws[k]) !== JSON.stringify(currentLaws[k]);
    });
    setHasChanges(changed);
  }, [laws, currentLaws]);

  const handleLawChange = (key: keyof CityLaws, value: any) => {
    setLaws(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!cityId || !hasChanges) return;
    
    await updateLaws.mutateAsync({
      cityId,
      updates: laws,
      changeReason: changeReason || undefined,
    });
    
    setChangeReason("");
  };

  const toggleGenre = (genre: string, type: "promoted" | "prohibited") => {
    const currentPromoted = laws.promoted_genres || [];
    const currentProhibited = laws.prohibited_genres || [];

    if (type === "promoted") {
      if (currentPromoted.includes(genre)) {
        handleLawChange("promoted_genres", currentPromoted.filter(g => g !== genre));
      } else {
        handleLawChange("promoted_genres", [...currentPromoted, genre]);
        handleLawChange("prohibited_genres", currentProhibited.filter(g => g !== genre));
      }
    } else {
      if (currentProhibited.includes(genre)) {
        handleLawChange("prohibited_genres", currentProhibited.filter(g => g !== genre));
      } else {
        handleLawChange("prohibited_genres", [...currentProhibited, genre]);
        handleLawChange("promoted_genres", currentPromoted.filter(g => g !== genre));
      }
    }
  };

  if (mayorCheckLoading || lawsLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!isMayor) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Button variant="ghost" asChild className="mb-4">
          <Link to={`/cities/${cityId}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to City
          </Link>
        </Button>
        
        <Card className="text-center py-12">
          <CardContent>
            <Crown className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-40" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              You must be the mayor of {city?.name || "this city"} to access this dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" asChild className="mb-2">
            <Link to={`/cities/${cityId}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to {city?.name || "City"}
            </Link>
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Crown className="h-6 w-6 text-yellow-500" />
            Mayor's Office - {city?.name}
          </h1>
          <p className="text-muted-foreground">Manage city laws and regulations</p>
        </div>
        
        {mayor && (
          <div className="text-right">
            <Badge variant="outline" className="mb-1">
              <TrendingUp className="h-3 w-3 mr-1" />
              {mayor.approval_rating || 50}% Approval
            </Badge>
            <div className="text-xs text-muted-foreground">
              {mayor.policies_enacted || 0} policies enacted
            </div>
          </div>
        )}
      </div>

      {/* Unsaved Changes Alert */}
      {hasChanges && (
        <Alert className="border-primary/50 bg-primary/5">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>You have unsaved changes to city laws.</span>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => currentLaws && setLaws(currentLaws)}
              >
                Reset
              </Button>
              <Button 
                size="sm"
                onClick={handleSave}
                disabled={updateLaws.isPending}
              >
                {updateLaws.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Laws Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            City Laws & Regulations
          </CardTitle>
          <CardDescription>
            Adjust laws to shape the music scene in {city?.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="taxes" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="taxes">Taxes</TabsTrigger>
              <TabsTrigger value="regulations">Regulations</TabsTrigger>
              <TabsTrigger value="music">Music Policy</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="taxes" className="space-y-6 mt-6">
              {/* Income Tax */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base">Income Tax Rate</Label>
                  <Badge variant="secondary" className="text-lg">{laws.income_tax_rate ?? 10}%</Badge>
                </div>
                <Slider
                  value={[laws.income_tax_rate ?? 10]}
                  onValueChange={([value]) => handleLawChange("income_tax_rate", value)}
                  min={5}
                  max={25}
                  step={1}
                />
                <p className="text-sm text-muted-foreground">
                  Tax on gig earnings, streaming revenue, and other income. Higher taxes fund city services but may discourage artists.
                </p>
              </div>

              {/* Sales Tax */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base">Sales Tax Rate</Label>
                  <Badge variant="secondary" className="text-lg">{laws.sales_tax_rate ?? 8}%</Badge>
                </div>
                <Slider
                  value={[laws.sales_tax_rate ?? 8]}
                  onValueChange={([value]) => handleLawChange("sales_tax_rate", value)}
                  min={0}
                  max={15}
                  step={1}
                />
                <p className="text-sm text-muted-foreground">
                  Tax on merchandise, album sales, and ticket purchases.
                </p>
              </div>

              {/* Travel Tax */}
              <div className="space-y-3">
                <Label className="text-base">Travel Tax (per trip)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">$</span>
                  <Input
                    type="number"
                    value={laws.travel_tax ?? 50}
                    onChange={(e) => handleLawChange("travel_tax", Number(e.target.value))}
                    min={0}
                    max={500}
                    className="w-32"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Fee charged when traveling to or from the city. Set to $0 to encourage tourism.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="regulations" className="space-y-6 mt-6">
              {/* Alcohol Age */}
              <div className="space-y-3">
                <Label className="text-base">Alcohol Legal Age</Label>
                <Select
                  value={laws.alcohol_legal_age?.toString() ?? "21"}
                  onValueChange={(value) => handleLawChange("alcohol_legal_age", Number(value))}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="18">18 years</SelectItem>
                    <SelectItem value="19">19 years</SelectItem>
                    <SelectItem value="20">20 years</SelectItem>
                    <SelectItem value="21">21 years</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Minimum age to purchase and consume alcohol in venues.
                </p>
              </div>

              {/* Drug Policy */}
              <div className="space-y-3">
                <Label className="text-base">Drug Policy</Label>
                <Select
                  value={laws.drug_policy ?? "prohibited"}
                  onValueChange={(value) => handleLawChange("drug_policy", value as DrugPolicyStatus)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DRUG_POLICY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  City's stance on controlled substances.
                </p>
              </div>

              {/* Noise Curfew */}
              <div className="space-y-3">
                <Label className="text-base">Noise Curfew</Label>
                <Select
                  value={laws.noise_curfew_hour?.toString() ?? "23"}
                  onValueChange={(value) => handleLawChange("noise_curfew_hour", value === "none" ? null : Number(value))}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Curfew</SelectItem>
                    <SelectItem value="22">10:00 PM</SelectItem>
                    <SelectItem value="23">11:00 PM</SelectItem>
                    <SelectItem value="24">Midnight</SelectItem>
                    <SelectItem value="1">1:00 AM</SelectItem>
                    <SelectItem value="2">2:00 AM</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Time when outdoor music must stop. Affects busking and outdoor venues.
                </p>
              </div>

              {/* Festival Permit */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <Label className="text-base">Festival Permit Required</Label>
                  <p className="text-sm text-muted-foreground">
                    Require permits for large-scale music festivals and events.
                  </p>
                </div>
                <Switch
                  checked={laws.festival_permit_required ?? true}
                  onCheckedChange={(checked) => handleLawChange("festival_permit_required", checked)}
                />
              </div>

              {/* Max Concert Capacity */}
              <div className="space-y-3">
                <Label className="text-base">Maximum Concert Capacity</Label>
                <Input
                  type="number"
                  value={laws.max_concert_capacity ?? ""}
                  onChange={(e) => handleLawChange("max_concert_capacity", e.target.value ? Number(e.target.value) : null)}
                  placeholder="No limit"
                  className="w-48"
                />
                <p className="text-sm text-muted-foreground">
                  Maximum allowed attendance at concerts. Leave empty for no limit.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="music" className="space-y-6 mt-6">
              {/* Busking License Fee */}
              <div className="space-y-3">
                <Label className="text-base">Busking License Fee</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">$</span>
                  <Input
                    type="number"
                    value={laws.busking_license_fee ?? 0}
                    onChange={(e) => handleLawChange("busking_license_fee", Number(e.target.value))}
                    min={0}
                    max={500}
                    className="w-32"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Fee for street performance license. Set to $0 to allow free busking.
                </p>
              </div>

              {/* Venue Permit Cost */}
              <div className="space-y-3">
                <Label className="text-base">Venue Operating Permit</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">$</span>
                  <Input
                    type="number"
                    value={laws.venue_permit_cost ?? 500}
                    onChange={(e) => handleLawChange("venue_permit_cost", Number(e.target.value))}
                    min={0}
                    max={5000}
                    className="w-32"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Annual cost for venues to operate legally.
                </p>
              </div>

              {/* Community Events Funding */}
              <div className="space-y-3">
                <Label className="text-base">Community Events Funding</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">$</span>
                  <Input
                    type="number"
                    value={laws.community_events_funding ?? 0}
                    onChange={(e) => handleLawChange("community_events_funding", Number(e.target.value))}
                    min={0}
                    max={10000}
                    className="w-32"
                  />
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Monthly budget allocated to free community music events.
                </p>
              </div>

              {/* Genre Policies */}
              <div className="space-y-4">
                <div>
                  <Label className="text-base">Genre Policies</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Promoted genres receive tax breaks. Prohibited genres face restrictions.
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-primary">Promoted Genres (click to toggle)</Label>
                    <div className="flex flex-wrap gap-1">
                      {MUSIC_GENRES.map((genre) => {
                        const isPromoted = (laws.promoted_genres || []).includes(genre);
                        return (
                          <Badge
                            key={genre}
                            variant={isPromoted ? "default" : "outline"}
                            className={`cursor-pointer transition-colors ${
                              isPromoted ? "bg-primary" : "hover:bg-primary/20"
                            }`}
                            onClick={() => toggleGenre(genre, "promoted")}
                          >
                            {isPromoted && "✓ "}{genre}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-destructive">Prohibited Genres (click to toggle)</Label>
                    <div className="flex flex-wrap gap-1">
                      {MUSIC_GENRES.map((genre) => {
                        const isProhibited = (laws.prohibited_genres || []).includes(genre);
                        return (
                          <Badge
                            key={genre}
                            variant={isProhibited ? "destructive" : "outline"}
                            className={`cursor-pointer transition-colors ${
                              isProhibited ? "" : "hover:bg-destructive/20"
                            }`}
                            onClick={() => toggleGenre(genre, "prohibited")}
                          >
                            {isProhibited && "✗ "}{genre}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <History className="h-4 w-4" />
                  <span>Recent law changes</span>
                </div>

                {lawHistory && lawHistory.length > 0 ? (
                  <div className="space-y-2">
                    {lawHistory.slice(0, 20).map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 text-sm">
                        <div>
                          <span className="font-medium">
                            {LAW_FIELD_LABELS[entry.law_field] || entry.law_field}
                          </span>
                          <span className="text-muted-foreground mx-2">changed from</span>
                          <span className="line-through text-muted-foreground">{entry.old_value}</span>
                          <span className="text-muted-foreground mx-2">to</span>
                          <span className="font-medium text-primary">{entry.new_value}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(entry.changed_at), "MMM d, yyyy")}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-3 opacity-40" />
                    <p>No law changes recorded yet.</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Change Reason & Save - Always visible */}
          <div className="mt-6 pt-6 border-t space-y-4">
            <div className="space-y-2">
              <Label>Reason for Changes (optional)</Label>
              <Textarea
                placeholder="Explain why you're making these changes..."
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                rows={2}
                disabled={!hasChanges}
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline"
                onClick={() => currentLaws && setLaws(currentLaws)}
                disabled={!hasChanges}
              >
                Reset All Changes
              </Button>
              <Button 
                onClick={handleSave}
                disabled={updateLaws.isPending || !hasChanges}
              >
                {updateLaws.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Enact Changes
                  </>
                )}
              </Button>
            </div>
            {!hasChanges && (
              <p className="text-sm text-muted-foreground text-center">
                Make changes to the laws above to enable saving.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
