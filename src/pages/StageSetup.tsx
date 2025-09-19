import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const stageMetrics = {
  rating: 42,
  maxRating: 50,
  currentWattage: 2800,
  maxDb: 112,
};

const bandMembers = [
  {
    role: 'Lead Guitar',
    instrument: 'PRS Custom 24',
    pedalboard: [
      { position: 1, pedal: 'TC Electronic Polytune 3', notes: 'Quick reference mute and tune', powerDraw: '100 mA' },
      { position: 2, pedal: 'Strymon Riverside', notes: 'Core drive tone', powerDraw: '250 mA' },
      { position: 3, pedal: 'Eventide H9', notes: 'Modulation and ambient textures', powerDraw: '500 mA' },
      { position: 4, pedal: 'Strymon Timeline', notes: 'Dual delay presets', powerDraw: '300 mA' },
    ],
    amps: ['Mesa Boogie Mark V:35 Head', 'Mesa 2x12 Rectifier Cabinet'],
    monitors: ['IEM Mix A - Guitars focus', 'Ambient mic blend'],
    notes: ['Requests dual-mic blend (SM57 + Royer R-121)', 'Backup guitar: Fender Stratocaster ready side-stage'],
  },
  {
    role: 'Rhythm Guitar',
    instrument: 'Fender Telecaster Deluxe',
    pedalboard: [
      { position: 1, pedal: 'Boss TU-3 Chromatic Tuner', notes: 'Always on buffer', powerDraw: '45 mA' },
      { position: 2, pedal: 'Fulltone OCD', notes: 'Crunch rhythm drive', powerDraw: '12 mA' },
      { position: 3, pedal: 'Walrus Audio Julia', notes: 'Subtle chorus for clean parts', powerDraw: '30 mA' },
      { position: 4, pedal: 'Strymon Flint', notes: 'Reverb & tremolo', powerDraw: '250 mA' },
    ],
    amps: ['Vox AC30 Handwired Combo'],
    monitors: ['IEM Mix B - Vocals + Click'],
    notes: ['Prefers amp mic with 414 only', 'Capo station and spare strings stage right'],
  },
  {
    role: 'Bass',
    instrument: 'Fender American Deluxe Jazz Bass',
    pedalboard: [
      { position: 1, pedal: 'Darkglass Hyper Luminal', notes: 'Parallel compression', powerDraw: '110 mA' },
      { position: 2, pedal: 'Tech 21 SansAmp Bass Driver', notes: 'DI tone sculpting', powerDraw: '20 mA' },
      { position: 3, pedal: 'MXR Bass Octave Deluxe', notes: 'Synth textures on choruses', powerDraw: '13 mA' },
    ],
    amps: ['Ampeg SVT Classic Head', 'Ampeg 8x10 Cabinet'],
    monitors: ['Drum side fill', 'IEM Mix D - Rhythm section'],
    notes: ['Requires DI split pre/post pedals', 'Spare strings in tech world crate'],
  },
  {
    role: 'Vocals',
    instrument: 'Shure KSM9 Wireless',
    pedalboard: [],
    amps: ['Sennheiser EW G4 Wireless Rack'],
    monitors: ['IEM Mix C - Vocals priority', 'Side-fill wedge for ambience'],
    notes: ['Hydration station stage front left', 'Requests warm tea pre-show'],
  },
  {
    role: 'Drums',
    instrument: 'DW Collector\'s Series Maple',
    pedalboard: [],
    amps: ['Roland SPD-SX Pro (trigger interface)'],
    monitors: ['Drum sub mix with click', 'ButtKicker throne shaker'],
    notes: ['Triggers sync to timecode', 'Snare B on standby for quick swap'],
  },
  {
    role: 'Keys & Synth',
    instrument: 'Nord Stage 4 + Moog Subsequent 37',
    pedalboard: [],
    amps: ['Stereo DI into monitor world'],
    monitors: ['IEM Mix E - Keys stereo image'],
    notes: ['Requires sustain + expression pedals pre-wired', 'Laptop MainStage rig FOH USB split'],
  },
];

const fullBandRig = [
  {
    system: 'Speaker Stacks',
    status: 'Deployed',
    coverage: '120° arena coverage',
    details: ['L-Acoustics Kara line arrays (8 per side)', 'Dual KS28 cardioid subs per stack', 'Front fills on cue sends'],
  },
  {
    system: 'Lighting',
    status: 'Programmed',
    coverage: 'Song-synced looks',
    details: ['12x Moving wash fixtures', 'Pixel mapped LED wall', 'Follow spots patched to grandMA'],
  },
  {
    system: 'Monitoring',
    status: 'Verified',
    coverage: 'Full band IEM + side fills',
    details: ['6 stereo Shure PSM1000 mixes', 'Drum sub and cue wedges aligned', 'Crowd mics routed to all mixes'],
  },
  {
    system: 'Mixing',
    status: 'Soundcheck complete',
    coverage: 'FOH + Monitor world',
    details: ['Avid S6L FOH with Waves rack', 'Monitor engineer on Digico Quantum 338', 'Redundant Dante recording rig'],
  },
  {
    system: 'Backline',
    status: 'Staged',
    coverage: 'Complete instrument package',
    details: ['Tech world labeled & powered', 'Spare instruments and heads tuned', 'All cases show position marked'],
  },
];

const stageCrew = [
  {
    specialty: 'Stage Manager',
    headcount: 1,
    responsibilities: 'Calls cues, coordinates load-in/out, liaises with venue ops',
    skill: 92,
  },
  {
    specialty: 'Front of House Engineer',
    headcount: 1,
    responsibilities: 'FOH mix, system tuning, crowd mic management',
    skill: 95,
  },
  {
    specialty: 'Monitor Engineer',
    headcount: 1,
    responsibilities: 'IEM mixes, stage volume control, talkback coordination',
    skill: 93,
  },
  {
    specialty: 'Backline Technicians',
    headcount: 3,
    responsibilities: 'Instrument maintenance, quick changeovers, tuning support',
    skill: 88,
  },
  {
    specialty: 'Lighting Director',
    headcount: 1,
    responsibilities: 'Programming, timecode integration, follow spot cues',
    skill: 90,
  },
  {
    specialty: 'Stagehands',
    headcount: 4,
    responsibilities: 'Rigging assistance, cable management, riser moves',
    skill: 84,
  },
];

const StageSetup = () => {
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
                  {stageMetrics.rating} / {stageMetrics.maxRating}
                </span>
              </div>
              <Progress value={(stageMetrics.rating / stageMetrics.maxRating) * 100} className="h-2" />
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
                    <Badge variant="secondary" className="whitespace-nowrap">
                      {system.status}
                    </Badge>
                  </div>
                  <Badge variant="outline" className="whitespace-nowrap">
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
            <CardDescription>Specialists keeping the show running smoothly.</CardDescription>
          </CardHeader>
          <CardContent>
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
                  <TableRow key={crew.specialty}>
                    <TableCell>
                      <div className="font-medium">{crew.specialty}</div>
                      <p className="text-sm text-muted-foreground">{crew.responsibilities}</p>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StageSetup;
