import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import { CircleDashed, Loader2, Lock, Star, Trash2, UserPlus, Users, Zap } from "lucide-react";

// Star rating display component
const StarRating = ({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) => {
  const stars = [];
  const fullStars = Math.floor(rating);
  const sizeClass = size === "lg" ? "h-5 w-5" : "h-4 w-4";
  
  for (let i = 0; i < 10; i++) {
    stars.push(
      <Star
        key={i}
        className={`${sizeClass} ${i < fullStars ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/30"}`}
      />
    );
  }
  return <div className="flex gap-0.5">{stars}</div>;
};

// Cohesion bar component
const CohesionBar = ({ value }: { value: number }) => {
  const getColor = () => {
    if (value >= 80) return "bg-green-500";
    if (value >= 50) return "bg-blue-500";
    if (value >= 20) return "bg-yellow-500";
    return "bg-red-500";
  };
  
  const getLabel = () => {
    if (value >= 80) return "Legendary synergy";
    if (value >= 50) return "Well-oiled machine";
    if (value >= 20) return "Functional team";
    return "Still learning";
  };
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Cohesion</span>
        <span className="font-medium">{value.toFixed(0)}%</span>
      </div>
      <Progress value={value} className={`h-2 ${getColor()}`} />
      <span className="text-xs text-muted-foreground">{getLabel()}</span>
    </div>
  );
};

// Fame tier configuration
const FAME_TIERS = [
  { min: 0, max: 499, label: "Beginner", stars: [1, 2] },
  { min: 500, max: 1999, label: "Rising", stars: [3, 4] },
  { min: 2000, max: 9999, label: "Professional", stars: [5, 6] },
  { min: 10000, max: 49999, label: "Elite", stars: [7, 8] },
  { min: 50000, max: Infinity, label: "Legendary", stars: [9, 10] },
];

interface CrewCatalogRow {
  id: string;
  name: string;
  role: string;
  headline: string;
  background: string;
  skill: number;
  salary: number;
  experience: number;
  morale: string;
  loyalty: number;
  assignment: string;
  focus: string;
  specialties: string[];
  traits: string[];
  openings: number;
  star_rating: number;
  min_fame_required: number;
  hired_by_band_id: string | null;
}

interface BandCrewMemberRow {
  id: string;
  band_id: string;
  crew_type: string;
  name: string;
  skill_level: number;
  salary_per_gig: number;
  hire_date: string;
  experience_years: number;
  notes: string | null;
  star_rating: number | null;
  cohesion_rating: number;
  gigs_together: number;
  catalog_crew_id: string | null;
}

const CREW_ROLES = [
  "Tour Manager",
  "Front of House Engineer", 
  "Lighting Director",
  "Road Crew Chief",
  "Backline Technician",
  "Merch Director",
  "Security Lead",
  "Wardrobe Stylist",
];

const BandCrewManagement = () => {
  const queryClient = useQueryClient();
  const { data: primaryBand, isLoading: loadingBand } = usePrimaryBand();
  const bandId = primaryBand?.band_id ?? null;
  const bandName = primaryBand?.bands?.name ?? "Band";
  const bandFame = primaryBand?.bands?.fame ?? 0;

  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [selectedTier, setSelectedTier] = useState<string>("all");
  const [hireDialogOpen, setHireDialogOpen] = useState(false);
  const [selectedCrewMember, setSelectedCrewMember] = useState<CrewCatalogRow | null>(null);

  // Fetch hired crew
  const { data: hiredCrew, isLoading: loadingCrew } = useQuery<BandCrewMemberRow[]>({
    queryKey: ["band-crew", bandId],
    queryFn: async () => {
      if (!bandId) return [];
      const { data, error } = await supabase
        .from("band_crew_members")
        .select("*")
        .eq("band_id", bandId)
        .order("hire_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(bandId),
  });

  // Fetch available crew from catalog
  const { data: availableCrew, isLoading: loadingCatalog } = useQuery<CrewCatalogRow[]>({
    queryKey: ["crew-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crew_catalog")
        .select("*")
        .order("star_rating", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Filter available crew (not hired by any band)
  const filteredCatalog = useMemo(() => {
    if (!availableCrew) return [];
    
    return availableCrew.filter((crew) => {
      // Must not be hired by any band
      if (crew.hired_by_band_id !== null) return false;
      
      // Filter by role
      if (selectedRole !== "all" && crew.role !== selectedRole) return false;
      
      // Filter by tier
      if (selectedTier !== "all") {
        const tierNum = parseInt(selectedTier);
        const tier = FAME_TIERS[tierNum - 1];
        if (tier && (crew.star_rating < tier.stars[0] || crew.star_rating > tier.stars[1])) {
          return false;
        }
      }
      
      return true;
    });
  }, [availableCrew, selectedRole, selectedTier]);

  // Stats
  const crewCount = hiredCrew?.length ?? 0;
  const totalPayroll = hiredCrew?.reduce((sum, c) => sum + c.salary_per_gig, 0) ?? 0;
  const avgStarRating = crewCount > 0 
    ? (hiredCrew?.reduce((sum, c) => sum + (c.star_rating ?? 5), 0) ?? 0) / crewCount 
    : 0;
  const avgCohesion = crewCount > 0
    ? (hiredCrew?.reduce((sum, c) => sum + c.cohesion_rating, 0) ?? 0) / crewCount
    : 0;

  // Calculate what tier the band can access
  const currentTier = FAME_TIERS.findIndex(t => bandFame >= t.min && bandFame <= t.max);
  const maxAccessibleStars = FAME_TIERS[currentTier]?.stars[1] ?? 2;

  // Hire mutation
  const hireMutation = useMutation({
    mutationFn: async (crew: CrewCatalogRow) => {
      if (!bandId) throw new Error("Join a band first");
      
      // Check fame requirement
      if (bandFame < crew.min_fame_required) {
        throw new Error(`Need ${crew.min_fame_required.toLocaleString()} fame to hire this crew member`);
      }
      
      // Insert into band_crew_members
      const { error: insertError } = await supabase.from("band_crew_members").insert({
        band_id: bandId,
        name: crew.name,
        crew_type: crew.role,
        experience_years: crew.experience,
        hire_date: new Date().toISOString(),
        salary_per_gig: crew.salary,
        skill_level: crew.skill,
        star_rating: crew.star_rating,
        cohesion_rating: 0,
        gigs_together: 0,
        catalog_crew_id: crew.id,
        notes: JSON.stringify({ specialties: crew.specialties, traits: crew.traits }),
      });
      if (insertError) throw insertError;
      
      // Mark as hired in catalog
      const { error: updateError } = await supabase
        .from("crew_catalog")
        .update({ hired_by_band_id: bandId })
        .eq("id", crew.id);
      if (updateError) throw updateError;
    },
    onSuccess: (_, crew) => {
      queryClient.invalidateQueries({ queryKey: ["band-crew", bandId] });
      queryClient.invalidateQueries({ queryKey: ["crew-catalog"] });
      setHireDialogOpen(false);
      setSelectedCrewMember(null);
      toast.success(`${crew.name} hired!`, {
        description: `${crew.star_rating}★ ${crew.role} joins your crew.`,
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to hire");
    },
  });

  // Release mutation
  const releaseMutation = useMutation({
    mutationFn: async (crew: BandCrewMemberRow) => {
      // Delete from band_crew_members
      const { error: deleteError } = await supabase
        .from("band_crew_members")
        .delete()
        .eq("id", crew.id);
      if (deleteError) throw deleteError;
      
      // If they came from catalog, mark as available
      if (crew.catalog_crew_id) {
        await supabase
          .from("crew_catalog")
          .update({ hired_by_band_id: null })
          .eq("id", crew.catalog_crew_id);
      }
    },
    onSuccess: (_, crew) => {
      queryClient.invalidateQueries({ queryKey: ["band-crew", bandId] });
      queryClient.invalidateQueries({ queryKey: ["crew-catalog"] });
      toast.success(`${crew.name} released from crew`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to release crew member");
    },
  });

  const handleHire = (crew: CrewCatalogRow) => {
    setSelectedCrewMember(crew);
    setHireDialogOpen(true);
  };

  const confirmHire = () => {
    if (selectedCrewMember) {
      hireMutation.mutate(selectedCrewMember);
    }
  };

  const handleRelease = (crew: BandCrewMemberRow) => {
    if (window.confirm(`Release ${crew.name}? They'll become available for other bands to hire.`)) {
      releaseMutation.mutate(crew);
    }
  };

  const isLocked = (crew: CrewCatalogRow) => bandFame < crew.min_fame_required;

  if (loadingBand || loadingCrew) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!bandId) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Card className="mx-auto max-w-lg">
          <CardHeader>
            <CardTitle>Join a Band First</CardTitle>
            <CardDescription>You need to be in a band to hire crew members.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Crew Management • {bandName}</CardTitle>
            <CardDescription>
              Hire crew to boost your gig performance. Higher star ratings = better bonuses. Cohesion grows over time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="text-sm text-muted-foreground">Crew Size</div>
                <div className="mt-1 flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold">{crewCount}</span>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="text-sm text-muted-foreground">Avg Star Rating</div>
                <div className="mt-1 flex items-center gap-2">
                  <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                  <span className="text-2xl font-bold">{avgStarRating.toFixed(1)}</span>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="text-sm text-muted-foreground">Avg Cohesion</div>
                <div className="mt-1 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-500" />
                  <span className="text-2xl font-bold">{avgCohesion.toFixed(0)}%</span>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="text-sm text-muted-foreground">Cost per Gig</div>
                <div className="mt-1 text-2xl font-bold">${totalPayroll.toLocaleString()}</div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="text-sm text-muted-foreground">Your Fame</div>
                <div className="mt-1 text-2xl font-bold">{bandFame.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">
                  Can hire up to {maxAccessibleStars}★ crew
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="roster" className="space-y-4">
          <TabsList>
            <TabsTrigger value="roster">Your Crew ({crewCount})</TabsTrigger>
            <TabsTrigger value="hire">Hire Crew</TabsTrigger>
          </TabsList>

          {/* Roster Tab */}
          <TabsContent value="roster">
            <Card>
              <CardHeader>
                <CardTitle>Active Crew</CardTitle>
                <CardDescription>
                  Your crew's cohesion grows with each gig performed together. Higher cohesion = better performance bonuses.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!hiredCrew || hiredCrew.length === 0 ? (
                  <div className="flex flex-col items-center gap-4 py-10 text-center">
                    <UserPlus className="h-12 w-12 text-muted-foreground" />
                    <div>
                      <p className="font-semibold">No crew hired yet</p>
                      <p className="text-sm text-muted-foreground">Head to the Hire tab to recruit specialists</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {hiredCrew.map((crew) => (
                      <Card key={crew.id} className="relative">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-lg">{crew.name}</CardTitle>
                              <CardDescription>{crew.crew_type}</CardDescription>
                            </div>
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                              {crew.star_rating ?? 5}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <StarRating rating={crew.star_rating ?? 5} />
                          
                          <CohesionBar value={crew.cohesion_rating} />
                          
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Skill:</span>{" "}
                              <span className="font-medium">{crew.skill_level}/100</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Experience:</span>{" "}
                              <span className="font-medium">{crew.experience_years} yrs</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Gigs Together:</span>{" "}
                              <span className="font-medium">{crew.gigs_together}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Salary:</span>{" "}
                              <span className="font-medium">${crew.salary_per_gig}/gig</span>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-destructive hover:text-destructive"
                            onClick={() => handleRelease(crew)}
                            disabled={releaseMutation.isPending}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Release
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Hire Tab */}
          <TabsContent value="hire">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle>Available Crew</CardTitle>
                    <CardDescription>
                      Higher fame unlocks better crew. Crew can only work for one band at a time.
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        {CREW_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>{role}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={selectedTier} onValueChange={setSelectedTier}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Filter by tier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tiers</SelectItem>
                        <SelectItem value="1">Tier 1 (1-2★)</SelectItem>
                        <SelectItem value="2">Tier 2 (3-4★)</SelectItem>
                        <SelectItem value="3">Tier 3 (5-6★)</SelectItem>
                        <SelectItem value="4">Tier 4 (7-8★)</SelectItem>
                        <SelectItem value="5">Tier 5 (9-10★)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingCatalog ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : filteredCatalog.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">
                    No available crew matching your filters
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredCatalog.map((crew) => {
                      const locked = isLocked(crew);
                      return (
                        <Card 
                          key={crew.id} 
                          className={`relative ${locked ? "opacity-60" : ""}`}
                        >
                          {locked && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80">
                              <div className="text-center">
                                <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
                                <p className="mt-2 text-sm font-medium">
                                  Requires {crew.min_fame_required.toLocaleString()} Fame
                                </p>
                              </div>
                            </div>
                          )}
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle className="text-lg">{crew.name}</CardTitle>
                                <CardDescription>{crew.role}</CardDescription>
                              </div>
                              <Badge 
                                variant={crew.star_rating >= 9 ? "default" : crew.star_rating >= 7 ? "secondary" : "outline"}
                                className="flex items-center gap-1"
                              >
                                <Star className={`h-3 w-3 ${crew.star_rating >= 7 ? "fill-yellow-500 text-yellow-500" : ""}`} />
                                {crew.star_rating}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <StarRating rating={crew.star_rating} />
                            
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {crew.headline}
                            </p>
                            
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">Skill:</span>{" "}
                                <span className="font-medium">{crew.skill}/100</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Experience:</span>{" "}
                                <span className="font-medium">{crew.experience} yrs</span>
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-1">
                              {crew.specialties.slice(0, 2).map((s) => (
                                <Badge key={s} variant="outline" className="text-xs">
                                  {s}
                                </Badge>
                              ))}
                            </div>
                            
                            <div className="text-lg font-bold text-primary">
                              ${crew.salary.toLocaleString()}/gig
                            </div>
                          </CardContent>
                          <CardFooter>
                            <Button
                              className="w-full"
                              onClick={() => handleHire(crew)}
                              disabled={locked || hireMutation.isPending}
                            >
                              <UserPlus className="mr-2 h-4 w-4" /> Hire
                            </Button>
                          </CardFooter>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Hire Dialog */}
      <Dialog open={hireDialogOpen} onOpenChange={setHireDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hire {selectedCrewMember?.name}?</DialogTitle>
            <DialogDescription>
              This crew member will join your band exclusively.
            </DialogDescription>
          </DialogHeader>
          {selectedCrewMember && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="text-lg font-semibold">{selectedCrewMember.name}</div>
                  <div className="text-sm text-muted-foreground">{selectedCrewMember.role}</div>
                </div>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                  {selectedCrewMember.star_rating}
                </Badge>
              </div>
              
              <StarRating rating={selectedCrewMember.star_rating} size="lg" />
              
              <p className="text-sm text-muted-foreground">{selectedCrewMember.background}</p>
              
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Skill: <span className="font-medium">{selectedCrewMember.skill}/100</span></div>
                  <div>Experience: <span className="font-medium">{selectedCrewMember.experience} yrs</span></div>
                  <div>Loyalty: <span className="font-medium">{selectedCrewMember.loyalty}%</span></div>
                  <div className="font-bold text-primary">
                    ${selectedCrewMember.salary.toLocaleString()}/gig
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHireDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmHire} disabled={hireMutation.isPending}>
              {hireMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Hire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BandCrewManagement;
