import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import {
  fetchStageBandRolesWithPedals,
  fetchStageCrewRoles,
  fetchStageRigSystems,
  fetchStageSetupMetrics,
} from "./admin/stageSetup.helpers";

type BandMember = {
  id: string;
  role: string;
  instrument: string;
  pedalboard: {
    id: string;
    position: number;
    pedal: string;
    notes: string | null;
    powerDraw: string | null;
  }[];
  amps: string[];
  monitors: string[];
  notes: string[];
};

type RigSystem = {
  id: string;
  system: string;
  status: string;
  coverage: string | null;
  details: string[];
};

type CrewRole = {
  id: string;
  specialty: string;
  headcount: number;
  responsibilities: string | null;
  skill: number;
};

type StageMetrics = {
  rating: number;
  maxRating: number;
  currentWattage: number | null;
  maxDb: number | null;
};

const defaultMetrics: StageMetrics = {
  rating: 0,
  maxRating: 100,
  currentWattage: null,
  maxDb: null,
};

const StageSetup = () => {
  const [bandMembers, setBandMembers] = useState<BandMember[]>([]);
  const [rigSystems, setRigSystems] = useState<RigSystem[]>([]);
  const [stageCrew, setStageCrew] = useState<CrewRole[]>([]);
  const [stageMetrics, setStageMetrics] = useState<StageMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStageSetup = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [metricsData, bandData, rigData, crewData] = await Promise.all([
          fetchStageSetupMetrics(),
          fetchStageBandRolesWithPedals(),
          fetchStageRigSystems(),
          fetchStageCrewRoles(),
        ]);

        const normalizedBandMembers: BandMember[] = bandData.map((role) => ({
          id: role.id,
          role: role.role,
          instrument: role.instrument,
          pedalboard: [...role.pedalboard]
            .sort((a, b) => a.position - b.position)
            .map((item) => ({
              id: item.id,
              position: item.position,
              pedal: item.pedal,
              notes: item.notes,
              powerDraw: item.power_draw,
            })),
          amps: role.amps ?? [],
          monitors: role.monitors ?? [],
          notes: role.notes ?? [],
        }));

        const normalizedRigSystems: RigSystem[] = rigData.map((system) => ({
          id: system.id,
          system: system.system,
          status: system.status,
          coverage: system.coverage ?? null,
          details: system.details ?? [],
        }));

        const normalizedCrew: CrewRole[] = crewData.map((crew) => ({
          id: crew.id,
          specialty: crew.specialty,
          headcount: crew.headcount,
          responsibilities: crew.responsibilities ?? null,
          skill: crew.skill,
        }));

        const normalizedMetrics: StageMetrics | null = metricsData
          ? {
              rating: metricsData.rating ?? 0,
              maxRating: metricsData.max_rating ?? 0,
              currentWattage: metricsData.current_wattage ?? null,
              maxDb: metricsData.max_db ?? null,
            }
          : null;

        setBandMembers(normalizedBandMembers);
        setRigSystems(normalizedRigSystems);
        setStageCrew(normalizedCrew);
        setStageMetrics(normalizedMetrics);
      } catch (loadError) {
        console.error("Failed to load stage setup", loadError);
        setError("We couldn't load the stage setup information right now. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadStageSetup();
  }, []);

  const metrics = useMemo(() => stageMetrics ?? defaultMetrics, [stageMetrics]);
  const readinessProgress = metrics.maxRating > 0 ? Math.min((metrics.rating / metrics.maxRating) * 100, 100) : 0;

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading stage setup...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-3xl space-y-4 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Stage Setup</CardTitle>
            <CardDescription>Comprehensive snapshot of the live rig and crew readiness.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Stage Setup</h1>
        <p className="text-muted-foreground">Comprehensive snapshot of the live rig and crew readiness.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Stage Readiness Metrics</CardTitle>
            <CardDescription>Soundcheck performance and output overview.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Performance Rating</span>
                <span>
                  {metrics.rating} / {metrics.maxRating || "—"}
                </span>
              </div>
              <Progress value={readinessProgress} className="h-2" />
            </div>
            <div className="flex flex-wrap gap-2">
              {typeof metrics.currentWattage === "number" ? (
                <Badge variant="secondary">{metrics.currentWattage} W Output</Badge>
              ) : null}
              {typeof metrics.maxDb === "number" ? (
                <Badge variant="outline">Peak {metrics.maxDb} dB</Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Full Band Rig</CardTitle>
            <CardDescription>Shared production assets covering the stage environment.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {rigSystems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No rig systems are currently configured. Check back after the production team sets them up.
                </p>
              ) : (
                rigSystems.map((system) => (
                  <div key={system.id} className="rounded-lg border border-border/60 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold">{system.system}</h3>
                      {system.details[0] ? (
                        <p className="text-sm text-muted-foreground">{system.details[0]}</p>
                      ) : null}
                    </div>
                    <Badge variant="secondary" className="whitespace-nowrap">
                      {system.status}
                    </Badge>
                  </div>
                  <Badge variant="outline" className="whitespace-nowrap">
                    {system.coverage ?? "Coverage details coming soon"}
                  </Badge>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                    {system.details.length > 0 ? (
                      system.details.map((detail) => <li key={detail}>{detail}</li>)
                    ) : (
                      <li>No additional system details provided yet.</li>
                    )}
                  </ul>
                </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Band Members &amp; Rigs</CardTitle>
            <CardDescription>Role-specific setups prepared for the show.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {bandMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Band equipment has not been configured yet. Once the production team adds roles, their rigs
                will appear here.
              </p>
            ) : (
              bandMembers.map((member, index) => (
              <div key={member.role} className="space-y-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">{member.role}</h3>
                    <p className="text-sm text-muted-foreground">Primary Instrument: {member.instrument}</p>
                  </div>
                  <Badge variant="outline" className="w-fit">
                    {member.instrument}
                  </Badge>
                </div>

                {member.pedalboard && member.pedalboard.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Pedalboard</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Pos</TableHead>
                          <TableHead>Pedal</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead className="w-28">Power</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {member.pedalboard.map((pedal) => (
                          <TableRow key={pedal.id}>
                            <TableCell>{pedal.position}</TableCell>
                            <TableCell className="font-medium">{pedal.pedal}</TableCell>
                            <TableCell>{pedal.notes ?? "—"}</TableCell>
                            <TableCell>{pedal.powerDraw ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No pedalboard requirements for this role.</p>
                )}

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground">Amplification</h4>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {member.amps.length > 0 ? (
                        member.amps.map((amp) => <li key={`${member.id}-amp-${amp}`}>{amp}</li>)
                      ) : (
                        <li>No amplification requirements listed.</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground">Monitoring</h4>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {member.monitors.length > 0 ? (
                        member.monitors.map((monitor) => <li key={`${member.id}-monitor-${monitor}`}>{monitor}</li>)
                      ) : (
                        <li>No monitoring notes provided.</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground">Quick Notes</h4>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {member.notes.length > 0 ? (
                        member.notes.map((note) => <li key={`${member.id}-note-${note}`}>{note}</li>)
                      ) : (
                        <li>No quick notes recorded.</li>
                      )}
                    </ul>
                  </div>
                </div>

                {index < bandMembers.length - 1 && <Separator />}
              </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stage Crew</CardTitle>
            <CardDescription>Specialists keeping the show running smoothly.</CardDescription>
          </CardHeader>
          <CardContent>
            {stageCrew.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Crew assignments are still being finalized. Once roles are added, their readiness will be
                tracked here.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Specialty</TableHead>
                    <TableHead className="w-24">Headcount</TableHead>
                    <TableHead>Skill Readiness</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stageCrew.map((crew) => (
                    <TableRow key={crew.id}>
                      <TableCell>
                        <div className="font-medium">{crew.specialty}</div>
                        <p className="text-sm text-muted-foreground">{crew.responsibilities ?? "—"}</p>
                      </TableCell>
                      <TableCell>{crew.headcount}</TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                            <span>Skill</span>
                            <span>
                              {crew.skill} / 100
                            </span>
                          </div>
                          <Progress value={crew.skill} className="h-2" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StageSetup;
