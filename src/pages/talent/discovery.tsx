// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, format, isAfter, isBefore, parseISO } from "date-fns";
import { z } from "zod";
import {
  Badge,
} from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/lib/supabase-types";
import {
  SubmitCastingReviewInput,
  SubmitCastingSubmissionInput,
  deleteCastingSubmission,
  listCastingCalls,
  listCastingSubmissionsByProfile,
  listCastingSubmissionsForReview,
  submitCastingReview,
  submitCastingSubmission,
} from "@/lib/api/talent";
import { AlertCircle, Briefcase, Calendar, CheckCircle2, ClipboardList, Filter, Layers, MapPin, Search, Sparkles, Users, Video, XCircle } from "lucide-react";

const submissionSchema = z.object({
  castingCallRoleId: z.string().optional(),
  coverLetter: z
    .string()
    .min(50, "Share at least a short pitch or introduction (50 characters minimum).")
    .max(2000, "Keep your cover letter under 2000 characters."),
  experienceSummary: z
    .string()
    .min(25, "Highlight a few experience details so casting can evaluate you.")
    .max(2000, "Keep your experience summary focused and under 2000 characters."),
  portfolioUrl: z
    .string()
    .url("Enter a valid URL or leave blank.")
    .optional()
    .or(z.literal("")),
  resumeUrl: z
    .string()
    .url("Enter a valid URL or leave blank.")
    .optional()
    .or(z.literal("")),
  auditionVideoUrl: z
    .string()
    .url("Enter a valid URL or leave blank.")
    .optional()
    .or(z.literal("")),
});

type SubmissionFormValues = z.infer<typeof submissionSchema>;

type ProfileRow = Tables<"profiles">;

type ReviewDraft = {
  decision: "pending" | "shortlist" | "callback" | "hire" | "decline";
  feedback: string;
  score?: number;
};

type FiltersState = {
  searchTerm: string;
  projectType: string;
  unionStatus: string;
  status: "all" | "open" | "closing" | "closed";
  location: string;
  remoteOnly: boolean;
};

const statusBadgeStyles: Record<string, string> = {
  open: "bg-emerald-100 text-emerald-800 border-emerald-200",
  closed: "bg-slate-100 text-slate-800 border-slate-200",
  draft: "bg-muted text-muted-foreground border-muted-foreground/20",
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  shortlisted: "bg-indigo-100 text-indigo-800 border-indigo-200",
  callback: "bg-blue-100 text-blue-800 border-blue-200",
  hired: "bg-purple-100 text-purple-800 border-purple-200",
  declined: "bg-rose-100 text-rose-800 border-rose-200",
  submitted: "bg-sky-100 text-sky-800 border-sky-200",
  under_review: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

const reviewDecisionToStatus: Record<ReviewDraft["decision"], SubmitCastingSubmissionInput["status"]> = {
  pending: "under_review",
  shortlist: "shortlisted",
  callback: "callback",
  hire: "hired",
  decline: "declined",
};

const normalizeOptionalField = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const TalentDiscoveryPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<FiltersState>({
    searchTerm: "",
    projectType: "all",
    unionStatus: "all",
    status: "open",
    location: "",
    remoteOnly: false,
  });
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});

  const submissionForm = useForm<SubmissionFormValues>({
    resolver: zodResolver(submissionSchema),
    defaultValues: {
      castingCallRoleId: undefined,
      coverLetter: "",
      experienceSummary: "",
      portfolioUrl: "",
      resumeUrl: "",
      auditionVideoUrl: "",
    },
  });

  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["talent-profile"],
    queryFn: async (): Promise<ProfileRow | null> => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, stage_name, primary_role, location, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data as ProfileRow | null;
    },
  });

  const castingFilters = useMemo(() => {
    const statuses =
      filters.status === "all"
        ? undefined
        : filters.status === "closing"
        ? ["open"]
        : [filters.status];

    return {
      searchTerm: filters.searchTerm || undefined,
      projectTypes: filters.projectType === "all" ? undefined : [filters.projectType],
      unionStatuses: filters.unionStatus === "all" ? undefined : [filters.unionStatus],
      statuses,
      location: filters.location || undefined,
      remoteOnly: filters.remoteOnly ? true : undefined,
    };
  }, [filters]);

  const { data: castingCalls, isLoading: isLoadingCalls } = useQuery({
    queryKey: ["casting-calls", castingFilters],
    queryFn: () => listCastingCalls(castingFilters),
  });

  const filteredCalls = useMemo(() => {
    const results = castingCalls ?? [];
    if (filters.status !== "closing") {
      return results;
    }

    const today = new Date();
    return results.filter((call) => {
      if (!call.application_deadline) return false;
      const deadline = parseISO(call.application_deadline);
      const days = differenceInCalendarDays(deadline, today);
      return days >= 0 && days <= 7;
    });
  }, [castingCalls, filters.status]);

  useEffect(() => {
    if (!filteredCalls.length) {
      setSelectedCallId(null);
      return;
    }

    if (!selectedCallId) {
      setSelectedCallId(filteredCalls[0].id);
      return;
    }

    const stillVisible = filteredCalls.some((call) => call.id === selectedCallId);
    if (!stillVisible) {
      setSelectedCallId(filteredCalls[0].id);
    }
  }, [filteredCalls, selectedCallId]);

  const selectedCall = useMemo(() => {
    if (!selectedCallId) return null;
    return filteredCalls.find((call) => call.id === selectedCallId) ?? null;
  }, [filteredCalls, selectedCallId]);

  const projectTypes = useMemo(() => {
    if (!castingCalls) return [] as string[];
    return Array.from(new Set(castingCalls.map((call) => call.project_type).filter(Boolean)));
  }, [castingCalls]);

  const unionStatuses = useMemo(() => {
    if (!castingCalls) return [] as string[];
    return Array.from(new Set(castingCalls.map((call) => call.union_status).filter(Boolean))) as string[];
  }, [castingCalls]);

  const { data: submissions, isLoading: isLoadingSubmissions } = useQuery({
    queryKey: ["casting-submissions", profile?.id],
    queryFn: () => (profile?.id ? listCastingSubmissionsByProfile(profile.id) : Promise.resolve([])),
    enabled: Boolean(profile?.id),
  });

  const { data: reviewQueue, isLoading: isLoadingReviewQueue } = useQuery({
    queryKey: ["casting-review-queue"],
    queryFn: () => listCastingSubmissionsForReview(),
  });

  const submissionMutation = useMutation({
    mutationFn: async (values: SubmissionFormValues) => {
      if (!profile?.id) {
        throw new Error("Sign in and complete your talent profile before submitting.");
      }
      if (!selectedCall) {
        throw new Error("Select a casting call before submitting.");
      }

      if (selectedCall.roles.length > 0 && !values.castingCallRoleId) {
        throw new Error("Pick a specific role to apply for.");
      }

      const payload: SubmitCastingSubmissionInput = {
        castingCallId: selectedCall.id,
        talentProfileId: profile.id,
        castingCallRoleId: values.castingCallRoleId ?? null,
        coverLetter: values.coverLetter,
        experienceSummary: values.experienceSummary,
        portfolioUrl: normalizeOptionalField(values.portfolioUrl),
        resumeUrl: normalizeOptionalField(values.resumeUrl),
        auditionVideoUrl: normalizeOptionalField(values.auditionVideoUrl),
        status: "submitted",
      };

      return submitCastingSubmission(payload);
    },
    onSuccess: () => {
      toast({ title: "Submission sent", description: "Your materials were delivered to the casting team." });
      submissionForm.reset();
      queryClient.invalidateQueries({ queryKey: ["casting-submissions", profile?.id] });
      queryClient.invalidateQueries({ queryKey: ["casting-calls"] });
    },
    onError: (error: unknown) => {
      toast({
        title: "Unable to submit",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (submissionId: string) => deleteCastingSubmission(submissionId),
    onSuccess: () => {
      toast({ title: "Submission withdrawn", description: "We've removed your materials from review." });
      queryClient.invalidateQueries({ queryKey: ["casting-submissions", profile?.id] });
      queryClient.invalidateQueries({ queryKey: ["casting-review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["casting-calls"] });
    },
    onError: (error: unknown) => {
      toast({
        title: "Unable to withdraw",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ submissionId, draft }: { submissionId: string; draft: ReviewDraft }) => {
      const payload: SubmitCastingReviewInput = {
        submissionId,
        reviewerProfileId: profile?.id ?? null,
        decision: draft.decision,
        feedback: normalizeOptionalField(draft.feedback),
        score: draft.score ?? null,
        statusUpdate: reviewDecisionToStatus[draft.decision],
      };

      return submitCastingReview(payload);
    },
    onSuccess: (_, variables) => {
      toast({ title: "Review recorded", description: "Your decision is now reflected in the queue." });
      setReviewDrafts((prev) => {
        const updated = { ...prev };
        delete updated[variables.submissionId];
        return updated;
      });
      queryClient.invalidateQueries({ queryKey: ["casting-review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["casting-submissions", profile?.id] });
      queryClient.invalidateQueries({ queryKey: ["casting-calls"] });
    },
    onError: (error: unknown) => {
      toast({
        title: "Unable to record review",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const selectedRoleOptions = selectedCall?.roles ?? [];

  const handleReviewDraftChange = (submissionId: string, partial: Partial<ReviewDraft>) => {
    setReviewDrafts((prev) => ({
      ...prev,
      [submissionId]: {
        decision: prev[submissionId]?.decision ?? "pending",
        feedback: prev[submissionId]?.feedback ?? "",
        score: prev[submissionId]?.score,
        ...partial,
      },
    }));
  };

  const getReviewDraft = (submissionId: string): ReviewDraft => {
    return (
      reviewDrafts[submissionId] ?? {
        decision: "pending",
        feedback: "",
      }
    );
  };

  const renderDeadlineBadge = (deadline: string | null) => {
    if (!deadline) {
      return <Badge variant="outline" className="border-dashed">Rolling</Badge>;
    }

    const deadlineDate = parseISO(deadline);
    const today = new Date();
    const daysRemaining = differenceInCalendarDays(deadlineDate, today);

    let style = "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (daysRemaining <= 3) {
      style = "bg-rose-100 text-rose-800 border-rose-200";
    } else if (daysRemaining <= 7) {
      style = "bg-amber-100 text-amber-800 border-amber-200";
    } else if (isBefore(deadlineDate, today)) {
      style = "bg-slate-100 text-slate-700 border-slate-200";
    }

    return (
      <Badge variant="outline" className={cn("border", style)}>
        <Calendar className="mr-1 h-3.5 w-3.5" />
        {daysRemaining < 0 ? "Closed" : `${daysRemaining} days left`}
      </Badge>
    );
  };

  const renderStatusBadge = (status?: string | null, label?: string) => {
    if (!status) return null;
    const className = statusBadgeStyles[status] ?? "bg-muted text-muted-foreground border-muted";
    return (
      <Badge variant="outline" className={cn("border", className)}>
        {label ?? status.replace("_", " ")}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Talent Discovery & Auditions</h1>
            <p className="text-muted-foreground">
              Find open casting calls, submit tailored materials, and track reviews from casting directors.
            </p>
          </div>
          {profile && (
            <Card className="w-full max-w-sm border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Your talent profile</CardTitle>
                <CardDescription>
                  {profile.stage_name ?? profile.full_name ?? "Complete your profile to stand out."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    <span>{profile.primary_role ?? "Role not set"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{profile.location ?? "Location unknown"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </header>

      <Tabs defaultValue="discover" className="space-y-6">
        <TabsList>
          <TabsTrigger value="discover">Discover</TabsTrigger>
          <TabsTrigger value="submissions">My submissions</TabsTrigger>
          <TabsTrigger value="reviews">Review queue</TabsTrigger>
        </TabsList>

        <TabsContent value="discover" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Filter className="h-4 w-4" /> Refine casting calls
              </CardTitle>
              <CardDescription>
                Search across active auditions, filter by project type, and find the best fit for your talents.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="search">Keyword</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Vocals, sci-fi series, LA..."
                      value={filters.searchTerm}
                      onChange={(event) => setFilters((prev) => ({ ...prev, searchTerm: event.target.value }))}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="projectType">Project type</Label>
                  <Select
                    value={filters.projectType}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, projectType: value }))}
                  >
                    <SelectTrigger id="projectType">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {projectTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={filters.status}
                    onValueChange={(value: FiltersState["status"]) =>
                      setFilters((prev) => ({ ...prev, status: value }))
                    }
                  >
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All calls</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closing">Closing soon</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unionStatus">Union status</Label>
                  <Select
                    value={filters.unionStatus}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, unionStatus: value }))}
                  >
                    <SelectTrigger id="unionStatus">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All calls</SelectItem>
                      {unionStatuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="City, country, or region"
                    value={filters.location}
                    onChange={(event) => setFilters((prev) => ({ ...prev, location: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Switch
                      checked={filters.remoteOnly}
                      onCheckedChange={(checked) => setFilters((prev) => ({ ...prev, remoteOnly: checked }))}
                    />
                    Remote friendly only
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Filter to calls that explicitly support remote or hybrid auditions.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold">Casting calls</CardTitle>
                <CardDescription>
                  {isLoadingCalls ? "Loading open calls..." : `${filteredCalls.length} opportunities available`}
                </CardDescription>
              </CardHeader>
              <Separator />
              <ScrollArea className="h-[540px]">
                <div className="space-y-3 p-4">
                  {!isLoadingCalls && filteredCalls.length === 0 && (
                    <Card className="border-dashed">
                      <CardContent className="flex flex-col items-center gap-3 py-8 text-center text-sm text-muted-foreground">
                        <AlertCircle className="h-6 w-6" />
                        <div>
                          <p className="font-semibold text-foreground">No casting calls match your filters</p>
                          <p>Try broadening your search or clearing some filters.</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {filteredCalls.map((call) => {
                    const deadlineBadge = renderDeadlineBadge(call.application_deadline ?? null);
                    const isActive = selectedCallId === call.id;
                    return (
                      <button
                        key={call.id}
                        type="button"
                        onClick={() => setSelectedCallId(call.id)}
                        className={cn(
                          "w-full rounded-lg border bg-background text-left transition hover:shadow-sm",
                          isActive ? "border-primary" : "border-border",
                        )}
                      >
                        <div className="flex flex-col gap-3 p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-foreground">{call.title}</h3>
                            {renderStatusBadge(call.status)}
                            {call.is_remote_friendly && (
                              <Badge variant="outline" className="border-sky-200 bg-sky-100 text-sky-800">
                                Remote friendly
                              </Badge>
                            )}
                            {deadlineBadge}
                          </div>
                          <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                            <div className="flex items-center gap-2">
                              <Briefcase className="h-4 w-4" />
                              <span>{call.project_type}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              <span>{call.location ?? "Location varies"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              <span>{call.roles.length} roles posted</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <ClipboardList className="h-4 w-4" />
                              <span>{call.submissionStats.total} submissions</span>
                            </div>
                          </div>
                          <p className="line-clamp-2 text-sm text-muted-foreground">{call.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </Card>

            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Audition details</CardTitle>
                <CardDescription>
                  {selectedCall ? "Review project expectations and craft your submission." : "Select a casting call to view details."}
                </CardDescription>
              </CardHeader>
              {selectedCall ? (
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {renderStatusBadge(selectedCall.status)}
                      {renderDeadlineBadge(selectedCall.application_deadline ?? null)}
                      {selectedCall.union_status && renderStatusBadge(selectedCall.union_status, selectedCall.union_status)}
                    </div>
                    <h2 className="text-2xl font-semibold text-foreground">{selectedCall.title}</h2>
                    <p className="text-muted-foreground">{selectedCall.description ?? "No description provided."}</p>
                    <div className="grid gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">Production company</span>
                        <span className="text-muted-foreground">{selectedCall.production_company ?? "Not listed"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">Location</span>
                        <span className="text-muted-foreground">{selectedCall.location ?? "Varies"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">Compensation</span>
                        <span className="text-muted-foreground">
                          {selectedCall.compensation_min || selectedCall.compensation_max
                            ? `${selectedCall.compensation_min ?? "?"} - ${selectedCall.compensation_max ?? "?"} ${
                                selectedCall.currency ?? "USD"
                              }`
                            : "Negotiable"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
                      <Layers className="h-4 w-4" /> Roles available
                    </h3>
                    {selectedCall.roles.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        This casting call accepts general submissions. Highlight how you can contribute to the production.
                      </p>
                    ) : (
                      <div className="grid gap-3">
                        {selectedCall.roles.map((role) => (
                          <div key={role.id} className="rounded-lg border bg-muted/50 p-3 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-medium text-foreground">{role.name}</div>
                              <div className="flex flex-wrap gap-2">
                                {role.role_type && <Badge variant="outline">{role.role_type}</Badge>}
                                {role.age_range && <Badge variant="outline">Age: {role.age_range}</Badge>}
                                {role.gender && <Badge variant="outline">{role.gender}</Badge>}
                              </div>
                            </div>
                            {role.description && <p className="mt-2 text-muted-foreground">{role.description}</p>}
                            {(role.required_skills?.length ?? 0) > 0 && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Required skills: {role.required_skills?.join(", ")}
                              </p>
                            )}
                            {role.availability_requirements && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Availability: {role.availability_requirements}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div>
                      <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
                        <Sparkles className="h-4 w-4" /> Submit materials
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Customize your pitch, include highlight reels, and track the status of each audition.
                      </p>
                    </div>
                    <Form {...submissionForm}>
                      <form
                        onSubmit={submissionForm.handleSubmit((values) => submissionMutation.mutate(values))}
                        className="space-y-4"
                      >
                        {selectedRoleOptions.length > 0 && (
                          <FormField
                            control={submissionForm.control}
                            name="castingCallRoleId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Select role</FormLabel>
                                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Choose the role you want to audition for" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {selectedRoleOptions.map((role) => (
                                      <SelectItem key={role.id} value={role.id}>
                                        {role.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        <FormField
                          control={submissionForm.control}
                          name="coverLetter"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cover letter</FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  placeholder="Introduce yourself, share your motivation, and highlight why you're a great fit."
                                  rows={4}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={submissionForm.control}
                          name="experienceSummary"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Experience highlights</FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  placeholder="List relevant performances, training, or notable achievements."
                                  rows={4}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid gap-4 md:grid-cols-2">
                          <FormField
                            control={submissionForm.control}
                            name="portfolioUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Portfolio link</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="https://" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={submissionForm.control}
                            name="resumeUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Resume link</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="https://" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={submissionForm.control}
                            name="auditionVideoUrl"
                            render={({ field }) => (
                              <FormItem className="md:col-span-2">
                                <FormLabel>Audition video</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="https://" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="flex items-center justify-between gap-4">
                          <p className="text-xs text-muted-foreground">
                            Submitting binds this audition to your profile so you can track reviews in real time.
                          </p>
                          <Button type="submit" disabled={submissionMutation.isPending}>
                            {submissionMutation.isPending ? "Submitting..." : "Submit audition"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </div>
                </CardContent>
              ) : (
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  Select a casting call from the left panel to see requirements and send your audition materials.
                </CardContent>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="submissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Your audition submissions</CardTitle>
              <CardDescription>
                Monitor decisions, review director feedback, and withdraw materials if needed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSubmissions ? (
                <div className="py-10 text-center text-muted-foreground">Loading your submissions...</div>
              ) : (submissions?.length ?? 0) === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  You haven't submitted to any casting calls yet. Visit the Discover tab to find your next audition.
                </div>
              ) : (
                <div className="space-y-4">
                  {submissions?.map((submission) => {
                    const deadline = submission.casting_call?.application_deadline;
                    const isClosed = deadline ? isAfter(new Date(), parseISO(deadline)) : false;
                    return (
                      <Card key={submission.id} className="border">
                        <CardHeader className="pb-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="text-base font-semibold">
                              {submission.casting_call?.title ?? "Casting call"}
                            </CardTitle>
                            {renderStatusBadge(submission.status)}
                            {submission.role && (
                              <Badge variant="outline" className="border-indigo-200 bg-indigo-100 text-indigo-800">
                                {submission.role.name}
                              </Badge>
                            )}
                            {deadline && renderDeadlineBadge(deadline)}
                          </div>
                          <CardDescription>
                            Submitted {format(parseISO(submission.created_at), "PPP p")} • {submission.casting_call?.project_type}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm text-muted-foreground">
                          {submission.cover_letter && (
                            <div>
                              <p className="font-medium text-foreground">Cover letter</p>
                              <p>{submission.cover_letter}</p>
                            </div>
                          )}
                          {submission.experience_summary && (
                            <div>
                              <p className="font-medium text-foreground">Experience summary</p>
                              <p>{submission.experience_summary}</p>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-4 text-xs">
                            {submission.portfolio_url && (
                              <a
                                href={submission.portfolio_url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-primary underline"
                              >
                                <Sparkles className="h-3 w-3" /> Portfolio
                              </a>
                            )}
                            {submission.resume_url && (
                              <a
                                href={submission.resume_url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-primary underline"
                              >
                                <ClipboardList className="h-3 w-3" /> Resume
                              </a>
                            )}
                            {submission.audition_video_url && (
                              <a
                                href={submission.audition_video_url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-primary underline"
                              >
                                <Video className="h-3 w-3" /> Audition video
                              </a>
                            )}
                          </div>
                          {(submission.casting_reviews?.length ?? 0) > 0 && (
                            <div className="space-y-2 rounded-md border bg-muted/40 p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Casting feedback
                              </p>
                              {submission.casting_reviews?.map((review) => (
                                <div key={review.id} className="space-y-1 text-sm">
                                  <div className="flex items-center gap-2 text-foreground">
                                    {review.decision === "hire" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                                    {review.decision === "decline" && <XCircle className="h-4 w-4 text-rose-500" />}
                                    <span className="font-medium capitalize">{review.decision.replace("_", " ")}</span>
                                    {review.score !== null && review.score !== undefined && (
                                      <Badge variant="outline">Score: {review.score}</Badge>
                                    )}
                                  </div>
                                  {review.feedback && <p className="text-muted-foreground">{review.feedback}</p>}
                                  <p className="text-xs text-muted-foreground">
                                    Reviewed {format(parseISO(review.created_at), "PPP p")}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                        <CardFooter className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
                          <div>
                            {isClosed
                              ? "This casting call has closed."
                              : "You can withdraw your submission while the call is open."}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={withdrawMutation.isPending || isClosed}
                            onClick={() => withdrawMutation.mutate(submission.id)}
                          >
                            Withdraw submission
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

        <TabsContent value="reviews" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Casting review workflow</CardTitle>
              <CardDescription>
                Collaborate with your casting team, score auditions, and move promising talent forward.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingReviewQueue ? (
                <div className="py-10 text-center text-muted-foreground">Loading review queue...</div>
              ) : (reviewQueue?.length ?? 0) === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  All caught up! New submissions will appear here as talent applies.
                </div>
              ) : (
                <div className="space-y-4">
                  {reviewQueue?.map((submission) => {
                    const draft = getReviewDraft(submission.id);
                    return (
                      <Card key={submission.id} className="border">
                        <CardHeader className="pb-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="text-base font-semibold">
                              {submission.casting_call?.title ?? "Casting call"}
                            </CardTitle>
                            {renderStatusBadge(submission.status)}
                            {submission.role && <Badge variant="outline">{submission.role.name}</Badge>}
                          </div>
                          <CardDescription className="flex flex-wrap items-center gap-3 text-xs">
                            <span>
                              Submitted {format(parseISO(submission.created_at), "PPP p")} • {submission.casting_call?.project_type}
                            </span>
                            {submission.casting_call?.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {submission.casting_call.location}
                              </span>
                            )}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm text-muted-foreground">
                          {submission.cover_letter && (
                            <div>
                              <p className="font-medium text-foreground">Cover letter</p>
                              <p>{submission.cover_letter}</p>
                            </div>
                          )}
                          {submission.experience_summary && (
                            <div>
                              <p className="font-medium text-foreground">Experience summary</p>
                              <p>{submission.experience_summary}</p>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-4 text-xs">
                            {submission.portfolio_url && (
                              <a
                                href={submission.portfolio_url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-primary underline"
                              >
                                <Sparkles className="h-3 w-3" /> Portfolio
                              </a>
                            )}
                            {submission.resume_url && (
                              <a
                                href={submission.resume_url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-primary underline"
                              >
                                <ClipboardList className="h-3 w-3" /> Resume
                              </a>
                            )}
                            {submission.audition_video_url && (
                              <a
                                href={submission.audition_video_url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-primary underline"
                              >
                                <Video className="h-3 w-3" /> Audition video
                              </a>
                            )}
                          </div>
                          <Separator />
                          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                            <div className="space-y-2">
                              <Label htmlFor={`decision-${submission.id}`}>Decision</Label>
                              <Select
                                value={draft.decision}
                                onValueChange={(value: ReviewDraft["decision"]) =>
                                  handleReviewDraftChange(submission.id, { decision: value })
                                }
                              >
                                <SelectTrigger id={`decision-${submission.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Keep in review</SelectItem>
                                  <SelectItem value="shortlist">Shortlist</SelectItem>
                                  <SelectItem value="callback">Invite to callback</SelectItem>
                                  <SelectItem value="hire">Offer role</SelectItem>
                                  <SelectItem value="decline">Decline</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`score-${submission.id}`}>Score (0-100)</Label>
                              <Input
                                id={`score-${submission.id}`}
                                type="number"
                                min={0}
                                max={100}
                                value={draft.score ?? ""}
                                onChange={(event) =>
                                  handleReviewDraftChange(submission.id, {
                                    score: event.target.value === "" ? undefined : Number(event.target.value),
                                  })
                                }
                              />
                            </div>
                            <div className="md:col-span-2 space-y-2">
                              <Label htmlFor={`feedback-${submission.id}`}>Feedback for talent</Label>
                              <Textarea
                                id={`feedback-${submission.id}`}
                                value={draft.feedback}
                                onChange={(event) =>
                                  handleReviewDraftChange(submission.id, { feedback: event.target.value })
                                }
                                placeholder="Share context for your decision. Talent sees this when the review is published."
                                rows={3}
                              />
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() =>
                              setReviewDrafts((prev) => {
                                const updated = { ...prev };
                                delete updated[submission.id];
                                return updated;
                              })
                            }
                          >
                            Reset
                          </Button>
                          <Button
                            onClick={() => reviewMutation.mutate({ submissionId: submission.id, draft })}
                            disabled={reviewMutation.isPending}
                          >
                            {reviewMutation.isPending ? "Saving..." : "Save review"}
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
  );
};

export default TalentDiscoveryPage;
