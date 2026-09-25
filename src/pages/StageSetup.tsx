import { useEffect, useMemo, useState } from'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PERFORMANCE_CREW_ROLES } from '@/utils/liveSetup';
import { Badge } from'@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from'@/components/ui/card';
import { Progress } from'@/components/ui/progress';
import { Separator } from'@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from'@/components/ui/table';
import { Label } from'@/components/ui/label';
import { Slider } from'@/components/ui/slider';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from'@/components/ui/select';
import {
 Pagination,
 PaginationContent,
 PaginationItem,
 PaginationLink,
 PaginationNext,
 PaginationPrevious,
} from'@/components/ui/pagination';
import { Sliders } from'lucide-react';
import { FMPageScaffold } from'@/components/fm/FMPageScaffold';

const ITEMS_PER_PAGE = 20;

type StageCrewAbilityLevel ='Novice'|'Skilled'|'Expert'|'Elite';

type StageCrewRecruit = {
 id: string;
 name: string;
 specialty: string;
 responsibilities: string;
 abilityLevel: StageCrewAbilityLevel;
 skill: number;
 cost: number;
 experienceYears: number;
};

const abilityLevelConfig: Array<{ label: StageCrewAbilityLevel; min: number; max: number }> = [
 { label:'Novice', min: 0, max: 59 },
 { label:'Skilled', min: 60, max: 79 },
 { label:'Expert', min: 80, max: 94 },
 { label:'Elite', min: 95, max: 100 },
];

const abilityFilterOptions = [
 { value:'all', label:'All ability levels'},
 { value:'novice', label:'Novice (0-59)'},
 { value:'skilled', label:'Skilled (60-79)'},
 { value:'expert', label:'Expert (80-94)'},
 { value:'elite', label:'Elite (95-100)'},
] as const;

type AbilityFilterValue = (typeof abilityFilterOptions)[number]['value'];

const abilityFilterToLevel: Record<AbilityFilterValue, StageCrewAbilityLevel | null> = {
 all: null,
 novice:'Novice',
 skilled:'Skilled',
 expert:'Expert',
 elite:'Elite',
};

const abilityLevelFromSkill = (skill: number): StageCrewAbilityLevel => {
  return abilityLevelConfig.find((level) => skill >= level.min && skill <= level.max)?.label ?? 'Elite';
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
 style:'currency',
 currency:'USD',
 maximumFractionDigits: 0,
});

const stageMetrics = {
 rating: 42,
 maxRating: 50,
 currentWattage: 2800,
 maxDb: 112,
};

const bandMembers = [
 {
 role:'Lead Guitar',
 instrument:'PRS Custom 24',
 pedalboard: [
 { position: 1, pedal:'TC Electronic Polytune 3', notes:'Quick reference mute and tune', powerDraw:'100 mA'},
 { position: 2, pedal:'Strymon Riverside', notes:'Core drive tone', powerDraw:'250 mA'},
 { position: 3, pedal:'Eventide H9', notes:'Modulation and ambient textures', powerDraw:'500 mA'},
 { position: 4, pedal:'Strymon Timeline', notes:'Dual delay presets', powerDraw:'300 mA'},
 ],
 amps: ['Mesa Boogie Mark V:35 Head','Mesa 2x12 Rectifier Cabinet'],
 monitors: ['IEM Mix A - Guitars focus','Ambient mic blend'],
 notes: ['Requests dual-mic blend (SM57 + Royer R-121)','Backup guitar: Fender Stratocaster ready side-stage'],
 },
 {
 role:'Rhythm Guitar',
 instrument:'Fender Telecaster Deluxe',
 pedalboard: [
 { position: 1, pedal:'Boss TU-3 Chromatic Tuner', notes:'Always on buffer', powerDraw:'45 mA'},
 { position: 2, pedal:'Fulltone OCD', notes:'Crunch rhythm drive', powerDraw:'12 mA'},
 { position: 3, pedal:'Walrus Audio Julia', notes:'Subtle chorus for clean parts', powerDraw:'30 mA'},
 { position: 4, pedal:'Strymon Flint', notes:'Reverb & tremolo', powerDraw:'250 mA'},
 ],
 amps: ['Vox AC30 Handwired Combo'],
 monitors: ['IEM Mix B - Vocals + Click'],
 notes: ['Prefers amp mic with 414 only','Capo station and spare strings stage right'],
 },
 {
 role:'Bass',
 instrument:'Fender American Deluxe Jazz Bass',
 pedalboard: [
 { position: 1, pedal:'Darkglass Hyper Luminal', notes:'Parallel compression', powerDraw:'110 mA'},
 { position: 2, pedal:'Tech 21 SansAmp Bass Driver', notes:'DI tone sculpting', powerDraw:'20 mA'},
 { position: 3, pedal:'MXR Bass Octave Deluxe', notes:'Synth textures on choruses', powerDraw:'13 mA'},
 ],
 amps: ['Ampeg SVT Classic Head','Ampeg 8x10 Cabinet'],
 monitors: ['Drum side fill','IEM Mix D - Rhythm section'],
 notes: ['Requires DI split pre/post pedals','Spare strings in tech world crate'],
 },
 {
 role:'Vocals',
 instrument:'Shure KSM9 Wireless',
 pedalboard: [],
 amps: ['Sennheiser EW G4 Wireless Rack'],
 monitors: ['IEM Mix C - Vocals priority','Side-fill wedge for ambience'],
 notes: ['Hydration station stage front left','Requests warm tea pre-show'],
 },
 {
 role:'Drums',
 instrument:'DW Collector\'s Series Maple',
 pedalboard: [],
 amps: ['Roland SPD-SX Pro (trigger interface)'],
 monitors: ['Drum sub mix with click','ButtKicker throne shaker'],
 notes: ['Triggers sync to timecode','Snare B on standby for quick swap'],
 },
 {
 role:'Keys & Synth',
 instrument:'Nord Stage 4 + Moog Subsequent 37',
 pedalboard: [],
 amps: ['Stereo DI into monitor world'],
 monitors: ['IEM Mix E - Keys stereo image'],
 notes: ['Requires sustain + expression pedals pre-wired','Laptop MainStage rig FOH USB split'],
 },
];

const fullBandRig = [
 {
 system:'Speaker Stacks',
 status:'Deployed',
 coverage:'120° arena coverage',
 details: ['L-Acoustics Kara line arrays (8 per side)','Dual KS28 cardioid subs per stack','Front fills on cue sends'],
 },
 {
 system:'Lighting',
 status:'Programmed',
 coverage:'Song-synced looks',
 details: ['12x Moving wash fixtures','Pixel mapped LED wall','Follow spots patched to grandMA'],
 },
 {
 system:'Monitoring',
 status:'Verified',
 coverage:'Full band IEM + side fills',
 details: ['6 stereo Shure PSM1000 mixes','Drum sub and cue wedges aligned','Crowd mics routed to all mixes'],
 },
 {
 system:'Mixing',
 status:'Soundcheck complete',
 coverage:'FOH + Monitor world',
 details: ['Avid S6L FOH with Waves rack','Monitor engineer on Digico Quantum 338','Redundant Dante recording rig'],
 },
 {
 system:'Backline',
 status:'Staged',
 coverage:'Complete instrument package',
 details: ['Tech world labeled & powered','Spare instruments and heads tuned','All cases show position marked'],
 },
];

const StageSetup = () => {
 const { data: stageCrew = [], isLoading: loadingStageCrew } = useQuery<StageCrewRecruit[]>({
    queryKey: ['stage-crew-real-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase.from('crew_catalog')
        .select('id,name,role,background,skill,salary,experience,hired_by_band_id')
        .is('hired_by_band_id', null);
      if (error) throw error;
      return (data || []).filter((candidate) => PERFORMANCE_CREW_ROLES.includes(candidate.role as typeof PERFORMANCE_CREW_ROLES[number]))
        .map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          specialty: candidate.role,
          responsibilities: candidate.background || 'Live show production',
          abilityLevel: abilityLevelFromSkill(Number(candidate.skill || 0)),
          skill: Number(candidate.skill || 0),
          cost: Number(candidate.salary || 0),
          experienceYears: Number(candidate.experience || 0),
        }));
    },
  });
 const costBounds = useMemo(() => {
 if (stageCrew.length === 0) {
 return { min: 0, max: 0 };
 }

 return stageCrew.reduce(
 (bounds, member) => ({
 min: Math.min(bounds.min, member.cost),
 max: Math.max(bounds.max, member.cost),
 }),
 { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
 );
 }, [stageCrew]);
 const [abilityFilter, setAbilityFilter] = useState<AbilityFilterValue>('all');
 const [costRange, setCostRange] = useState<[number, number]>([costBounds.min, costBounds.max]);
 const [currentPage, setCurrentPage] = useState(1);

 useEffect(() => {
 setCostRange([costBounds.min, costBounds.max]);
 }, [costBounds.min, costBounds.max]);

 const selectedAbilityLevel = abilityFilterToLevel[abilityFilter];

 const filteredCrew = useMemo(
 () =>
 stageCrew.filter((member) => {
 const matchesAbility = selectedAbilityLevel ? member.abilityLevel === selectedAbilityLevel : true;
 const matchesCost = member.cost >= costRange[0] && member.cost <= costRange[1];
 return matchesAbility && matchesCost;
 }),
 [stageCrew, selectedAbilityLevel, costRange],
 );

 useEffect(() => {
 setCurrentPage(1);
 }, [abilityFilter, costRange]);

 const totalPages = Math.max(1, Math.ceil(filteredCrew.length / ITEMS_PER_PAGE));

 useEffect(() => {
 if (currentPage > totalPages) {
 setCurrentPage(totalPages);
 }
 }, [currentPage, totalPages]);

 const paginatedCrew = useMemo(() => {
 const start = (currentPage - 1) * ITEMS_PER_PAGE;
 return filteredCrew.slice(start, start + ITEMS_PER_PAGE);
 }, [filteredCrew, currentPage]);

 const totalResults = filteredCrew.length;
 const visibleRangeStart = totalResults === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
 const visibleRangeEnd = totalResults === 0 ? 0 : Math.min(currentPage * ITEMS_PER_PAGE, totalResults);

 return (
 <FMPageScaffold
 title="Stage Setup"subtitle="Comprehensive snapshot of the live rig and crew readiness."icon={Sliders}
 backTo="/hub/band-live">
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
 {stageMetrics.rating} / {stageMetrics.maxRating}
 </span>
 </div>
 <Progress value={(stageMetrics.rating / stageMetrics.maxRating) * 100} className="h-2"/>
 </div>
 <div className="flex flex-wrap gap-2">
 <Badge variant="secondary">{stageMetrics.currentWattage} W Output</Badge>
 <Badge variant="outline">Peak {stageMetrics.maxDb} dB</Badge>
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
 {fullBandRig.map((system) => (
 <div key={system.system} className="rounded-lg border border-border/60 p-4 space-y-3">
 <div className="flex items-start justify-between gap-4">
 <div>
 <h3 className="text-base font-semibold">{system.system}</h3>
 <p className="text-sm text-muted-foreground">{system.details[0]}</p>
 </div>
 <Badge variant="secondary"className="whitespace-nowrap">
 {system.status}
 </Badge>
 </div>
 <Badge variant="outline"className="whitespace-nowrap">
 {system.coverage}
 </Badge>
 <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
 {system.details.map((detail) => (
 <li key={detail}>{detail}</li>
 ))}
 </ul>
 </div>
 ))}
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
 {bandMembers.map((member, index) => (
 <div key={member.role} className="space-y-4">
 <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
 <div>
 <h3 className="text-xl font-semibold">{member.role}</h3>
 <p className="text-sm text-muted-foreground">Primary Instrument: {member.instrument}</p>
 </div>
 <Badge variant="outline"className="w-fit">
 {member.instrument}
 </Badge>
 </div>

 {member.pedalboard && member.pedalboard.length > 0 ? (
 <div className="space-y-2">
 <h4 className="text-sm font-medium tracking-wide text-muted-foreground">Pedalboard</h4>
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
 <TableRow key={`${member.role}-${pedal.position}-${pedal.pedal}`}>
 <TableCell>{pedal.position}</TableCell>
 <TableCell className="font-medium">{pedal.pedal}</TableCell>
 <TableCell>{pedal.notes}</TableCell>
 <TableCell>{pedal.powerDraw}</TableCell>
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
 {member.amps.map((amp) => (
 <li key={`${member.role}-amp-${amp}`}>{amp}</li>
 ))}
 </ul>
 </div>
 <div>
 <h4 className="text-sm font-semibold text-muted-foreground">Monitoring</h4>
 <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
 {member.monitors.map((monitor) => (
 <li key={`${member.role}-monitor-${monitor}`}>{monitor}</li>
 ))}
 </ul>
 </div>
 <div>
 <h4 className="text-sm font-semibold text-muted-foreground">Quick Notes</h4>
 <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
 {member.notes.map((note) => (
 <li key={`${member.role}-note-${note}`}>{note}</li>
 ))}
 </ul>
 </div>
 </div>

 {index < bandMembers.length - 1 && <Separator />}
 </div>
 ))}
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Stage Crew</CardTitle>
 <CardDescription>Real specialists from the shared Crew Catalog. Hire them in Crew Management before assigning them to gigs.</CardDescription>
 </CardHeader>
 <CardContent className="space-y-6">
 <div className="grid gap-4 md:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="ability-filter">Ability level</Label>
 <Select value={abilityFilter} onValueChange={(value) => setAbilityFilter(value as AbilityFilterValue)}>
 <SelectTrigger id="ability-filter">
 <SelectValue placeholder="Select ability level"/>
 </SelectTrigger>
 <SelectContent>
 {abilityFilterOptions.map((option) => (
 <SelectItem key={option.value} value={option.value}>
 {option.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label>Per-gig salary range</Label>
 <div className="flex items-center justify-between text-xs text-muted-foreground">
 <span>{currencyFormatter.format(costRange[0])}</span>
 <span>{currencyFormatter.format(costRange[1])}</span>
 </div>
 <Slider
 min={costBounds.min}
 max={costBounds.max}
 step={10}
 disabled={!stageCrew.length || costBounds.min === costBounds.max}
 value={costRange}
 onValueChange={(value) => {
 if (value.length === 2) {
 setCostRange([Math.min(value[0], value[1]), Math.max(value[0], value[1])]);
 }
 }}
 />
 </div>
 </div>

 <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
 <span>
 Showing {visibleRangeStart.toLocaleString()}-
 {visibleRangeEnd.toLocaleString()} of {totalResults.toLocaleString()} available specialists
 </span>
 <span><Link className="underline" to="/band-crew">Hire staff in Crew Management</Link></span>
 </div>

 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Recruit</TableHead>
 <TableHead>Specialty</TableHead>
 <TableHead className="w-32 text-center">Ability</TableHead>
 <TableHead className="w-28 text-right">Skill</TableHead>
 <TableHead className="w-32 text-right">Per Gig</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {paginatedCrew.length === 0 ? (
 <TableRow>
 <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
 {loadingStageCrew ? 'Loading available crew...' : 'No available specialists match these filters.'}
 </TableCell>
 </TableRow>
 ) : (
 paginatedCrew.map((crew) => (
 <TableRow key={crew.id}>
 <TableCell>
 <div className="font-medium">{crew.name}</div>
 <p className="text-xs text-muted-foreground">Experience: {crew.experienceYears} years</p>
 </TableCell>
 <TableCell>
 <div className="font-medium">{crew.specialty}</div>
 <p className="text-xs text-muted-foreground">{crew.responsibilities}</p>
 </TableCell>
 <TableCell className="text-center">
 <Badge variant="secondary">{crew.abilityLevel}</Badge>
 </TableCell>
 <TableCell className="text-right">
 <div className="font-medium">{crew.skill} / 100</div>
 <Progress value={crew.skill} className="mt-1 h-2"/>
 </TableCell>
 <TableCell className="text-right font-medium">
 {currencyFormatter.format(crew.cost)}
 </TableCell>
 </TableRow>
 ))
 )}
 </TableBody>
 </Table>

 <Pagination className="pt-2">
 <PaginationContent>
 <PaginationItem>
 <PaginationPrevious
 href="#"onClick={(event) => {
 event.preventDefault();
 if (currentPage > 1) {
 setCurrentPage((page) => page - 1);
 }
 }}
 className={currentPage === 1 ?'pointer-events-none opacity-50': undefined}
 />
 </PaginationItem>
 <PaginationItem>
 <PaginationLink
 href="#"isActive
 onClick={(event) => {
 event.preventDefault();
 }}
 >
 Page {currentPage.toLocaleString()} of {totalPages.toLocaleString()}
 </PaginationLink>
 </PaginationItem>
 <PaginationItem>
 <PaginationNext
 href="#"onClick={(event) => {
 event.preventDefault();
 if (currentPage < totalPages) {
 setCurrentPage((page) => page + 1);
 }
 }}
 className={currentPage === totalPages ?'pointer-events-none opacity-50': undefined}
 />
 </PaginationItem>
 </PaginationContent>
 </Pagination>
 </CardContent>
 </Card>
 </div>
 </FMPageScaffold>
 );
};

export default StageSetup;
