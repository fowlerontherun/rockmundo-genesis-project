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
import { Loader2, Lock, Star, Trash2, UserPlus, Users } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { CREW_DEPARTMENTS, getCrewRoleInfo, isPerformanceCrewRole } from "@/utils/liveSetup";
import { CrewGuide, type CrewCoverageEntry } from "@/components/band/CrewGuide";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import tourManagerImg from "@/assets/crew/tour-manager.jpg";
import fohEngineerImg from "@/assets/crew/foh-engineer.jpg";
import lightingDirectorImg from "@/assets/crew/lighting-director.jpg";
import roadChiefImg from "@/assets/crew/road-chief.jpg";
import backlineTechImg from "@/assets/crew/backline-tech.jpg";
import merchDirectorImg from "@/assets/crew/merch-director.jpg";
import securityLeadImg from "@/assets/crew/security-lead.jpg";
import wardrobeStylistImg from "@/assets/crew/wardrobe-stylist.jpg";

const CREW_IMAGES: Record<string, string> = {
  "tour-manager": tourManagerImg,
  "foh-engineer": fohEngineerImg,
  "lighting-director": lightingDirectorImg,
  "road-chief": roadChiefImg,
  "backline-tech": backlineTechImg,
  "merch-director": merchDirectorImg,
  "security-lead": securityLeadImg,
  "wardrobe-stylist": wardrobeStylistImg,
};

const ROLE_TO_IMAGE: Record<string, string> = {
  "Tour Manager": tourManagerImg,
  "Front of House Engineer": fohEngineerImg,
  "Lighting Director": lightingDirectorImg,
  "Road Crew Chief": roadChiefImg,
  "Backline Technician": backlineTechImg,
  "Merch Director": merchDirectorImg,
  "Security Lead": securityLeadImg,
  "Wardrobe Stylist": wardrobeStylistImg,
};

const getCrewImage = (role: string, slug?: string | null) =>
  (slug && CREW_IMAGES[slug]) || ROLE_TO_IMAGE[role] || tourManagerImg;

const StarRating = ({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) => {
  const stars = [];
  const fullStars = Math.floor(rating);
  const sizeClass = size === "lg" ? "h-5 w-5" : "h-4 w-4";

  for (let i = 0; i < 10; i++) {
    stars.push(
      <Star
        key={i}
        className={`${sizeClass} ${i < fullStars ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/30"}`}
      />,
    );
  }

  return <div className="flex gap-0.5">{stars}</div>;
};

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
  image_url: string | null;
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

const ROSTER_DEPARTMENTS = ["show", "touring", "commercial"] as const;

const RosterCrewCard = ({
  crew,
  onRelease,
  releasing,
}: {
  crew: BandCrewMemberRow;
  onRelease: (crew: BandCrewMemberRow) => void;
  releasing: boolean;
}) => {
  const roleInfo = getCrewRoleInfo(crew.crew_type);

  return (
    <Card className="relative overflow-hidden">
      <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
        <img
          src={getCrewImage(crew.crew_type)}
          alt={`${crew.crew_type} portrait`}
          loading="lazy"
          width={512}
          height={288}
          className="h-full w-full object-cover"
        />
      </div>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{crew.name}</CardTitle>
            <CardDescription>{crew.crew_type}</CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant={roleInfo.affectsLiveSetup ? "default" : "secondary"}>{roleInfo.departmentLabel}</Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
              {crew.star_rating ?? 5}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md bg-muted/40 p-3 text-xs">
          <p className="font-medium">Gameplay area: {roleInfo.impactLabel}</p>
          <p className="mt-1 text-muted-foreground">
            {roleInfo.affectsLiveSetup
              ? "Directly contributes to the Show Crew portion of Live Setup."
              : "Kept separate from the core song-performance Live Setup score."}
          </p>
        </div>
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
          onClick={() => onRelease(crew)}
          disabled={releasing}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Release
        </Button>
      </CardFooter>
    </Card>
  );
};

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

  const filteredCatalog = useMemo(() => {
    if (!availableCrew) return [];

    return availableCrew.filter((crew) => {
      if (crew.hired_by_band_id !== null) return false;
      if (selectedRole !== "all" && crew.role !== selectedRole) return false;

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

  const crewCount = hiredCrew?.length ?? 0;
  const showCrew = (hiredCrew || []).filter((crew) => isPerformanceCrewRole(crew.crew_type));
  const showCrewSkill = showCrew.length > 0
    ? showCrew.reduce((sum, crew) => sum + Number(crew.skill_level || 0), 0) / showCrew.length
    : 40;
  const totalPayroll = hiredCrew?.reduce((sum, crew) => sum + crew.salary_per_gig, 0) ?? 0;

  const crewByDepartment = useMemo(() => {
    const groups = {
      show: [] as BandCrewMemberRow[],
      touring: [] as BandCrewMemberRow[],
      commercial: [] as BandCrewMemberRow[],
      support: [] as BandCrewMemberRow[],
    };

    for (const crew of hiredCrew || []) {
      const department = getCrewRoleInfo(crew.crew_type).department;
      groups[department].push(crew);
    }

    return groups;
  }, [hiredCrew]);

  const currentTier = FAME_TIERS.findIndex((tier) => bandFame >= tier.min && bandFame <= tier.max);
  const maxAccessibleStars = FAME_TIERS[currentTier]?.stars[1] ?? 2;

  const hireMutation = useMutation({
    mutationFn: async (crew: CrewCatalogRow) => {
      if (!bandId) throw new Error("Join a band first");

      if (bandFame < crew.min_fame_required) {
        throw new Error(`Need ${crew.min_fame_required.toLocaleString()} fame to hire this crew member`);
      }

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

      const { error: updateError } = await supabase
        .from("crew_catalog")
        .update({ hired_by_band_id: bandId })
        .eq("id", crew.id);
      if (updateError) throw updateError;
    },
    onSuccess: (_, crew) => {
      const roleInfo = getCrewRoleInfo(crew.role);
      queryClient.invalidateQueries({ queryKey: ["band-crew", bandId] });
      queryClient.invalidateQueries({ queryKey: ["crew-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["gig-live-setup"] });
      setHireDialogOpen(false);
      setSelectedCrewMember(null);
      toast.success(`${crew.name} hired!`, {
        description: roleInfo.affectsLiveSetup
          ? `${crew.star_rating}★ ${crew.role} joins your Show Crew and can improve Live Setup.`
          : `${crew.star_rating}★ ${crew.role} joins ${roleInfo.departmentLabel} · ${roleInfo.impactLabel}.`,
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to hire");
    },
  });

  const releaseMutation = useMutation({
    mutationFn: async (crew: BandCrewMemberRow) => {
      const { error: deleteError } = await supabase
        .from("band_crew_members")
        .delete()
        .eq("id", crew.id);
      if (deleteError) throw deleteError;

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
      queryClient.invalidateQueries({ queryKey: ["gig-live-setup"] });
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
    if (selectedCrewMember) hireMutation.mutate(selectedCrewMember);
  };

  const handleRelease = (crew: BandCrewMemberRow) => {
    if (window.confirm(`Release ${crew.name}? They'll become available for other bands to hire.`)) {
      releaseMutation.mutate(crew);
    }
  };

  const isLocked = (crew: CrewCatalogRow) => bandFame < crew.min_fame_required;

  if (loadingBand || loadingCrew) {
    return (
      <FMPageScaffold title="Crew Management" icon={Users} backTo="/hub/band">
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </FMPageScaffold>
    );
  }

  if (!bandId) {
    return (
      <FMPageScaffold title="Crew Management" icon={Users} backTo="/hub/band">
        <Card className="mx-auto max-w-lg">
          <CardHeader>
            <CardTitle>Join a Band First</CardTitle>
            <CardDescription>You need to be in a band to hire crew members.</CardDescription>
          </CardHeader>
        </Card>
      </FMPageScaffold>
    );
  }

  return (
    <FMPageScaffold title={`Crew Management • ${bandName}`} icon={Users} backTo="/hub/band">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Crew Management • {bandName}</CardTitle>
            <CardDescription>
              Crew is split by what it actually does. Only Show Crew changes Live Setup; Touring Operations and Commercial & Image stay outside the core song-performance score.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="text-sm text-muted-foreground">Total Crew</div>
                <div className="mt-1 flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold">{crewCount}</span>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="text-sm text-muted-foreground">Show Crew</div>
                <div className="mt-1 text-2xl font-bold">{showCrew.length}</div>
                <div className="text-xs text-muted-foreground">{Math.round(showCrewSkill)}/100 avg skill · affects Live Setup</div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="text-sm text-muted-foreground">Cost per Gig</div>
                <div className="mt-1 text-2xl font-bold">${totalPayroll.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">All hired departments are paid</div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="text-sm text-muted-foreground">Your Fame</div>
                <div className="mt-1 text-2xl font-bold">{bandFame.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Can hire up to {maxAccessibleStars}★ crew</div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {ROSTER_DEPARTMENTS.map((department) => {
                const config = CREW_DEPARTMENTS[department];
                return (
                  <div key={department} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{config.label}</p>
                      <Badge variant={department === "show" ? "default" : "secondary"}>{crewByDepartment[department].length}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{config.description}</p>
                    <p className="mt-2 text-xs font-medium">{department === "show" ? "Counts toward Live Setup" : "Does not inflate Live Setup"}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="roster" className="space-y-4">
          <TabsList>
            <TabsTrigger value="roster">Your Crew ({crewCount})</TabsTrigger>
            <TabsTrigger value="hire">Hire Crew</TabsTrigger>
          </TabsList>

          <TabsContent value="roster">
            <Card>
              <CardHeader>
                <CardTitle>Active Crew</CardTitle>
                <CardDescription>
                  Departments are separated so hiring a merch, security, wardrobe or tour specialist cannot be mistaken for improving the music-performance crew score.
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
                  <div className="space-y-8">
                    {ROSTER_DEPARTMENTS.map((department) => {
                      const config = CREW_DEPARTMENTS[department];
                      const departmentCrew = crewByDepartment[department];
                      return (
                        <section key={department} className="space-y-3" aria-labelledby={`crew-${department}`}>
                          <div className="flex flex-wrap items-end justify-between gap-2 border-b pb-2">
                            <div>
                              <h3 id={`crew-${department}`} className="font-semibold">{config.label}</h3>
                              <p className="text-xs text-muted-foreground">{config.description}</p>
                            </div>
                            <Badge variant={department === "show" ? "default" : "secondary"}>{departmentCrew.length} hired</Badge>
                          </div>
                          {departmentCrew.length === 0 ? (
                            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No {config.label.toLowerCase()} hired yet.</p>
                          ) : (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                              {departmentCrew.map((crew) => (
                                <RosterCrewCard
                                  key={crew.id}
                                  crew={crew}
                                  onRelease={handleRelease}
                                  releasing={releaseMutation.isPending}
                                />
                              ))}
                            </div>
                          )}
                        </section>
                      );
                    })}
                    {crewByDepartment.support.length > 0 && (
                      <section className="space-y-3" aria-labelledby="crew-support">
                        <div className="border-b pb-2">
                          <h3 id="crew-support" className="font-semibold">Band Support</h3>
                          <p className="text-xs text-muted-foreground">Unclassified support roles. These do not affect Live Setup.</p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {crewByDepartment.support.map((crew) => (
                            <RosterCrewCard
                              key={crew.id}
                              crew={crew}
                              onRelease={handleRelease}
                              releasing={releaseMutation.isPending}
                            />
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hire">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle>Available Crew</CardTitle>
                    <CardDescription>
                      Every candidate shows a department and gameplay area before you hire them. Higher fame unlocks stronger specialists; a crew member can only work for one band at a time.
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
                  <div className="py-10 text-center text-muted-foreground">No available crew matching your filters</div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredCatalog.map((crew) => {
                      const locked = isLocked(crew);
                      const roleInfo = getCrewRoleInfo(crew.role);
                      return (
                        <Card key={crew.id} className={`relative overflow-hidden ${locked ? "opacity-60" : ""}`}>
                          {locked && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80">
                              <div className="text-center">
                                <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
                                <p className="mt-2 text-sm font-medium">Requires {crew.min_fame_required.toLocaleString()} Fame</p>
                              </div>
                            </div>
                          )}
                          <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
                            <img
                              src={getCrewImage(crew.role, crew.image_url)}
                              alt={`${crew.role} portrait`}
                              loading="lazy"
                              width={512}
                              height={288}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <CardTitle className="text-lg">{crew.name}</CardTitle>
                                <CardDescription>{crew.role}</CardDescription>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <Badge variant={roleInfo.affectsLiveSetup ? "default" : "secondary"}>{roleInfo.departmentLabel}</Badge>
                                <Badge
                                  variant={crew.star_rating >= 9 ? "default" : crew.star_rating >= 7 ? "secondary" : "outline"}
                                  className="flex items-center gap-1"
                                >
                                  <Star className={`h-3 w-3 ${crew.star_rating >= 7 ? "fill-yellow-500 text-yellow-500" : ""}`} />
                                  {crew.star_rating}
                                </Badge>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="rounded-md bg-muted/40 p-3 text-xs">
                              <p className="font-medium">Gameplay area: {roleInfo.impactLabel}</p>
                              <p className="mt-1 text-muted-foreground">
                                {roleInfo.affectsLiveSetup
                                  ? "This Show Crew role directly improves the crew side of Live Setup."
                                  : "This specialist is deliberately kept outside the Live Setup crew score."}
                              </p>
                            </div>
                            <StarRating rating={crew.star_rating} />
                            <p className="line-clamp-2 text-sm text-muted-foreground">{crew.headline}</p>
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
                              {crew.specialties.slice(0, 2).map((specialty) => (
                                <Badge key={specialty} variant="outline" className="text-xs">{specialty}</Badge>
                              ))}
                            </div>
                            <div className="text-lg font-bold text-primary">${crew.salary.toLocaleString()}/gig</div>
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

      <Dialog open={hireDialogOpen} onOpenChange={setHireDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hire {selectedCrewMember?.name}?</DialogTitle>
            <DialogDescription>
              {selectedCrewMember
                ? `${selectedCrewMember.role} joins ${getCrewRoleInfo(selectedCrewMember.role).departmentLabel} · gameplay area: ${getCrewRoleInfo(selectedCrewMember.role).impactLabel}.`
                : "This crew member will join your band exclusively."}
            </DialogDescription>
          </DialogHeader>
          {selectedCrewMember && (
            <div className="space-y-4">
              <div className="aspect-[16/9] w-full overflow-hidden rounded-lg bg-muted">
                <img
                  src={getCrewImage(selectedCrewMember.role, selectedCrewMember.image_url)}
                  alt={`${selectedCrewMember.role} portrait`}
                  loading="lazy"
                  width={512}
                  height={288}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="text-lg font-semibold">{selectedCrewMember.name}</div>
                  <div className="text-sm text-muted-foreground">{selectedCrewMember.role}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={getCrewRoleInfo(selectedCrewMember.role).affectsLiveSetup ? "default" : "secondary"}>
                    {getCrewRoleInfo(selectedCrewMember.role).departmentLabel}
                  </Badge>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                    {selectedCrewMember.star_rating}
                  </Badge>
                </div>
              </div>
              <StarRating rating={selectedCrewMember.star_rating} size="lg" />
              <p className="text-sm text-muted-foreground">{selectedCrewMember.background}</p>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="mb-3 text-sm">
                  <span className="font-medium">Gameplay area:</span>{" "}
                  {getCrewRoleInfo(selectedCrewMember.role).impactLabel}
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Skill: <span className="font-medium">{selectedCrewMember.skill}/100</span></div>
                  <div>Experience: <span className="font-medium">{selectedCrewMember.experience} yrs</span></div>
                  <div>Loyalty: <span className="font-medium">{selectedCrewMember.loyalty}%</span></div>
                  <div className="font-bold text-primary">${selectedCrewMember.salary.toLocaleString()}/gig</div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHireDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmHire} disabled={hireMutation.isPending}>
              {hireMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Hire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FMPageScaffold>
  );
};

export default BandCrewManagement;