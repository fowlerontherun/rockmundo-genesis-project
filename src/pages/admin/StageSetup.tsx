import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, RefreshCcw, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";

import { AdminRoute } from "@/components/AdminRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

import {
  StageBandRoleWithPedals,
  StageCrewRoleFormValues,
  StageCrewRoleRow,
  StageMetricsFormValues,
  StagePedalboardFormValues,
  StagePedalboardItemRow,
  StageRigSystemFormValues,
  StageRigSystemRow,
  StageSetupMetricRow,
  StageBandRoleFormValues,
  arrayToMultiline,
  bandRoleSchema,
  createStageBandRole,
  createStageCrewRole,
  createStagePedalboardItem,
  createStageRigSystem,
  crewRoleSchema,
  defaultBandRoleValues,
  defaultCrewRoleValues,
  defaultMetricsValues,
  defaultPedalboardValues,
  defaultRigSystemValues,
  deleteStageBandRole,
  deleteStageCrewRole,
  deleteStagePedalboardItem,
  deleteStageRigSystem,
  fetchStageBandRolesWithPedals,
  fetchStageCrewRoles,
  fetchStageRigSystems,
  fetchStageSetupMetrics,
  metricsSchema,
  multilineToArray,
  pedalboardItemSchema,
  rigSystemSchema,
  saveStageSetupMetrics,
  updateStageBandRole,
  updateStageCrewRole,
  updateStagePedalboardItem,
  updateStageRigSystem,
} from "./stageSetup.helpers";

export default function StageSetupAdmin() {
  const { toast } = useToast();
  const [bandRoles, setBandRoles] = useState<StageBandRoleWithPedals[]>([]);
  const [rigSystems, setRigSystems] = useState<StageRigSystemRow[]>([]);
  const [crewRoles, setCrewRoles] = useState<StageCrewRoleRow[]>([]);
  const [metrics, setMetrics] = useState<StageSetupMetricRow | null>(null);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const [editingBandRole, setEditingBandRole] = useState<StageBandRoleWithPedals | null>(null);
  const [editingRigSystem, setEditingRigSystem] = useState<StageRigSystemRow | null>(null);
  const [editingCrewRole, setEditingCrewRole] = useState<StageCrewRoleRow | null>(null);
  const [editingPedalboardItem, setEditingPedalboardItem] = useState<StagePedalboardItemRow | null>(null);

  const [isLoadingBandRoles, setIsLoadingBandRoles] = useState(false);
  const [isLoadingRigSystems, setIsLoadingRigSystems] = useState(false);
  const [isLoadingCrewRoles, setIsLoadingCrewRoles] = useState(false);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);

  const [isSubmittingBandRole, setIsSubmittingBandRole] = useState(false);
  const [isSubmittingRigSystem, setIsSubmittingRigSystem] = useState(false);
  const [isSubmittingCrewRole, setIsSubmittingCrewRole] = useState(false);
  const [isSubmittingPedal, setIsSubmittingPedal] = useState(false);
  const [isSubmittingMetrics, setIsSubmittingMetrics] = useState(false);

  const [deletingBandRoleId, setDeletingBandRoleId] = useState<string | null>(null);
  const [deletingRigSystemId, setDeletingRigSystemId] = useState<string | null>(null);
  const [deletingCrewRoleId, setDeletingCrewRoleId] = useState<string | null>(null);
  const [deletingPedalId, setDeletingPedalId] = useState<string | null>(null);

  const bandRoleForm = useForm<StageBandRoleFormValues>({
    resolver: zodResolver(bandRoleSchema),
    defaultValues: defaultBandRoleValues,
  });

  const rigSystemForm = useForm<StageRigSystemFormValues>({
    resolver: zodResolver(rigSystemSchema),
    defaultValues: defaultRigSystemValues,
  });

  const crewRoleForm = useForm<StageCrewRoleFormValues>({
    resolver: zodResolver(crewRoleSchema),
    defaultValues: defaultCrewRoleValues,
  });

  const pedalboardForm = useForm<StagePedalboardFormValues>({
    resolver: zodResolver(pedalboardItemSchema),
    defaultValues: defaultPedalboardValues,
  });

  const metricsForm = useForm<StageMetricsFormValues>({
    resolver: zodResolver(metricsSchema),
    defaultValues: defaultMetricsValues,
  });

  const loadBandRoles = useCallback(async () => {
    setIsLoadingBandRoles(true);
    try {
      const data = await fetchStageBandRolesWithPedals();
      setBandRoles(data);
    } catch (error) {
      console.error("Failed to load band roles", error);
      toast({
        variant: "destructive",
        title: "Unable to load band equipment",
        description: "Please try again later.",
      });
    } finally {
      setIsLoadingBandRoles(false);
    }
  }, [toast]);

  const loadRigSystems = useCallback(async () => {
    setIsLoadingRigSystems(true);
    try {
      const data = await fetchStageRigSystems();
      setRigSystems(data);
    } catch (error) {
      console.error("Failed to load rig systems", error);
      toast({
        variant: "destructive",
        title: "Unable to load rig systems",
        description: "Please try again later.",
      });
    } finally {
      setIsLoadingRigSystems(false);
    }
  }, [toast]);

  const loadCrewRoles = useCallback(async () => {
    setIsLoadingCrewRoles(true);
    try {
      const data = await fetchStageCrewRoles();
      setCrewRoles(data);
    } catch (error) {
      console.error("Failed to load crew roles", error);
      toast({
        variant: "destructive",
        title: "Unable to load crew roles",
        description: "Please try again later.",
      });
    } finally {
      setIsLoadingCrewRoles(false);
    }
  }, [toast]);

  const loadMetrics = useCallback(async () => {
    setIsLoadingMetrics(true);
    try {
      const data = await fetchStageSetupMetrics();
      setMetrics(data);
    } catch (error) {
      console.error("Failed to load stage metrics", error);
      toast({
        variant: "destructive",
        title: "Unable to load stage metrics",
        description: "Please try again later.",
      });
    } finally {
      setIsLoadingMetrics(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadBandRoles();
    void loadRigSystems();
    void loadCrewRoles();
    void loadMetrics();
  }, [loadBandRoles, loadRigSystems, loadCrewRoles, loadMetrics]);

  useEffect(() => {
    if (!bandRoles.length) {
      setSelectedRoleId(null);
      return;
    }

    if (!selectedRoleId || !bandRoles.some((role) => role.id === selectedRoleId)) {
      setSelectedRoleId(bandRoles[0]?.id ?? null);
    }
  }, [bandRoles, selectedRoleId]);

  useEffect(() => {
    if (metrics) {
      metricsForm.reset({
        rating: metrics.rating ?? 0,
        maxRating: metrics.max_rating ?? 1,
        currentWattage: metrics.current_wattage ?? undefined,
        maxDb: metrics.max_db ?? undefined,
      });
    } else {
      metricsForm.reset(defaultMetricsValues);
    }
  }, [metrics, metricsForm]);

  const selectedBandRole = useMemo(
    () => bandRoles.find((role) => role.id === selectedRoleId) ?? null,
    [bandRoles, selectedRoleId],
  );

  const handleRefreshAll = useCallback(async () => {
    setIsRefreshingAll(true);
    await Promise.all([loadBandRoles(), loadRigSystems(), loadCrewRoles(), loadMetrics()]);
    setIsRefreshingAll(false);
  }, [loadBandRoles, loadRigSystems, loadCrewRoles, loadMetrics]);

  const resetBandRoleForm = useCallback(() => {
    bandRoleForm.reset(defaultBandRoleValues);
    setEditingBandRole(null);
  }, [bandRoleForm]);

  const resetRigSystemForm = useCallback(() => {
    rigSystemForm.reset(defaultRigSystemValues);
    setEditingRigSystem(null);
  }, [rigSystemForm]);

  const resetCrewRoleForm = useCallback(() => {
    crewRoleForm.reset(defaultCrewRoleValues);
    setEditingCrewRole(null);
  }, [crewRoleForm]);

  const resetPedalboardForm = useCallback(() => {
    pedalboardForm.reset(defaultPedalboardValues);
    setEditingPedalboardItem(null);
  }, [pedalboardForm]);

  const handleSubmitBandRole = useCallback(
    async (values: StageBandRoleFormValues) => {
      setIsSubmittingBandRole(true);
      try {
        const payload = {
          role: values.role,
          instrument: values.instrument,
          amps: multilineToArray(values.amps ?? ""),
          monitors: multilineToArray(values.monitors ?? ""),
          notes: multilineToArray(values.notes ?? ""),
        };

        if (editingBandRole) {
          await updateStageBandRole(editingBandRole.id, payload);
          toast({ title: "Band role updated" });
        } else {
          await createStageBandRole(payload);
          toast({ title: "Band role created" });
        }

        await loadBandRoles();
        resetBandRoleForm();
      } catch (error) {
        console.error("Failed to save band role", error);
        toast({
          variant: "destructive",
          title: "Unable to save band role",
          description: "Please review the form and try again.",
        });
      } finally {
        setIsSubmittingBandRole(false);
      }
    },
    [editingBandRole, loadBandRoles, resetBandRoleForm, toast],
  );

  const handleSubmitRigSystem = useCallback(
    async (values: StageRigSystemFormValues) => {
      setIsSubmittingRigSystem(true);
      try {
        const payload = {
          system: values.system,
          status: values.status,
          coverage: values.coverage?.trim() ? values.coverage.trim() : null,
          details: multilineToArray(values.details ?? ""),
        };

        if (editingRigSystem) {
          await updateStageRigSystem(editingRigSystem.id, payload);
          toast({ title: "Rig system updated" });
        } else {
          await createStageRigSystem(payload);
          toast({ title: "Rig system created" });
        }

        await loadRigSystems();
        resetRigSystemForm();
      } catch (error) {
        console.error("Failed to save rig system", error);
        toast({
          variant: "destructive",
          title: "Unable to save rig system",
          description: "Please review the form and try again.",
        });
      } finally {
        setIsSubmittingRigSystem(false);
      }
    },
    [editingRigSystem, loadRigSystems, resetRigSystemForm, toast],
  );

  const handleSubmitCrewRole = useCallback(
    async (values: StageCrewRoleFormValues) => {
      setIsSubmittingCrewRole(true);
      try {
        const payload = {
          specialty: values.specialty,
          headcount: values.headcount,
          responsibilities: values.responsibilities?.trim() ? values.responsibilities.trim() : null,
          skill: values.skill,
        };

        if (editingCrewRole) {
          await updateStageCrewRole(editingCrewRole.id, payload);
          toast({ title: "Crew role updated" });
        } else {
          await createStageCrewRole(payload);
          toast({ title: "Crew role created" });
        }

        await loadCrewRoles();
        resetCrewRoleForm();
      } catch (error) {
        console.error("Failed to save crew role", error);
        toast({
          variant: "destructive",
          title: "Unable to save crew role",
          description: "Please review the form and try again.",
        });
      } finally {
        setIsSubmittingCrewRole(false);
      }
    },
    [editingCrewRole, loadCrewRoles, resetCrewRoleForm, toast],
  );

  const handleSubmitPedalboardItem = useCallback(
    async (values: StagePedalboardFormValues) => {
      if (!selectedBandRole) {
        toast({
          variant: "destructive",
          title: "Select a band role",
          description: "Choose a band role to manage pedalboard items.",
        });
        return;
      }

      setIsSubmittingPedal(true);
      try {
        const payload = {
          band_role_id: selectedBandRole.id,
          position: values.position,
          pedal: values.pedal,
          notes: values.notes?.trim() ? values.notes.trim() : null,
          power_draw: values.powerDraw?.trim() ? values.powerDraw.trim() : null,
        };

        if (editingPedalboardItem) {
          await updateStagePedalboardItem(editingPedalboardItem.id, payload);
          toast({ title: "Pedalboard item updated" });
        } else {
          await createStagePedalboardItem(payload);
          toast({ title: "Pedalboard item added" });
        }

        await loadBandRoles();
        resetPedalboardForm();
      } catch (error) {
        console.error("Failed to save pedalboard item", error);
        toast({
          variant: "destructive",
          title: "Unable to save pedalboard item",
          description: "Please review the form and try again.",
        });
      } finally {
        setIsSubmittingPedal(false);
      }
    },
    [editingPedalboardItem, loadBandRoles, resetPedalboardForm, selectedBandRole, toast],
  );

  const handleSubmitMetrics = useCallback(
    async (values: StageMetricsFormValues) => {
      setIsSubmittingMetrics(true);
      try {
        const payload = {
          rating: values.rating,
          max_rating: values.maxRating,
          current_wattage: values.currentWattage ?? null,
          max_db: values.maxDb ?? null,
        };

        await saveStageSetupMetrics(payload, metrics?.id);
        toast({ title: "Stage metrics saved" });
        await loadMetrics();
      } catch (error) {
        console.error("Failed to save stage metrics", error);
        toast({
          variant: "destructive",
          title: "Unable to save stage metrics",
          description: "Please review the form and try again.",
        });
      } finally {
        setIsSubmittingMetrics(false);
      }
    },
    [loadMetrics, metrics?.id, toast],
  );

  const handleEditBandRole = useCallback(
    (role: StageBandRoleWithPedals) => {
      setEditingBandRole(role);
      bandRoleForm.reset({
        role: role.role ?? "",
        instrument: role.instrument ?? "",
        amps: arrayToMultiline(role.amps),
        monitors: arrayToMultiline(role.monitors),
        notes: arrayToMultiline(role.notes),
      });
    },
    [bandRoleForm],
  );

  const handleEditRigSystem = useCallback(
    (system: StageRigSystemRow) => {
      setEditingRigSystem(system);
      rigSystemForm.reset({
        system: system.system ?? "",
        status: system.status ?? "",
        coverage: system.coverage ?? "",
        details: arrayToMultiline(system.details),
      });
    },
    [rigSystemForm],
  );

  const handleEditCrewRole = useCallback(
    (role: StageCrewRoleRow) => {
      setEditingCrewRole(role);
      crewRoleForm.reset({
        specialty: role.specialty ?? "",
        headcount: role.headcount ?? 1,
        responsibilities: role.responsibilities ?? "",
        skill: role.skill ?? 0,
      });
    },
    [crewRoleForm],
  );

  const handleEditPedalboardItem = useCallback(
    (item: StagePedalboardItemRow) => {
      setEditingPedalboardItem(item);
      pedalboardForm.reset({
        position: item.position ?? 1,
        pedal: item.pedal ?? "",
        notes: item.notes ?? "",
        powerDraw: item.power_draw ?? "",
      });
    },
    [pedalboardForm],
  );

  const handleDeleteBandRole = useCallback(
    async (id: string) => {
      setDeletingBandRoleId(id);
      try {
        await deleteStageBandRole(id);
        toast({ title: "Band role removed" });
        await loadBandRoles();
      } catch (error) {
        console.error("Failed to delete band role", error);
        toast({
          variant: "destructive",
          title: "Unable to delete band role",
          description: "Please try again later.",
        });
      } finally {
        setDeletingBandRoleId(null);
      }
    },
    [loadBandRoles, toast],
  );

  const handleDeleteRigSystem = useCallback(
    async (id: string) => {
      setDeletingRigSystemId(id);
      try {
        await deleteStageRigSystem(id);
        toast({ title: "Rig system removed" });
        await loadRigSystems();
      } catch (error) {
        console.error("Failed to delete rig system", error);
        toast({
          variant: "destructive",
          title: "Unable to delete rig system",
          description: "Please try again later.",
        });
      } finally {
        setDeletingRigSystemId(null);
      }
    },
    [loadRigSystems, toast],
  );

  const handleDeleteCrewRole = useCallback(
    async (id: string) => {
      setDeletingCrewRoleId(id);
      try {
        await deleteStageCrewRole(id);
        toast({ title: "Crew role removed" });
        await loadCrewRoles();
      } catch (error) {
        console.error("Failed to delete crew role", error);
        toast({
          variant: "destructive",
          title: "Unable to delete crew role",
          description: "Please try again later.",
        });
      } finally {
        setDeletingCrewRoleId(null);
      }
    },
    [loadCrewRoles, toast],
  );

  const handleDeletePedalboardItem = useCallback(
    async (id: string) => {
      setDeletingPedalId(id);
      try {
        await deleteStagePedalboardItem(id);
        toast({ title: "Pedalboard item removed" });
        await loadBandRoles();
      } catch (error) {
        console.error("Failed to delete pedalboard item", error);
        toast({
          variant: "destructive",
          title: "Unable to delete pedalboard item",
          description: "Please try again later.",
        });
      } finally {
        setDeletingPedalId(null);
      }
    },
    [loadBandRoles, toast],
  );

  const handleSelectBandRole = useCallback(
    (id: string) => {
      setSelectedRoleId(id);
      resetPedalboardForm();
    },
    [resetPedalboardForm],
  );

  return (
    <AdminRoute>
      <div className="container mx-auto space-y-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Stage Setup Admin</h1>
            <p className="text-muted-foreground">
              Manage the equipment, rig systems, crew specialists, and overall metrics powering the Stage
              Setup overview.
            </p>
          </div>
          <Button variant="outline" onClick={() => void handleRefreshAll()} disabled={isRefreshingAll}>
            {isRefreshingAll ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Refreshing
              </>
            ) : (
              <>
                <RefreshCcw className="mr-2 h-4 w-4" /> Refresh Data
              </>
            )}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Stage Metrics</CardTitle>
            <CardDescription>Control the readiness snapshot surfaced on the public Stage Setup page.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...metricsForm}>
              <form onSubmit={metricsForm.handleSubmit(handleSubmitMetrics)} className="grid gap-4 md:grid-cols-4">
                <FormField
                  control={metricsForm.control}
                  name="rating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rating</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={metricsForm.control}
                  name="maxRating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Rating</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={metricsForm.control}
                  name="currentWattage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Wattage</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          value={field.value ?? ""}
                          onChange={(event) => field.onChange(event.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={metricsForm.control}
                  name="maxDb"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max dB</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          value={field.value ?? ""}
                          onChange={(event) => field.onChange(event.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="md:col-span-4 flex justify-end">
                  <Button type="submit" disabled={isSubmittingMetrics || isLoadingMetrics}>
                    {isSubmittingMetrics ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving
                      </>
                    ) : (
                      "Save Metrics"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Band Equipment</CardTitle>
              <CardDescription>Define each role's instrumentation, monitoring, and quick-reference notes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Form {...bandRoleForm}>
                <form onSubmit={bandRoleForm.handleSubmit(handleSubmitBandRole)} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={bandRoleForm.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role</FormLabel>
                          <FormControl>
                            <Input placeholder="Lead Guitar" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={bandRoleForm.control}
                      name="instrument"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary Instrument</FormLabel>
                          <FormControl>
                            <Input placeholder="PRS Custom 24" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={bandRoleForm.control}
                    name="amps"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amplification (one per line)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Mesa Boogie Mark V:35 Head" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={bandRoleForm.control}
                    name="monitors"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monitoring (one per line)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="IEM Mix A - Guitars focus" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={bandRoleForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quick Notes (one per line)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Backup guitar side-stage" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-between gap-2">
                    {editingBandRole ? (
                      <Button type="button" variant="outline" onClick={resetBandRoleForm}>
                        Cancel Edit
                      </Button>
                    ) : (
                      <div />
                    )}
                    <Button type="submit" disabled={isSubmittingBandRole}>
                      {isSubmittingBandRole ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving
                        </>
                      ) : editingBandRole ? (
                        "Update Role"
                      ) : (
                        "Add Role"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role</TableHead>
                      <TableHead>Instrument</TableHead>
                      <TableHead className="w-32 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingBandRoles ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center">
                          <div className="flex items-center justify-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading band roles...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : bandRoles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          No band roles configured yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      bandRoles.map((role) => (
                        <TableRow key={role.id} className={role.id === selectedRoleId ? "bg-muted/30" : undefined}>
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => handleSelectBandRole(role.id)}
                              className="text-left font-medium hover:underline"
                            >
                              {role.role}
                            </button>
                          </TableCell>
                          <TableCell>{role.instrument}</TableCell>
                          <TableCell className="flex justify-end gap-2">
                            <Button variant="outline" size="icon" onClick={() => handleEditBandRole(role)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => void handleDeleteBandRole(role.id)}
                              disabled={deletingBandRoleId === role.id}
                            >
                              {deletingBandRoleId === role.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pedalboards</CardTitle>
              <CardDescription>Manage pedal chains for the selected band role.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Active role:</span>
                <div className="flex flex-wrap gap-2">
                  {bandRoles.map((role) => (
                    <Button
                      key={role.id}
                      variant={selectedRoleId === role.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleSelectBandRole(role.id)}
                    >
                      {role.role}
                    </Button>
                  ))}
                </div>
              </div>

              <Form {...pedalboardForm}>
                <form onSubmit={pedalboardForm.handleSubmit(handleSubmitPedalboardItem)} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={pedalboardForm.control}
                      name="position"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Position</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={pedalboardForm.control}
                      name="pedal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pedal</FormLabel>
                          <FormControl>
                            <Input placeholder="Strymon Timeline" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={pedalboardForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Dual delay presets" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={pedalboardForm.control}
                    name="powerDraw"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Power Draw</FormLabel>
                        <FormControl>
                          <Input placeholder="250 mA" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-between gap-2">
                    {editingPedalboardItem ? (
                      <Button type="button" variant="outline" onClick={resetPedalboardForm}>
                        Cancel Edit
                      </Button>
                    ) : (
                      <div />
                    )}
                    <Button type="submit" disabled={isSubmittingPedal}>
                      {isSubmittingPedal ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving
                        </>
                      ) : editingPedalboardItem ? (
                        "Update Pedal"
                      ) : (
                        "Add Pedal"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Pos</TableHead>
                      <TableHead>Pedal</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Power</TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!selectedBandRole ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Select a band role to manage its pedalboard.
                        </TableCell>
                      </TableRow>
                    ) : selectedBandRole.pedalboard.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No pedalboard items configured.
                        </TableCell>
                      </TableRow>
                    ) : (
                      selectedBandRole.pedalboard.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.position}</TableCell>
                          <TableCell className="font-medium">{item.pedal}</TableCell>
                          <TableCell>{item.notes ?? "—"}</TableCell>
                          <TableCell>{item.power_draw ?? "—"}</TableCell>
                          <TableCell className="flex justify-end gap-2">
                            <Button variant="outline" size="icon" onClick={() => handleEditPedalboardItem(item)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => void handleDeletePedalboardItem(item.id)}
                              disabled={deletingPedalId === item.id}
                            >
                              {deletingPedalId === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Rig Systems</CardTitle>
              <CardDescription>Track the macro production systems keeping the show running.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Form {...rigSystemForm}>
                <form onSubmit={rigSystemForm.handleSubmit(handleSubmitRigSystem)} className="space-y-4">
                  <FormField
                    control={rigSystemForm.control}
                    name="system"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>System</FormLabel>
                        <FormControl>
                          <Input placeholder="Speaker Stacks" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={rigSystemForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <FormControl>
                          <Input placeholder="Deployed" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={rigSystemForm.control}
                    name="coverage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Coverage</FormLabel>
                        <FormControl>
                          <Input placeholder="120° arena coverage" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={rigSystemForm.control}
                    name="details"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Details (one per line)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="L-Acoustics Kara line arrays" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-between gap-2">
                    {editingRigSystem ? (
                      <Button type="button" variant="outline" onClick={resetRigSystemForm}>
                        Cancel Edit
                      </Button>
                    ) : (
                      <div />
                    )}
                    <Button type="submit" disabled={isSubmittingRigSystem}>
                      {isSubmittingRigSystem ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving
                        </>
                      ) : editingRigSystem ? (
                        "Update System"
                      ) : (
                        "Add System"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>System</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Coverage</TableHead>
                      <TableHead className="w-32 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingRigSystems ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center">
                          <div className="flex items-center justify-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading rig systems...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : rigSystems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No rig systems configured yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rigSystems.map((system) => (
                        <TableRow key={system.id}>
                          <TableCell className="font-medium">{system.system}</TableCell>
                          <TableCell>{system.status}</TableCell>
                          <TableCell>{system.coverage ?? "—"}</TableCell>
                          <TableCell className="flex justify-end gap-2">
                            <Button variant="outline" size="icon" onClick={() => handleEditRigSystem(system)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => void handleDeleteRigSystem(system.id)}
                              disabled={deletingRigSystemId === system.id}
                            >
                              {deletingRigSystemId === system.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stage Crew</CardTitle>
              <CardDescription>Maintain headcounts, responsibilities, and readiness scores for crew specialists.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Form {...crewRoleForm}>
                <form onSubmit={crewRoleForm.handleSubmit(handleSubmitCrewRole)} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={crewRoleForm.control}
                      name="specialty"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Specialty</FormLabel>
                          <FormControl>
                            <Input placeholder="Stage Manager" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={crewRoleForm.control}
                      name="headcount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Headcount</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={crewRoleForm.control}
                    name="responsibilities"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Responsibilities</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Calls cues, coordinates load-in/out" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={crewRoleForm.control}
                    name="skill"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Skill Readiness</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} max={100} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-between gap-2">
                    {editingCrewRole ? (
                      <Button type="button" variant="outline" onClick={resetCrewRoleForm}>
                        Cancel Edit
                      </Button>
                    ) : (
                      <div />
                    )}
                    <Button type="submit" disabled={isSubmittingCrewRole}>
                      {isSubmittingCrewRole ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving
                        </>
                      ) : editingCrewRole ? (
                        "Update Crew Role"
                      ) : (
                        "Add Crew Role"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Specialty</TableHead>
                      <TableHead className="w-24">Headcount</TableHead>
                      <TableHead>Responsibilities</TableHead>
                      <TableHead className="w-32">Skill</TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingCrewRoles ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center">
                          <div className="flex items-center justify-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading crew roles...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : crewRoles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No crew roles configured yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      crewRoles.map((role) => (
                        <TableRow key={role.id}>
                          <TableCell className="font-medium">{role.specialty}</TableCell>
                          <TableCell>{role.headcount}</TableCell>
                          <TableCell>{role.responsibilities ?? "—"}</TableCell>
                          <TableCell>{role.skill} / 100</TableCell>
                          <TableCell className="flex justify-end gap-2">
                            <Button variant="outline" size="icon" onClick={() => handleEditCrewRole(role)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => void handleDeleteCrewRole(role.id)}
                              disabled={deletingCrewRoleId === role.id}
                            >
                              {deletingCrewRoleId === role.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminRoute>
  );
}
