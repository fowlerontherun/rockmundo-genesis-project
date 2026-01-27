import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRegisterCandidate } from "@/hooks/useCityElections";
import type { ProposedPolicies, DrugPolicyStatus } from "@/types/city-governance";
import { DRUG_POLICY_LABELS } from "@/types/city-governance";
import { Vote, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CandidateRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  electionId: string;
  cityName: string;
}

const MUSIC_GENRES = [
  "Rock", "Pop", "Hip-Hop", "Electronic", "Jazz", "Classical", 
  "Country", "R&B", "Metal", "Indie", "Folk", "Reggae", "Blues"
];

export function CandidateRegistrationDialog({
  open,
  onOpenChange,
  electionId,
  cityName,
}: CandidateRegistrationDialogProps) {
  const registerCandidate = useRegisterCandidate();
  
  // Form state
  const [slogan, setSlogan] = useState("");
  const [policies, setPolicies] = useState<ProposedPolicies>({});
  const [promotedGenres, setPromotedGenres] = useState<string[]>([]);
  const [prohibitedGenres, setProhibitedGenres] = useState<string[]>([]);

  const handlePolicyChange = (key: keyof ProposedPolicies, value: any) => {
    setPolicies(prev => ({ ...prev, [key]: value }));
  };

  const toggleGenre = (genre: string, type: "promoted" | "prohibited") => {
    if (type === "promoted") {
      setPromotedGenres(prev => 
        prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
      );
      // Remove from prohibited if adding to promoted
      if (!promotedGenres.includes(genre)) {
        setProhibitedGenres(prev => prev.filter(g => g !== genre));
      }
    } else {
      setProhibitedGenres(prev => 
        prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
      );
      // Remove from promoted if adding to prohibited
      if (!prohibitedGenres.includes(genre)) {
        setPromotedGenres(prev => prev.filter(g => g !== genre));
      }
    }
  };

  const handleSubmit = async () => {
    const finalPolicies: ProposedPolicies = {
      ...policies,
      promoted_genres: promotedGenres.length > 0 ? promotedGenres : undefined,
      prohibited_genres: prohibitedGenres.length > 0 ? prohibitedGenres : undefined,
    };

    // Remove undefined values
    Object.keys(finalPolicies).forEach(key => {
      if (finalPolicies[key as keyof ProposedPolicies] === undefined) {
        delete finalPolicies[key as keyof ProposedPolicies];
      }
    });

    await registerCandidate.mutateAsync({
      electionId,
      slogan,
      proposedPolicies: finalPolicies,
    });

    onOpenChange(false);
    // Reset form
    setSlogan("");
    setPolicies({});
    setPromotedGenres([]);
    setProhibitedGenres([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Vote className="h-5 w-5 text-primary" />
            Run for Mayor of {cityName}
          </DialogTitle>
          <DialogDescription>
            Create your campaign platform. Share your vision and proposed policies.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Campaign Slogan */}
          <div className="space-y-2">
            <Label htmlFor="slogan">Campaign Slogan *</Label>
            <Textarea
              id="slogan"
              placeholder="A brighter future for our music scene..."
              value={slogan}
              onChange={(e) => setSlogan(e.target.value)}
              maxLength={150}
              rows={2}
            />
            <p className="text-xs text-muted-foreground">{slogan.length}/150 characters</p>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Proposed policies are optional. If elected, you can enact these changes.
            </AlertDescription>
          </Alert>

          {/* Proposed Policies Tabs */}
          <Tabs defaultValue="taxes" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="taxes">Taxes</TabsTrigger>
              <TabsTrigger value="regulations">Regulations</TabsTrigger>
              <TabsTrigger value="music">Music Policy</TabsTrigger>
            </TabsList>

            <TabsContent value="taxes" className="space-y-4 mt-4">
              {/* Income Tax */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Income Tax Rate</Label>
                  <Badge variant="outline">{policies.income_tax_rate ?? "No change"}%</Badge>
                </div>
                <Slider
                  value={[policies.income_tax_rate ?? 10]}
                  onValueChange={([value]) => handlePolicyChange("income_tax_rate", value)}
                  min={5}
                  max={25}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">Tax on gig earnings and income (5-25%)</p>
              </div>

              {/* Sales Tax */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Sales Tax Rate</Label>
                  <Badge variant="outline">{policies.sales_tax_rate ?? "No change"}%</Badge>
                </div>
                <Slider
                  value={[policies.sales_tax_rate ?? 8]}
                  onValueChange={([value]) => handlePolicyChange("sales_tax_rate", value)}
                  min={0}
                  max={15}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">Tax on merchandise and album sales (0-15%)</p>
              </div>

              {/* Travel Tax */}
              <div className="space-y-2">
                <Label>Travel Tax (per trip)</Label>
                <Input
                  type="number"
                  placeholder="50"
                  value={policies.travel_tax ?? ""}
                  onChange={(e) => handlePolicyChange("travel_tax", Number(e.target.value))}
                  min={0}
                  max={500}
                />
                <p className="text-xs text-muted-foreground">Fee for traveling to/from the city ($0-500)</p>
              </div>
            </TabsContent>

            <TabsContent value="regulations" className="space-y-4 mt-4">
              {/* Alcohol Age */}
              <div className="space-y-2">
                <Label>Alcohol Legal Age</Label>
                <Select
                  value={policies.alcohol_legal_age?.toString() ?? ""}
                  onValueChange={(value) => handlePolicyChange("alcohol_legal_age", Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select age limit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="18">18 years</SelectItem>
                    <SelectItem value="19">19 years</SelectItem>
                    <SelectItem value="20">20 years</SelectItem>
                    <SelectItem value="21">21 years</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Drug Policy */}
              <div className="space-y-2">
                <Label>Drug Policy</Label>
                <Select
                  value={policies.drug_policy ?? ""}
                  onValueChange={(value) => handlePolicyChange("drug_policy", value as DrugPolicyStatus)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select drug policy" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DRUG_POLICY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Noise Curfew */}
              <div className="space-y-2">
                <Label>Noise Curfew Hour</Label>
                <Select
                  value={policies.noise_curfew_hour?.toString() ?? ""}
                  onValueChange={(value) => handlePolicyChange("noise_curfew_hour", value === "none" ? null : Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select curfew time" />
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
              </div>

              {/* Festival Permit */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Festival Permit Required</Label>
                  <p className="text-xs text-muted-foreground">Require permits for large music festivals</p>
                </div>
                <Switch
                  checked={policies.festival_permit_required ?? true}
                  onCheckedChange={(checked) => handlePolicyChange("festival_permit_required", checked)}
                />
              </div>
            </TabsContent>

            <TabsContent value="music" className="space-y-4 mt-4">
              {/* Busking License Fee */}
              <div className="space-y-2">
                <Label>Busking License Fee</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={policies.busking_license_fee ?? ""}
                  onChange={(e) => handlePolicyChange("busking_license_fee", Number(e.target.value))}
                  min={0}
                  max={500}
                />
                <p className="text-xs text-muted-foreground">Fee for street performance license ($0-500)</p>
              </div>

              {/* Venue Permit Cost */}
              <div className="space-y-2">
                <Label>Venue Permit Cost</Label>
                <Input
                  type="number"
                  placeholder="500"
                  value={policies.venue_permit_cost ?? ""}
                  onChange={(e) => handlePolicyChange("venue_permit_cost", Number(e.target.value))}
                  min={0}
                  max={5000}
                />
                <p className="text-xs text-muted-foreground">Cost to operate a music venue ($0-5000)</p>
              </div>

              {/* Community Events Funding */}
              <div className="space-y-2">
                <Label>Community Events Funding</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={policies.community_events_funding ?? ""}
                  onChange={(e) => handlePolicyChange("community_events_funding", Number(e.target.value))}
                  min={0}
                  max={10000}
                />
                <p className="text-xs text-muted-foreground">Monthly budget for community music events ($0-10000)</p>
              </div>

              {/* Genre Preferences */}
              <div className="space-y-3">
                <Label>Genre Policies</Label>
                <p className="text-xs text-muted-foreground">
                  Click to promote (green) or restrict (red) genres. Click again to remove.
                </p>
                <div className="flex flex-wrap gap-2">
                  {MUSIC_GENRES.map((genre) => {
                    const isPromoted = promotedGenres.includes(genre);
                    const isProhibited = prohibitedGenres.includes(genre);
                    
                    return (
                      <div key={genre} className="flex gap-1">
                        <Badge
                          variant={isPromoted ? "default" : "outline"}
                          className={`cursor-pointer transition-colors ${
                            isPromoted 
                              ? "bg-primary hover:bg-primary/80" 
                              : "hover:bg-primary/20"
                          }`}
                          onClick={() => toggleGenre(genre, "promoted")}
                        >
                          {isPromoted && "✓ "}{genre}
                        </Badge>
                        <Badge
                          variant={isProhibited ? "destructive" : "outline"}
                          className={`cursor-pointer transition-colors ${
                            isProhibited 
                              ? "" 
                              : "hover:bg-destructive/20"
                          }`}
                          onClick={() => toggleGenre(genre, "prohibited")}
                        >
                          {isProhibited && "✗ "}{genre}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!slogan.trim() || registerCandidate.isPending}
          >
            {registerCandidate.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Registering...
              </>
            ) : (
              <>
                <Vote className="h-4 w-4 mr-2" />
                Register as Candidate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
