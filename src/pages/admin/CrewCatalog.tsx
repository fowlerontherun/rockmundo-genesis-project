import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { AdminRoute } from "@/components/AdminRoute";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  assignmentHighlights,
  CREW_DISCIPLINES,
  CrewAssignment,
  CrewCatalogItem,
  CrewDiscipline,
  CrewMorale,
  DISCIPLINE_DEFAULTS,
  formatCrewCurrency as formatCurrency,
  moraleBadgeVariant,
  moraleLabelMap,
} from "@/features/band-crew/catalog";
import { useBandCrewCatalog } from "@/features/band-crew/catalog-context";

interface CrewFormValues {
  name: string;
  role: CrewDiscipline;
  headline: string;
  background: string;
  skill: number;
  salary: number;
  experience: number;
  morale: CrewMorale;
  loyalty: number;
  assignment: CrewAssignment;
  focus: string;
  specialties: string;
  traits: string;
  openings: number;
}

const DEFAULT_FORM_VALUES: CrewFormValues = {
  name: "",
  role: CREW_DISCIPLINES[0],
  headline: "",
  background: "",
  skill: 75,
  salary: 2500,
  experience: 5,
  morale: "steady",
  loyalty: 70,
  assignment: DISCIPLINE_DEFAULTS[CREW_DISCIPLINES[0]].assignment,
  focus: DISCIPLINE_DEFAULTS[CREW_DISCIPLINES[0]].focus,
  specialties: DISCIPLINE_DEFAULTS[CREW_DISCIPLINES[0]].specialties.join("\n"),
  traits: DISCIPLINE_DEFAULTS[CREW_DISCIPLINES[0]].traits.join(", "),
  openings: 1,
};

const parseList = (value: string) => value.split(/\n|,/).map((entry) => entry.trim()).filter(Boolean);

const CrewCatalogAdmin = () => {
  const { catalog, setCatalog } = useBandCrewCatalog();
  const [editingCrewId, setEditingCrewId] = useState<string | null>(null);
  const crewForm = useForm<CrewFormValues>({
    defaultValues: DEFAULT_FORM_VALUES,
  });

  const sortedCatalog = useMemo(
    () =>
      [...catalog].sort((a, b) => {
        const roleCompare = a.role.localeCompare(b.role);
        if (roleCompare !== 0) return roleCompare;
        return a.name.localeCompare(b.name);
      }),
    [catalog],
  );

  const summary = useMemo(() => {
    if (catalog.length === 0) {
      return { avgSkill: 0, avgSalary: 0, totalOpenings: 0 };
    }
    const totals = catalog.reduce(
      (acc, crew) => {
        acc.skill += crew.skill;
        acc.salary += crew.salary;
        acc.openings += crew.openings;
        return acc;
      },
      { skill: 0, salary: 0, openings: 0 },
    );
    return {
      avgSkill: Math.round(totals.skill / catalog.length),
      avgSalary: Math.round(totals.salary / catalog.length),
      totalOpenings: totals.openings,
    };
  }, [catalog]);

  const applyRoleDefaults = (role: CrewDiscipline) => {
    const defaults = DISCIPLINE_DEFAULTS[role];
    crewForm.setValue("assignment", defaults.assignment);
    crewForm.setValue("focus", defaults.focus);
    crewForm.setValue("specialties", defaults.specialties.join("\n"));
    crewForm.setValue("traits", defaults.traits.join(", "));
  };

  const beginEditCrew = (crewId: string) => {
    const crew = catalog.find((item) => item.id === crewId);
    if (!crew) return;
    setEditingCrewId(crew.id);
    crewForm.reset({
      name: crew.name,
      role: crew.role,
      headline: crew.headline,
      background: crew.background,
      skill: crew.skill,
      salary: crew.salary,
      experience: crew.experience,
      morale: crew.morale,
      loyalty: crew.loyalty,
      assignment: crew.assignment,
      focus: crew.focus,
      specialties: crew.specialties.join("\n"),
      traits: crew.traits.join(", "),
      openings: crew.openings,
    });
  };

  const cancelEditCrew = () => {
    setEditingCrewId(null);
    crewForm.reset(DEFAULT_FORM_VALUES);
  };

  const handleRemoveCrew = (crewId: string) => {
    const crew = catalog.find((item) => item.id === crewId);
    if (!crew) return;
    const confirmed =
      typeof window === "undefined"
        ? true
        : window.confirm(`Remove ${crew.name} from the hiring catalog? They will no longer appear in band recruitment.`);
    if (!confirmed) return;

    setCatalog((prev) => prev.filter((item) => item.id !== crewId));
    toast.success(`${crew.name} removed from the hiring catalog`);
    if (editingCrewId === crewId) {
      cancelEditCrew();
    }
  };

  const handleSubmit = crewForm.handleSubmit((values) => {
    const baseCrew: CrewCatalogItem = {
      id: editingCrewId ?? `crew-${Math.random().toString(36).slice(2, 10)}`,
      name: values.name.trim(),
      role: values.role,
      headline: values.headline.trim(),
      background: values.background.trim(),
      skill: Math.max(0, Math.min(100, Number(values.skill) || 0)),
      salary: Number(values.salary) || 0,
      experience: Math.max(0, Number(values.experience) || 0),
      morale: values.morale,
      loyalty: Math.max(0, Math.min(100, Number(values.loyalty) || 0)),
      assignment: values.assignment,
      focus: values.focus.trim(),
      specialties: parseList(values.specialties),
      traits: parseList(values.traits),
      openings: Math.max(0, Number(values.openings) || 0),
    };

    if (editingCrewId) {
      setCatalog((prev) => prev.map((crew) => (crew.id === editingCrewId ? baseCrew : crew)));
      toast.success(`${baseCrew.name} updated`);
      cancelEditCrew();
    } else {
      setCatalog((prev) => [...prev, baseCrew]);
      toast.success(`${baseCrew.name} added to the catalog`);
      crewForm.reset(DEFAULT_FORM_VALUES);
      applyRoleDefaults(baseCrew.role);
    }
  });

  return (
    <AdminRoute>
      <div className="container mx-auto max-w-5xl space-y-6 p-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Crew Hiring Catalog</h1>
          <p className="text-muted-foreground">
            Manage the roster of professionals available for bands to recruit. Tune morale, salary, and specialties to shape the
            in-game job market.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Catalog health</CardTitle>
            <CardDescription>Monitor the overall strength and availability of the hiring pool.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Active candidates</p>
              <p className="text-2xl font-semibold text-foreground">{catalog.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Average skill</p>
              <p className="text-2xl font-semibold text-foreground">{summary.avgSkill}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Open roles</p>
              <p className="text-2xl font-semibold text-foreground">{summary.totalOpenings}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{editingCrewId ? "Edit crew member" : "Add crew member"}</CardTitle>
                <CardDescription>
                  Fill in the details that bands will see when recruiting road crew, production leads, and specialists.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => applyRoleDefaults(crewForm.getValues("role"))}
              >
                Apply role defaults
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="crew-name">Name</Label>
                <Input id="crew-name" placeholder="Full name" {...crewForm.register("name", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Controller
                  control={crewForm.control}
                  name="role"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value as CrewDiscipline);
                        applyRoleDefaults(value as CrewDiscipline);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {CREW_DISCIPLINES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crew-headline">Headline</Label>
                <Input
                  id="crew-headline"
                  placeholder="One-line summary that sells their experience"
                  {...crewForm.register("headline", { required: true })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="crew-background">Background</Label>
                <Textarea
                  id="crew-background"
                  placeholder="Detailed background and accomplishments"
                  className="min-h-[120px]"
                  {...crewForm.register("background", { required: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crew-skill">Skill (0-100)</Label>
                <Input id="crew-skill" type="number" min={0} max={100} {...crewForm.register("skill", { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crew-salary">Salary per gig</Label>
                <Input id="crew-salary" type="number" min={0} step={100} {...crewForm.register("salary", { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crew-experience">Experience (years)</Label>
                <Input id="crew-experience" type="number" min={0} {...crewForm.register("experience", { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>Morale</Label>
                <Controller
                  control={crewForm.control}
                  name="morale"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select morale" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(moraleLabelMap).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crew-loyalty">Loyalty (0-100)</Label>
                <Input id="crew-loyalty" type="number" min={0} max={100} {...crewForm.register("loyalty", { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>Primary assignment</Label>
                <Controller
                  control={crewForm.control}
                  name="assignment"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select assignment" />
                      </SelectTrigger>
                      <SelectContent>
                        {(["Touring", "Studio", "Production", "Standby"] as CrewAssignment[]).map((assignment) => (
                          <SelectItem key={assignment} value={assignment}>
                            {assignment}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crew-focus">Focus</Label>
                <Input id="crew-focus" placeholder="Primary expertise" {...crewForm.register("focus", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crew-specialties">Specialties (one per line)</Label>
                <Textarea id="crew-specialties" className="min-h-[100px]" {...crewForm.register("specialties")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crew-traits">Traits (comma or newline separated)</Label>
                <Textarea id="crew-traits" className="min-h-[100px]" {...crewForm.register("traits")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crew-openings">Openings</Label>
                <Input id="crew-openings" type="number" min={0} {...crewForm.register("openings", { valueAsNumber: true })} />
              </div>
              <div className="md:col-span-2 flex flex-wrap items-center gap-2">
                <Button type="submit" className="w-full md:w-auto">
                  {editingCrewId ? "Update crew member" : "Add crew member"}
                </Button>
                {editingCrewId && (
                  <Button type="button" variant="outline" onClick={cancelEditCrew}>
                    Cancel edit
                  </Button>
                )}
              </div>
            </form>

            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Current catalog</h2>
                <p className="text-sm text-muted-foreground">Candidates available for bands to hire.</p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role & Focus</TableHead>
                      <TableHead className="max-w-xs">Highlights</TableHead>
                      <TableHead className="text-right">Compensation</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedCatalog.map((crew) => (
                      <TableRow key={crew.id} className={editingCrewId === crew.id ? "bg-muted/50" : undefined}>
                        <TableCell>
                          <div className="font-medium text-foreground">{crew.name}</div>
                          <div className="text-xs text-muted-foreground">{crew.headline}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-semibold text-foreground">{crew.role}</div>
                          <div className="text-xs text-muted-foreground">{crew.focus}</div>
                          <Badge className="mt-1" variant={moraleBadgeVariant[crew.morale]}>
                            {moraleLabelMap[crew.morale]}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-sm text-sm text-muted-foreground">
                          <p>{assignmentHighlights[crew.assignment]}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {crew.specialties.slice(0, 3).map((specialty) => (
                              <Badge key={specialty} variant="outline">
                                {specialty}
                              </Badge>
                            ))}
                            {crew.specialties.length > 3 && <Badge variant="outline">+{crew.specialties.length - 3}</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <div className="font-semibold text-foreground">{formatCurrency(crew.salary)}</div>
                          <div className="text-muted-foreground">{crew.openings} openings</div>
                          <div className="text-xs text-muted-foreground">Skill {crew.skill}/100 • Loyalty {crew.loyalty}/100</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => beginEditCrew(crew.id)}>
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleRemoveCrew(crew.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {sortedCatalog.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                          No crew available yet. Add candidates so bands have talent to recruit.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminRoute>
  );
};

export default CrewCatalogAdmin;
