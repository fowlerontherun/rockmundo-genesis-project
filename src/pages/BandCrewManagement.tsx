import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import type { Database } from "@/lib/supabase-types";
import {
  CircleDashed,
  ClipboardList,
  Loader2,
  PlaneTakeoff,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import {
  assignmentHighlights,
  CREW_DISCIPLINES,
  CrewAssignment,
  CrewCatalogItem,
  CrewDiscipline,
  CrewMetadata,
  CrewMorale,
  DISCIPLINE_DEFAULTS,
  formatCrewCurrency as formatCurrency,
  moraleBadgeVariant,
  moraleLabelMap,
  moraleScoreMap,
} from "@/features/band-crew/catalog";
import { useBandCrewCatalog } from "@/features/band-crew/catalog-context";

type BandCrewMemberRow = Database["public"]["Tables"]["band_crew_members"]["Row"];

interface ManageCrewFormValues {
  assignment: CrewAssignment;
  morale: CrewMorale;
  loyalty: number;
  trainingFocus: string;
  trainingProgress: number;
  focus: string;
  traits: string;
  specialties: string;
  biography: string;
}


const formatDate = (value?: string | null) => {
  if (!value) return "No shows logged";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No shows logged";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const stepMoraleUp = (morale: CrewMorale): CrewMorale => {
  switch (morale) {
    case "burned_out":
      return "strained";
    case "strained":
      return "steady";
    default:
      return morale;
  }
};

const mergeMetadata = (base: CrewMetadata, overrides?: Partial<CrewMetadata>): CrewMetadata => {
  if (!overrides) {
    return base;
  }

  return {
    ...base,
    ...overrides,
    morale: overrides.morale ?? base.morale,
    loyalty: clamp(overrides.loyalty ?? base.loyalty, 0, 100),
    assignment: overrides.assignment ?? base.assignment,
    focus: overrides.focus ?? base.focus,
    specialties: overrides.specialties ?? base.specialties,
    traits: overrides.traits ?? base.traits,
    trainingFocus: overrides.trainingFocus ?? base.trainingFocus,
    trainingProgress: clamp(overrides.trainingProgress ?? base.trainingProgress, 0, 100),
    biography: overrides.biography ?? base.biography,
    lastGigDate: overrides.lastGigDate ?? base.lastGigDate,
  };
};

const createDefaultMetadata = (crewType: string): CrewMetadata => {
  const defaults = DISCIPLINE_DEFAULTS[crewType as CrewDiscipline];
  const base: CrewMetadata = {
    morale: "steady",
    loyalty: 60,
    assignment: defaults?.assignment ?? "Production",
    focus: defaults?.focus ?? crewType,
    specialties: defaults?.specialties ?? [],
    traits: defaults?.traits ?? [],
    trainingFocus: null,
    trainingProgress: 0,
    biography: null,
    lastGigDate: null,
  };

  return base;
};

const parseCrewMetadata = (row: BandCrewMemberRow): CrewMetadata => {
  const base = createDefaultMetadata(row.crew_type);
  if (!row.notes) {
    return base;
  }

  try {
    const raw = JSON.parse(row.notes) as Partial<CrewMetadata>;
    return mergeMetadata(base, raw);
  } catch (error) {
    console.error("Failed to parse crew metadata", error);
    return base;
  }
};

const buildCrewMetadataFromCandidate = (candidate: CrewCatalogItem): CrewMetadata => {
  const base = createDefaultMetadata(candidate.role);
  return mergeMetadata(base, {
    morale: candidate.morale,
    loyalty: candidate.loyalty,
    assignment: candidate.assignment,
    focus: candidate.focus,
    specialties: candidate.specialties,
    traits: candidate.traits,
    biography: candidate.background,
    trainingFocus: null,
    trainingProgress: 0,
    lastGigDate: null,
  });
};

type EnrichedCrewMember = BandCrewMemberRow & {
  metadata: CrewMetadata;
  impactScore: number;
};

const BandCrewManagement = () => {
  const queryClient = useQueryClient();
  const { data: primaryBand, isLoading: loadingBand } = usePrimaryBand();
  const bandId = primaryBand?.band_id ?? null;
  const bandName = primaryBand?.bands?.name ?? "Band";

  const { catalog, setCatalog } = useBandCrewCatalog();
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("all");
  const [candidateDialogOpen, setCandidateDialogOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<CrewCatalogItem | null>(null);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [activeCrew, setActiveCrew] = useState<EnrichedCrewMember | null>(null);

  const manageForm = useForm<ManageCrewFormValues>({
    defaultValues: {
      assignment: "Touring",
      morale: "steady",
      loyalty: 60,
      trainingFocus: "",
      trainingProgress: 0,
      focus: "",
      traits: "",
      specialties: "",
      biography: "",
    },
  });

  const { data: crewMembers, isLoading: loadingCrew } = useQuery<BandCrewMemberRow[]>({
    queryKey: ["band-crew", bandId],
    queryFn: async () => {
      if (!bandId) {
        return [];
      }

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

  const enrichedCrew = useMemo<EnrichedCrewMember[]>(() => {
    if (!crewMembers) return [];

    return crewMembers.map((row) => {
      const metadata = parseCrewMetadata(row);
      const skill = row.skill_level ?? 0;
      const experience = row.experience_years ?? 0;
      const loyalty = metadata.loyalty ?? 0;
      const impactScore = Math.round(skill * 0.6 + experience * 4 + loyalty * 0.3);

      return {
        ...row,
        metadata,
        impactScore,
      };
    });
  }, [crewMembers]);

  const filteredCatalog = useMemo(() => {
    if (selectedDiscipline === "all") {
      return catalog;
    }
    return catalog.filter((item) => item.role === selectedDiscipline);
  }, [catalog, selectedDiscipline]);

  const crewCount = enrichedCrew.length;
  const totalPayroll = enrichedCrew.reduce((sum, crew) => sum + (crew.salary_per_gig ?? 0), 0);
  const averageSkill = crewCount > 0 ? Math.round(enrichedCrew.reduce((sum, crew) => sum + (crew.skill_level ?? 0), 0) / crewCount) : 0;
  const averageLoyalty = crewCount > 0 ? Math.round(enrichedCrew.reduce((sum, crew) => sum + (crew.metadata.loyalty ?? 0), 0) / crewCount) : 0;

  const dominantMorale = useMemo(() => {
    if (!crewCount) return null;
    const counts = enrichedCrew.reduce((acc, crew) => {
      acc[crew.metadata.morale] = (acc[crew.metadata.morale] ?? 0) + 1;
      return acc;
    }, {} as Record<CrewMorale, number>);
    return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as CrewMorale | undefined) ?? null;
  }, [crewCount, enrichedCrew]);

  const assignmentCounts = useMemo(() => {
    const counts: Record<CrewAssignment, number> = {
      Touring: 0,
      Studio: 0,
      Production: 0,
      Standby: 0,
    };

    enrichedCrew.forEach((crew) => {
      counts[crew.metadata.assignment] = (counts[crew.metadata.assignment] ?? 0) + 1;
    });

    return counts;
  }, [enrichedCrew]);

  const hireCrewMutation = useMutation({
    mutationFn: async (candidate: CrewCatalogItem) => {
      if (!bandId) {
        throw new Error("Join a band to hire crew");
      }

      const metadata = buildCrewMetadataFromCandidate(candidate);
      const { error } = await supabase.from("band_crew_members").insert({
        band_id: bandId,
        name: candidate.name,
        crew_type: candidate.role,
        experience_years: candidate.experience,
        hire_date: new Date().toISOString(),
        salary_per_gig: candidate.salary,
        skill_level: candidate.skill,
        notes: JSON.stringify(metadata),
      });

      if (error) throw error;
    },
    onSuccess: (_, candidate) => {
      queryClient.invalidateQueries({ queryKey: ["band-crew", bandId] });
      setCatalog((prev) =>
        prev.map((item) =>
          item.id === candidate.id ? { ...item, openings: Math.max(0, item.openings - 1) } : item,
        ),
      );
      setCandidateDialogOpen(false);
      setSelectedCandidate(null);
      toast.success(`${candidate.name} hired to the crew`, {
        description: `${candidate.role} joins with ${candidate.skill}/100 skill and ${candidate.experience} years on the road.`,
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to hire crew member");
    },
  });

  const updateCrewMutation = useMutation({
    mutationFn: async ({
      crewId,
      updates,
      metadata,
    }: {
      crewId: string;
      updates?: Partial<BandCrewMemberRow>;
      metadata?: CrewMetadata;
    }) => {
      const payload: Database["public"]["Tables"]["band_crew_members"]["Update"] = { ...updates };
      if (metadata) {
        payload.notes = JSON.stringify(metadata);
      }

      const { error } = await supabase.from("band_crew_members").update(payload).eq("id", crewId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["band-crew", bandId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update crew member");
    },
  });

  const releaseCrewMutation = useMutation({
    mutationFn: async ({ crewId }: { crewId: string }) => {
      const { error } = await supabase.from("band_crew_members").delete().eq("id", crewId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["band-crew", bandId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to release crew member");
    },
  });

  useEffect(() => {
    if (!activeCrew) return;

    manageForm.reset({
      assignment: activeCrew.metadata.assignment,
      morale: activeCrew.metadata.morale,
      loyalty: activeCrew.metadata.loyalty,
      trainingFocus: activeCrew.metadata.trainingFocus ?? "",
      trainingProgress: activeCrew.metadata.trainingProgress ?? 0,
      focus: activeCrew.metadata.focus,
      traits: activeCrew.metadata.traits.join(", "),
      specialties: activeCrew.metadata.specialties.join("\n"),
      biography: activeCrew.metadata.biography ?? "",
    });
  }, [activeCrew, manageForm]);

  const openCandidateDialog = (candidate: CrewCatalogItem) => {
    setSelectedCandidate(candidate);
    setCandidateDialogOpen(true);
  };

  const closeCandidateDialog = () => {
    setCandidateDialogOpen(false);
    setSelectedCandidate(null);
  };

  const beginManageCrew = (crew: EnrichedCrewMember) => {
    setActiveCrew(crew);
    setManageDialogOpen(true);
  };

  const handleManageDialogChange = (open: boolean) => {
    setManageDialogOpen(open);
    if (!open) {
      setActiveCrew(null);
    }
  };

  const confirmHire = () => {
    if (!selectedCandidate) return;
    hireCrewMutation.mutate(selectedCandidate);
  };

  const handleLogGig = (crew: EnrichedCrewMember) => {
    const nextExperience = (crew.experience_years ?? 0) + 1;
    const nextSkill = clamp((crew.skill_level ?? 0) + 1, 0, 100);
    const nextMetadata: CrewMetadata = {
      ...crew.metadata,
      loyalty: clamp(crew.metadata.loyalty + 3, 0, 100),
      morale: stepMoraleUp(crew.metadata.morale),
      lastGigDate: new Date().toISOString(),
    };

    updateCrewMutation.mutate(
      {
        crewId: crew.id,
        updates: { experience_years: nextExperience, skill_level: nextSkill },
        metadata: nextMetadata,
      },
      {
        onSuccess: () => {
          toast.success(`${crew.name} logged another show`, {
            description: `Experience ${nextExperience} yrs · Skill ${nextSkill}/100`,
          });
        },
      },
    );
  };

  const handleTrainCrew = (crew: EnrichedCrewMember) => {
    const nextSkill = clamp((crew.skill_level ?? 0) + 2, 0, 100);
    const nextMetadata: CrewMetadata = {
      ...crew.metadata,
      trainingProgress: clamp((crew.metadata.trainingProgress ?? 0) + 15, 0, 100),
      morale: stepMoraleUp(crew.metadata.morale),
    };

    updateCrewMutation.mutate(
      {
        crewId: crew.id,
        updates: { skill_level: nextSkill },
        metadata: nextMetadata,
      },
      {
        onSuccess: () => {
          toast.success(`${crew.name} completed a training session`, {
            description: `Skill ${crew.skill_level}/100 → ${nextSkill}/100`,
          });
        },
      },
    );
  };

  const handleReleaseCrew = (crew: EnrichedCrewMember) => {
    const confirmed =
      typeof window === "undefined"
        ? true
        : window.confirm(`Release ${crew.name} from the touring crew? Payroll will free up immediately.`);
    if (!confirmed) return;

    releaseCrewMutation.mutate(
      { crewId: crew.id },
      {
        onSuccess: () => {
          toast.success(`${crew.name} has been released`, {
            description: "You now have room to recruit a fresh specialist.",
          });
        },
      },
    );
  };

  const submitManageForm = manageForm.handleSubmit((values) => {
    if (!activeCrew) return;

    const nextMetadata: CrewMetadata = {
      ...activeCrew.metadata,
      assignment: values.assignment,
      morale: values.morale,
      loyalty: clamp(Number(values.loyalty) || 0, 0, 100),
      trainingFocus: values.trainingFocus.trim() || null,
      trainingProgress: clamp(Number(values.trainingProgress) || 0, 0, 100),
      focus: values.focus.trim() || activeCrew.metadata.focus,
      traits: values.traits
        .split(",")
        .map((trait) => trait.trim())
        .filter(Boolean),
      specialties: values.specialties
        .split(/\n|,/)
        .map((specialty) => specialty.trim())
        .filter(Boolean),
      biography: values.biography.trim() ? values.biography.trim() : null,
    };

    updateCrewMutation.mutate(
      {
        crewId: activeCrew.id,
        metadata: nextMetadata,
      },
      {
        onSuccess: () => {
          toast.success(`${activeCrew.name}'s assignment updated`, {
            description: `${values.assignment} focus locked with morale ${moraleLabelMap[nextMetadata.morale]}.`,
          });
          handleManageDialogChange(false);
        },
      },
    );
  });

  if (loadingBand || loadingCrew) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading crew data...
        </div>
      </div>
    );
  }

  if (!bandId) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>Join a band to recruit crew</CardTitle>
              <CardDescription>
                Road and production staff live with your band. Form or join a band to unlock touring crew management.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <CircleDashed className="h-4 w-4" />
                <AlertTitle>No active band</AlertTitle>
                <AlertDescription>
                  Head over to the Band hub and pick your team. Once you have a band, you can hire specialists, set
                  assignments, and log their growth here.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-2xl">Band Crew • {bandName}</CardTitle>
              <CardDescription>
                Track your touring specialists, keep morale high, and shape assignments so every show fires on all cylinders.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span className="font-semibold text-foreground">{crewCount}</span> crew on payroll
              </div>
              <div className="flex items-center gap-1">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Avg skill <span className="font-semibold text-foreground">{averageSkill}</span>
              </div>
              <div className="flex items-center gap-1">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Loyalty <span className="font-semibold text-foreground">{averageLoyalty}</span>
              </div>
              <div>
                Payroll per gig: <span className="font-semibold text-foreground">{formatCurrency(totalPayroll)}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="text-sm font-medium text-muted-foreground">Dominant morale</div>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant={moraleBadgeVariant[dominantMorale ?? "steady"]}>
                    {dominantMorale ? moraleLabelMap[dominantMorale] : "Balanced"}
                  </Badge>
                  {dominantMorale && (
                    <span className="text-xs text-muted-foreground">
                      {moraleScoreMap[dominantMorale]} morale score
                    </span>
                  )}
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="text-sm font-medium text-muted-foreground">Touring coverage</div>
                <div className="mt-1 text-foreground">
                  {assignmentCounts.Touring} specialists
                  <p className="text-xs text-muted-foreground">{assignmentHighlights.Touring}</p>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="text-sm font-medium text-muted-foreground">Production backbone</div>
                <div className="mt-1 text-foreground">
                  {assignmentCounts.Production} leads
                  <p className="text-xs text-muted-foreground">{assignmentHighlights.Production}</p>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="text-sm font-medium text-muted-foreground">Reserve bench</div>
                <div className="mt-1 text-foreground">
                  {assignmentCounts.Standby} floaters
                  <p className="text-xs text-muted-foreground">{assignmentHighlights.Standby}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="roster" className="space-y-4">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="roster">Crew Roster</TabsTrigger>
            <TabsTrigger value="recruit">Recruit Talent</TabsTrigger>
            <TabsTrigger value="playbooks">Crew Playbooks</TabsTrigger>
          </TabsList>

          <TabsContent value="roster" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Active crew assignments</CardTitle>
                <CardDescription>
                  Keep morale pulsing, rotate training, and log shows so your specialists keep sharpening their edge.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {enrichedCrew.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center text-muted-foreground">
                    <UserPlus className="h-6 w-6" />
                    <div>
                      <div className="font-semibold text-foreground">No crew yet</div>
                      <p className="text-sm">
                        Recruit tour managers, engineers, and specialists to boost your live show consistency.
                      </p>
                    </div>
                    <Button onClick={() => setSelectedDiscipline("all")}>Open recruitment board</Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Member</TableHead>
                          <TableHead>Morale & Loyalty</TableHead>
                          <TableHead>Skill</TableHead>
                          <TableHead>Experience</TableHead>
                          <TableHead>Assignment</TableHead>
                          <TableHead>Payroll</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {enrichedCrew.map((crew) => (
                          <TableRow key={crew.id}>
                            <TableCell>
                              <div className="font-semibold text-foreground">{crew.name}</div>
                              <div className="text-xs text-muted-foreground">{crew.crew_type}</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {crew.metadata.traits.map((trait) => (
                                  <Badge key={trait} variant="outline" className="text-xs">
                                    {trait}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-2">
                                <Badge variant={moraleBadgeVariant[crew.metadata.morale]}>
                                  {moraleLabelMap[crew.metadata.morale]}
                                </Badge>
                                <span className="text-xs text-muted-foreground">Loyalty {crew.metadata.loyalty}/100</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-foreground">{crew.skill_level}/100</div>
                              <p className="text-xs text-muted-foreground">Impact {crew.impactScore}</p>
                              {crew.metadata.trainingProgress > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  Training {crew.metadata.trainingProgress}%
                                </p>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-foreground">{crew.experience_years} yrs</div>
                              <p className="text-xs text-muted-foreground">{formatDate(crew.metadata.lastGigDate)}</p>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <Badge variant="outline">{crew.metadata.assignment}</Badge>
                                <span className="text-xs text-muted-foreground">{crew.metadata.focus}</span>
                                <span className="text-xs text-muted-foreground">
                                  {assignmentHighlights[crew.metadata.assignment]}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-foreground">{formatCurrency(crew.salary_per_gig)}</div>
                              <p className="text-xs text-muted-foreground">per gig</p>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-wrap justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => beginManageCrew(crew)}
                                  disabled={updateCrewMutation.isPending}
                                >
                                  <ClipboardList className="mr-1 h-4 w-4" /> Manage
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleTrainCrew(crew)}
                                  disabled={updateCrewMutation.isPending}
                                >
                                  <TrendingUp className="mr-1 h-4 w-4" /> Train
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleLogGig(crew)}
                                  disabled={updateCrewMutation.isPending}
                                >
                                  <PlaneTakeoff className="mr-1 h-4 w-4" /> Log gig
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleReleaseCrew(crew)}
                                  disabled={releaseCrewMutation.isPending}
                                >
                                  <Trash2 className="mr-1 h-4 w-4" /> Release
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recruit" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>Recruit elite crew</CardTitle>
                  <CardDescription>
                    Hand-pick specialists from the touring talent network. Each hire arrives with proven stories and starts
                    contributing immediately.
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Label htmlFor="discipline-filter" className="text-xs uppercase text-muted-foreground">
                    Filter discipline
                  </Label>
                  <Select value={selectedDiscipline} onValueChange={setSelectedDiscipline}>
                    <SelectTrigger id="discipline-filter" className="w-[220px]">
                      <SelectValue placeholder="All disciplines" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All disciplines</SelectItem>
                      {CREW_DISCIPLINES.map((discipline) => (
                        <SelectItem key={discipline} value={discipline}>
                          {discipline}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <Sparkles className="h-4 w-4" />
                  <AlertTitle>Popmundo-inspired crew management</AlertTitle>
                  <AlertDescription>
                    Each hire comes with unique specialties, loyalty, and morale. Rotate them through tours, rehearse their
                    playbooks, and keep a reserve bench just like the classic Popmundo touring meta.
                  </AlertDescription>
                </Alert>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredCatalog.map((candidate) => (
                    <Card key={candidate.id} className="flex h-full flex-col justify-between">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between text-lg">
                          {candidate.name}
                          <Badge variant="secondary">{candidate.role}</Badge>
                        </CardTitle>
                        <CardDescription>{candidate.headline}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-1 flex-col justify-between space-y-4">
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">Skill {candidate.skill}/100</Badge>
                          <Badge variant="outline">{candidate.experience} yrs touring</Badge>
                          <Badge variant={moraleBadgeVariant[candidate.morale]}>
                            {moraleLabelMap[candidate.morale]}
                          </Badge>
                          <Badge variant="outline">Payroll {formatCurrency(candidate.salary)}</Badge>
                          <Badge variant="outline">Loyalty {candidate.loyalty}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{candidate.background}</p>
                        <div className="flex flex-wrap gap-2">
                          {candidate.specialties.map((specialty) => (
                            <Badge key={specialty} variant="outline" className="text-xs">
                              {specialty}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                      <CardFooter className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Openings: {candidate.openings > 0 ? candidate.openings : "Filled"}
                        </span>
                        <Button
                          size="sm"
                          onClick={() => openCandidateDialog(candidate)}
                          disabled={candidate.openings === 0 || hireCrewMutation.isPending}
                        >
                          Review & hire
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                  {filteredCatalog.length === 0 && (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                      No specialists match that filter right now. Try another discipline or check back after a few in-game
                      days for refreshed leads.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="playbooks" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Tour crew operating rhythm</CardTitle>
                <CardDescription>
                  Blend arena-proven structure with Popmundo-style depth. Rotate responsibilities, protect morale, and keep
                  the road family thriving.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 text-sm text-muted-foreground">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Weekly cadence</h4>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>Touring crew logs each show for morale bumps and incremental skill gains.</li>
                    <li>Production leads review load-in notes after every third show and flag venue quirks for the roadmap.</li>
                    <li>Standby bench rotates into rehearsals twice a week to stay warmed up for emergencies.</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Morale levers</h4>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>"Electric" morale unlocks surprise fan activations and reduces production mishaps.</li>
                    <li>"Strained" morale signals it's time for recovery days, merch splits, or crew appreciation moments.</li>
                    <li>Keep loyalty above 70 to prevent poaching offers from rival labels.</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Playbook rotations</h4>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>Tour Manager anchors the daily advance, Production chief handles night-load and vendor calls.</li>
                    <li>FOH and Lighting trade post-show debriefs with the band to sync next-night tweaks.</li>
                    <li>Merch & Wardrobe co-design weekend capsule drops tied to city lore and fan quests.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={candidateDialogOpen} onOpenChange={(open) => (open ? setCandidateDialogOpen(true) : closeCandidateDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hire crew specialist</DialogTitle>
            <DialogDescription>
              Confirm the hire to add this specialist to your band's touring roster. They'll appear in your crew table
              immediately.
            </DialogDescription>
          </DialogHeader>
          {selectedCandidate && (
            <div className="space-y-4">
              <div>
                <div className="text-lg font-semibold text-foreground">{selectedCandidate.name}</div>
                <div className="text-sm text-muted-foreground">{selectedCandidate.headline}</div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{selectedCandidate.role}</Badge>
                <Badge variant="outline">Skill {selectedCandidate.skill}/100</Badge>
                <Badge variant="outline">{selectedCandidate.experience} yrs</Badge>
                <Badge variant="outline">Payroll {formatCurrency(selectedCandidate.salary)}</Badge>
                <Badge variant={moraleBadgeVariant[selectedCandidate.morale]}>
                  {moraleLabelMap[selectedCandidate.morale]}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{selectedCandidate.background}</p>
              <div>
                <h4 className="text-sm font-semibold text-foreground">Specialties</h4>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {selectedCandidate.specialties.map((specialty) => (
                    <li key={specialty}>{specialty}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={closeCandidateDialog}>
              Cancel
            </Button>
            <Button
              onClick={confirmHire}
              disabled={!selectedCandidate || selectedCandidate.openings === 0 || hireCrewMutation.isPending}
            >
              {hireCrewMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Confirm hire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manageDialogOpen} onOpenChange={handleManageDialogChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage crew assignment</DialogTitle>
            <DialogDescription>
              Update morale targets, assignments, and training focus to keep your crew aligned with the tour strategy.
            </DialogDescription>
          </DialogHeader>
          {activeCrew && (
            <form onSubmit={submitManageForm} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Assignment</Label>
                  <Controller
                    name="assignment"
                    control={manageForm.control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Touring">Touring</SelectItem>
                          <SelectItem value="Studio">Studio</SelectItem>
                          <SelectItem value="Production">Production</SelectItem>
                          <SelectItem value="Standby">Standby</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Morale</Label>
                  <Controller
                    name="morale"
                    control={manageForm.control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="electric">Electric</SelectItem>
                          <SelectItem value="steady">Steady</SelectItem>
                          <SelectItem value="strained">Strained</SelectItem>
                          <SelectItem value="burned_out">Burned Out</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Loyalty</Label>
                  <Controller
                    name="loyalty"
                    control={manageForm.control}
                    render={({ field }) => (
                      <Input type="number" min={0} max={100} {...field} />
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Training focus</Label>
                  <Controller
                    name="trainingFocus"
                    control={manageForm.control}
                    render={({ field }) => <Input placeholder="Rig redesign, crisis playbooks, etc." {...field} />}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Training progress</Label>
                  <Controller
                    name="trainingProgress"
                    control={manageForm.control}
                    render={({ field }) => <Input type="number" min={0} max={100} {...field} />}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Focus headline</Label>
                  <Controller
                    name="focus"
                    control={manageForm.control}
                    render={({ field }) => <Input placeholder="Nightly settlements, Lighting design, etc." {...field} />}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Traits (comma separated)</Label>
                  <Controller
                    name="traits"
                    control={manageForm.control}
                    render={({ field }) => <Input placeholder="Calm under pressure, Logistics wizard" {...field} />}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Specialties (comma or new line)</Label>
                  <Controller
                    name="specialties"
                    control={manageForm.control}
                    render={({ field }) => <Textarea rows={3} placeholder="Timecode sequencing, Crisis response" {...field} />}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Backstage notes</Label>
                <Controller
                  name="biography"
                  control={manageForm.control}
                  render={({ field }) => (
                    <Textarea rows={4} placeholder="Document crew history, motivations, and road quirks." {...field} />
                  )}
                />
              </div>
              <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <Button type="button" variant="outline" onClick={() => handleManageDialogChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateCrewMutation.isPending}>
                  {updateCrewMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ClipboardList className="mr-2 h-4 w-4" />
                  )}
                  Save changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BandCrewManagement;
