// Maps skill tree instruments to POV clip generation prompts
// Each entry defines the instrument, family, and prompt variants

export interface ClipPromptConfig {
  instrumentTrack: string;
  instrumentFamily: string;
  variants: {
    variant: string;
    prompt: string;
  }[];
}

export interface UniversalClipConfig {
  category: string;
  variant: string;
  venueSize: string;
  prompt: string;
}

export const INSTRUMENT_CLIP_CONFIGS: ClipPromptConfig[] = [
  // === GUITAR FAMILY ===
  { instrumentTrack: 'Electric Guitar', instrumentFamily: 'guitar', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing electric guitar on stage, fretboard in focus, fingers on strings, stage lights reflecting off guitar body, MTV2 Kerrang aesthetic, grainy handheld camera, high contrast, concert atmosphere' },
    { variant: 'crowd_look', prompt: 'First-person POV from guitarist looking up at concert crowd while playing, guitar neck visible at bottom of frame, crowd hands raised, stage lights behind audience, grainy handheld camera feel' },
    { variant: 'close_up', prompt: 'First-person extreme close-up of fingers shredding on electric guitar fretboard, sweat on strings, stage lights creating lens flare, MTV2 early 2000s aesthetic, high contrast grainy footage' },
  ]},
  { instrumentTrack: 'Acoustic Guitar', instrumentFamily: 'guitar', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands strumming acoustic guitar on stage, sound hole visible, wooden body, intimate venue lighting, grainy handheld camera' },
    { variant: 'crowd_look', prompt: 'First-person POV from acoustic guitarist looking at audience, guitar body visible at bottom, warm stage lighting, intimate concert setting' },
    { variant: 'close_up', prompt: 'First-person close-up of fingers picking acoustic guitar strings, wood grain visible, warm lighting, intimate performance atmosphere' },
  ]},
  { instrumentTrack: 'Classical Guitar', instrumentFamily: 'guitar', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing classical nylon-string guitar, proper classical position, elegant stage lighting' },
    { variant: 'crowd_look', prompt: 'First-person POV from classical guitarist looking at seated audience, guitar neck visible, theater lighting, refined atmosphere' },
  ]},
  { instrumentTrack: '12-String Guitar', instrumentFamily: 'guitar', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing 12-string guitar, double strings visible, rich resonance feel, stage lights' },
    { variant: 'crowd_look', prompt: 'First-person POV from 12-string guitarist looking at concert crowd, wide guitar neck visible at bottom of frame' },
  ]},
  { instrumentTrack: 'Pedal Steel Guitar', instrumentFamily: 'guitar', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at pedal steel guitar, bar slide in hand, pedals visible below, country/Americana stage setting' },
    { variant: 'close_up', prompt: 'First-person close-up of bar sliding across pedal steel strings, reflective chrome, warm stage lighting' },
  ]},
  { instrumentTrack: 'Lap Steel Guitar', instrumentFamily: 'guitar', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at lap steel guitar on lap, slide bar in hand, strings reflecting light' },
    { variant: 'crowd_look', prompt: 'First-person POV from lap steel player looking at audience, instrument on lap visible at bottom of frame' },
  ]},
  { instrumentTrack: 'Dobro', instrumentFamily: 'guitar', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at resonator dobro guitar, metal cone visible, slide playing, folk/blues stage atmosphere' },
    { variant: 'crowd_look', prompt: 'First-person POV from dobro player looking at audience, resonator guitar visible' },
  ]},
  { instrumentTrack: 'Bass Guitar', instrumentFamily: 'guitar', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing bass guitar, thick strings, fingers plucking, stage lights reflecting off bass body, MTV2 aesthetic, grainy concert footage' },
    { variant: 'crowd_look', prompt: 'First-person POV from bassist looking up at concert crowd, bass neck visible at bottom, crowd bouncing to the beat, dark atmospheric lighting' },
    { variant: 'close_up', prompt: 'First-person close-up of fingers slapping bass guitar strings, fret markers visible, high energy stage lighting, grainy handheld camera feel' },
  ]},
  { instrumentTrack: 'Upright Bass', instrumentFamily: 'guitar', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing upright double bass, large wooden body, fingers on thick strings, jazz club or concert hall lighting' },
    { variant: 'crowd_look', prompt: 'First-person POV from upright bass player peering around the instrument at the audience, warm stage lighting' },
  ]},

  // === KEYS FAMILY ===
  { instrumentTrack: 'Piano', instrumentFamily: 'keys', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing grand piano keys, black and white keys in focus, concert hall or stage lighting, elegant atmosphere' },
    { variant: 'crowd_look', prompt: 'First-person POV from pianist looking over piano at audience, piano lid visible, stage lights, concert atmosphere' },
  ]},
  { instrumentTrack: 'Organ', instrumentFamily: 'keys', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing Hammond organ, drawbars visible, Leslie speaker cabinet nearby, classic rock stage atmosphere' },
    { variant: 'crowd_look', prompt: 'First-person POV from organist looking over organ at concert crowd, knobs and switches visible' },
  ]},
  { instrumentTrack: 'Rhodes', instrumentFamily: 'keys', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing Fender Rhodes electric piano, classic keys, warm stage lighting, soul/jazz atmosphere' },
    { variant: 'crowd_look', prompt: 'First-person POV from Rhodes player looking at audience over the instrument, vintage vibes' },
  ]},
  { instrumentTrack: 'Wurlitzer', instrumentFamily: 'keys', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing Wurlitzer electric piano, compact keyboard, vintage stage setup' },
    { variant: 'crowd_look', prompt: 'First-person POV from Wurlitzer player looking at concert crowd, keyboard visible at bottom of frame' },
  ]},
  { instrumentTrack: 'Accordion', instrumentFamily: 'keys', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing accordion, bellows expanding, buttons and keys visible, folk festival atmosphere' },
    { variant: 'crowd_look', prompt: 'First-person POV from accordionist looking at audience while playing, bellows movement visible' },
  ]},
  { instrumentTrack: 'Harpsichord', instrumentFamily: 'keys', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing harpsichord, ornate keyboard, baroque concert setting' },
    { variant: 'crowd_look', prompt: 'First-person POV from harpsichordist looking at audience, decorative instrument visible' },
  ]},
  { instrumentTrack: 'Clavinet', instrumentFamily: 'keys', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing Hohner Clavinet, funky keyboard action, stage lights' },
    { variant: 'crowd_look', prompt: 'First-person POV from Clavinet player looking at audience, keyboard visible' },
  ]},
  { instrumentTrack: 'Mellotron', instrumentFamily: 'keys', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing Mellotron, vintage tape-based keyboard, psychedelic stage lighting' },
    { variant: 'crowd_look', prompt: 'First-person POV from Mellotron player looking at audience, retro instrument visible' },
  ]},
  { instrumentTrack: 'Celesta', instrumentFamily: 'keys', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing celesta, small keyboard, delicate orchestral instrument, concert hall' },
    { variant: 'crowd_look', prompt: 'First-person POV from celesta player looking at audience, small keyboard instrument visible' },
  ]},

  // === DRUMS/PERCUSSION ===
  { instrumentTrack: 'Rock Drums', instrumentFamily: 'drums', variants: [
    { variant: 'hands_down', prompt: 'First-person POV from behind drum kit, drumsticks in hands hitting snare, hi-hat and cymbals visible, stage lights through cymbals, MTV2 aesthetic, high energy, grainy footage' },
    { variant: 'crowd_look', prompt: 'First-person POV from drummer looking through cymbals at crowd, sticks in hands, audience visible between hi-hat and crash cymbal, energetic concert' },
    { variant: 'close_up', prompt: 'First-person extreme close-up of drumsticks hitting snare drum, impact visible, rim shots, sweat droplets, high contrast stage lighting' },
  ]},
  { instrumentTrack: 'Jazz Drums', instrumentFamily: 'drums', variants: [
    { variant: 'hands_down', prompt: 'First-person POV from behind jazz drum kit, brushes on snare, ride cymbal visible, warm intimate club lighting, jazz aesthetic' },
    { variant: 'crowd_look', prompt: 'First-person POV from jazz drummer looking at small club audience through cymbals, warm lighting, intimate setting' },
    { variant: 'close_up', prompt: 'First-person close-up of jazz brush technique on snare drum, subtle cymbal work, warm stage lighting' },
  ]},
  { instrumentTrack: 'Latin Percussion', instrumentFamily: 'drums', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing congas and bongos, Latin percussion setup, colorful stage lighting, dance energy' },
    { variant: 'crowd_look', prompt: 'First-person POV from Latin percussionist looking at dancing crowd, percussion instruments visible' },
    { variant: 'close_up', prompt: 'First-person close-up of hands striking conga drum head, vibration visible, Latin rhythm energy' },
  ]},
  { instrumentTrack: 'African Drums', instrumentFamily: 'drums', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing djembe drum, traditional African drumming, festival atmosphere' },
    { variant: 'crowd_look', prompt: 'First-person POV from African drummer looking at audience, djembe visible, outdoor festival vibe' },
    { variant: 'close_up', prompt: 'First-person close-up of hands on djembe drum head, rhythmic patterns, warm outdoor lighting' },
  ]},
  { instrumentTrack: 'Tabla', instrumentFamily: 'drums', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing tabla drums, two drums visible, intricate finger technique, Indian classical setting' },
    { variant: 'crowd_look', prompt: 'First-person POV from tabla player looking at seated audience, tabla pair visible at bottom of frame' },
    { variant: 'close_up', prompt: 'First-person close-up of fingers striking tabla, black center dot visible, intricate technique' },
  ]},
  { instrumentTrack: 'Marimba', instrumentFamily: 'drums', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing marimba with mallets, wooden bars visible, resonators below, concert setting' },
    { variant: 'crowd_look', prompt: 'First-person POV from marimba player looking at audience over the instrument, mallets in hands' },
  ]},
  { instrumentTrack: 'Vibraphone', instrumentFamily: 'drums', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing vibraphone with mallets, metal bars, motor-driven vibrato, jazz club lighting' },
    { variant: 'crowd_look', prompt: 'First-person POV from vibraphone player looking at audience, shimmering metal bars visible' },
  ]},
  { instrumentTrack: 'Timpani', instrumentFamily: 'drums', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing timpani with felt mallets, large copper kettledrum, orchestral concert hall' },
    { variant: 'crowd_look', prompt: 'First-person POV from timpanist looking at orchestra and audience, large drums visible' },
  ]},
  { instrumentTrack: 'Snare Drum', instrumentFamily: 'drums', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing snare drum with sticks, marching band or concert setting, crisp sound feel' },
    { variant: 'close_up', prompt: 'First-person close-up of sticks hitting snare drum head, wire snares visible, military precision' },
  ]},
  { instrumentTrack: 'Steel Pan', instrumentFamily: 'drums', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing steel pan drum with rubber-tipped sticks, concave metal sections visible, Caribbean festival atmosphere' },
    { variant: 'crowd_look', prompt: 'First-person POV from steel pan player looking at dancing tropical crowd, steel drum visible' },
  ]},
  { instrumentTrack: 'Taiko', instrumentFamily: 'drums', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing massive taiko drum with large bachi sticks, powerful stance, Japanese festival atmosphere' },
    { variant: 'crowd_look', prompt: 'First-person POV from taiko drummer looking at audience, massive drum visible, dramatic lighting' },
    { variant: 'close_up', prompt: 'First-person close-up of bachi sticks striking taiko drum skin, impact ripple, powerful energy' },
  ]},
  { instrumentTrack: 'Cajón', instrumentFamily: 'drums', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing cajón box drum, sitting on top, hands striking front face, acoustic performance setting' },
    { variant: 'crowd_look', prompt: 'First-person POV from cajón player looking at intimate audience, wooden box visible between legs' },
  ]},

  // === WIND ===
  { instrumentTrack: 'Flute', instrumentFamily: 'wind', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing silver concert flute, fingers on keys, embouchure visible, orchestra or concert stage' },
    { variant: 'crowd_look', prompt: 'First-person POV from flutist looking at audience past the flute, silver instrument visible, concert lighting' },
  ]},
  { instrumentTrack: 'Clarinet', instrumentFamily: 'wind', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing clarinet, wooden body, silver keys, classical or jazz setting' },
    { variant: 'crowd_look', prompt: 'First-person POV from clarinetist looking at audience, clarinet bell visible at bottom of frame' },
  ]},
  { instrumentTrack: 'Alto Saxophone', instrumentFamily: 'wind', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing alto saxophone, brass body, pearl keys, jazz club or concert atmosphere, golden reflections' },
    { variant: 'crowd_look', prompt: 'First-person POV from saxophonist looking at audience, saxophone bell visible, smoky jazz club lighting' },
  ]},
  { instrumentTrack: 'Tenor Saxophone', instrumentFamily: 'wind', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing tenor saxophone, larger brass body, jazz or rock concert stage' },
    { variant: 'crowd_look', prompt: 'First-person POV from tenor sax player looking at concert crowd, sax body visible, dramatic stage lighting' },
  ]},
  { instrumentTrack: 'Soprano Saxophone', instrumentFamily: 'wind', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing straight soprano saxophone, slim brass instrument, stage lighting' },
    { variant: 'crowd_look', prompt: 'First-person POV from soprano sax player looking at audience, straight saxophone visible' },
  ]},
  { instrumentTrack: 'Baritone Saxophone', instrumentFamily: 'wind', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing large baritone saxophone, massive brass instrument, jazz big band setting' },
    { variant: 'crowd_look', prompt: 'First-person POV from bari sax player looking at audience, large sax bell visible, big band atmosphere' },
  ]},
  { instrumentTrack: 'Harmonica', instrumentFamily: 'wind', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands cupped around harmonica near mouth, blues stage atmosphere, grainy footage feel' },
    { variant: 'crowd_look', prompt: 'First-person POV from harmonica player looking at blues club audience, hands and harmonica visible near face' },
  ]},
  { instrumentTrack: 'Bagpipes', instrumentFamily: 'wind', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing bagpipes, bag under arm, drones visible, Scottish or Celtic festival atmosphere' },
    { variant: 'crowd_look', prompt: 'First-person POV from bagpiper looking at outdoor crowd, bag and drones visible, Highland gathering atmosphere' },
  ]},

  // === BRASS ===
  { instrumentTrack: 'Trumpet', instrumentFamily: 'brass', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing trumpet, brass bell in front, valves under fingers, jazz or concert stage' },
    { variant: 'crowd_look', prompt: 'First-person POV from trumpet player looking at audience past the bell, brass reflections, stage lights' },
  ]},
  { instrumentTrack: 'Trombone', instrumentFamily: 'brass', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing trombone, slide extending forward, brass body visible, big band or concert stage' },
    { variant: 'crowd_look', prompt: 'First-person POV from trombonist looking at audience, slide visible extending toward crowd' },
  ]},
  { instrumentTrack: 'French Horn', instrumentFamily: 'brass', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing French horn, coiled brass tubes, right hand in bell, orchestral setting' },
    { variant: 'crowd_look', prompt: 'First-person POV from French horn player looking at orchestra and audience, curved brass instrument visible' },
  ]},
  { instrumentTrack: 'Tuba', instrumentFamily: 'brass', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing tuba, massive brass instrument, valves under fingers, brass band or concert setting' },
    { variant: 'crowd_look', prompt: 'First-person POV from tuba player looking past the large bell at audience, massive brass visible' },
  ]},
  { instrumentTrack: 'Euphonium', instrumentFamily: 'brass', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing euphonium, smaller tuba-like brass instrument, concert band setting' },
    { variant: 'crowd_look', prompt: 'First-person POV from euphonium player looking at audience, brass instrument visible' },
  ]},

  // === ELECTRONIC ===
  { instrumentTrack: 'Turntables', instrumentFamily: 'electronic', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands scratching vinyl on turntables, DJ setup, mixer visible, neon club lights, electronic music atmosphere' },
    { variant: 'crowd_look', prompt: 'First-person POV from DJ looking out at dancing club crowd, turntables and mixer visible at bottom of frame, laser lights' },
  ]},
  { instrumentTrack: 'Launchpad', instrumentFamily: 'electronic', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands tapping Novation Launchpad, colorful LED grid buttons, electronic music production setup on stage' },
    { variant: 'crowd_look', prompt: 'First-person POV from Launchpad performer looking at audience, colorful LED grid visible at bottom of frame' },
  ]},
  { instrumentTrack: 'Eurorack Synth', instrumentFamily: 'electronic', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands patching eurorack modular synthesizer, cables and knobs, blinking LEDs, electronic music stage' },
    { variant: 'crowd_look', prompt: 'First-person POV from modular synth player looking at audience, wall of modules visible, electronic music atmosphere' },
  ]},
  { instrumentTrack: 'Theremin', instrumentFamily: 'electronic', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking at hands hovering near theremin antennas, not touching instrument, eerie stage lighting, sci-fi atmosphere' },
    { variant: 'crowd_look', prompt: 'First-person POV from theremin player looking at mesmerized audience, antenna visible, ethereal stage lighting' },
  ]},
  { instrumentTrack: 'Keytar', instrumentFamily: 'electronic', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing keytar worn like a guitar, synth keys, 80s rock aesthetic, neon stage lighting' },
    { variant: 'crowd_look', prompt: 'First-person POV from keytar player looking at excited crowd, keytar neck visible, energetic performance' },
  ]},
  { instrumentTrack: 'MPC', instrumentFamily: 'electronic', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands finger-drumming on Akai MPC, rubber pads, hip-hop production setup on stage' },
    { variant: 'crowd_look', prompt: 'First-person POV from MPC player looking at hip-hop audience, beat machine visible at bottom of frame' },
  ]},
  { instrumentTrack: 'Synthesizer', instrumentFamily: 'electronic', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing synthesizer keyboard, knobs and sliders, LED displays, electronic music stage setup' },
    { variant: 'crowd_look', prompt: 'First-person POV from synth player looking at audience, synthesizer panel visible, futuristic stage lighting' },
  ]},

  // === WORLD/FOLK ===
  { instrumentTrack: 'Sitar', instrumentFamily: 'world', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing sitar, long neck with movable frets, resonating strings, Indian classical concert setting' },
    { variant: 'crowd_look', prompt: 'First-person POV from sitar player looking at seated audience, gourd resonator visible, traditional concert atmosphere' },
  ]},
  { instrumentTrack: 'Oud', instrumentFamily: 'world', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing oud, pear-shaped body, fretless neck, Middle Eastern music atmosphere' },
    { variant: 'crowd_look', prompt: 'First-person POV from oud player looking at audience, round-backed instrument visible' },
  ]},
  { instrumentTrack: 'Kora', instrumentFamily: 'world', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing kora, West African harp-lute, calabash gourd body, strings between hands' },
    { variant: 'crowd_look', prompt: 'First-person POV from kora player looking at audience, unique stringed instrument visible' },
  ]},
  { instrumentTrack: 'Erhu', instrumentFamily: 'world', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing Chinese erhu, two-stringed fiddle, bow between strings, traditional Chinese concert setting' },
    { variant: 'crowd_look', prompt: 'First-person POV from erhu player looking at audience, slender instrument visible, traditional stage' },
  ]},
  { instrumentTrack: 'Shamisen', instrumentFamily: 'world', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing Japanese shamisen, plectrum striking strings, three-stringed instrument, traditional Japanese stage' },
    { variant: 'crowd_look', prompt: 'First-person POV from shamisen player looking at audience, traditional Japanese instrument visible' },
  ]},
  { instrumentTrack: 'Bouzouki', instrumentFamily: 'world', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing Greek bouzouki, long neck, round body, Mediterranean music atmosphere' },
    { variant: 'crowd_look', prompt: 'First-person POV from bouzouki player looking at audience, Greek taverna or concert atmosphere' },
  ]},
  { instrumentTrack: 'Banjo', instrumentFamily: 'world', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands picking banjo, drum head visible, country/bluegrass stage atmosphere' },
    { variant: 'crowd_look', prompt: 'First-person POV from banjo player looking at country music audience, banjo head visible at bottom' },
  ]},
  { instrumentTrack: 'Mandolin', instrumentFamily: 'world', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands playing mandolin, small double-stringed instrument, folk/bluegrass atmosphere' },
    { variant: 'crowd_look', prompt: 'First-person POV from mandolin player looking at audience, small teardrop instrument visible' },
  ]},
  { instrumentTrack: 'Didgeridoo', instrumentFamily: 'world', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down long didgeridoo tube, Aboriginal Australian instrument, hands gripping decorated wooden tube, outdoor performance' },
    { variant: 'crowd_look', prompt: 'First-person POV from didgeridoo player looking at audience past the end of the long tube' },
  ]},
  { instrumentTrack: 'Ukulele', instrumentFamily: 'world', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands strumming ukulele, small four-stringed instrument, casual beach or indoor stage' },
    { variant: 'crowd_look', prompt: 'First-person POV from ukulele player looking at smiling audience, tiny instrument visible' },
  ]},
  { instrumentTrack: 'Harp', instrumentFamily: 'world', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking at hands plucking concert harp strings, golden frame visible, elegant concert hall lighting' },
    { variant: 'crowd_look', prompt: 'First-person POV from harpist looking through strings at audience, golden harp frame creating visual patterns' },
  ]},
  { instrumentTrack: 'Violin', instrumentFamily: 'world', variants: [
    { variant: 'hands_down', prompt: 'First-person POV from violinist looking down at bow on strings, chin rest perspective, concert or folk stage' },
    { variant: 'crowd_look', prompt: 'First-person POV from violinist looking past scroll at audience, bow arm visible, orchestral or folk concert' },
  ]},

  // === VOCALS ===
  { instrumentTrack: 'Lead Vocals', instrumentFamily: 'vocals', variants: [
    { variant: 'hands_down', prompt: 'First-person POV looking down at hands gripping microphone on stand, stage floor visible, singer perspective, concert atmosphere, MTV2 aesthetic' },
    { variant: 'crowd_look', prompt: 'First-person POV from vocalist looking at screaming concert crowd, microphone in hand, crowd hands reaching up, overexposed stage lights, grainy handheld feel' },
    { variant: 'close_up', prompt: 'First-person POV close-up of hand gripping microphone, knuckles white, sweat visible, intense performance moment, high contrast' },
  ]},
  { instrumentTrack: 'Rapper', instrumentFamily: 'vocals', variants: [
    { variant: 'hands_down', prompt: 'First-person POV from rapper looking down at mic in hand, gold chain visible, hip-hop concert stage, bass-heavy atmosphere' },
    { variant: 'crowd_look', prompt: 'First-person POV from rapper looking at hyped crowd with hands up, mic in hand, trap lighting, bass vibrations visible' },
    { variant: 'close_up', prompt: 'First-person close-up of hand with rings gripping wireless mic, hip-hop stage atmosphere, neon lighting' },
  ]},
  { instrumentTrack: 'Freestyle MC', instrumentFamily: 'vocals', variants: [
    { variant: 'hands_down', prompt: 'First-person POV from freestyle MC looking down at mic, cipher circle visible, urban performance setting' },
    { variant: 'crowd_look', prompt: 'First-person POV from freestyle MC looking at excited crowd, mic in hand, battle rap atmosphere' },
    { variant: 'close_up', prompt: 'First-person close-up of MC gripping mic intensely, spoken word energy, spotlight focus' },
  ]},
];

export const UNIVERSAL_CLIP_CONFIGS: UniversalClipConfig[] = [
  // Crowd - Small venue
  { category: 'crowd', variant: 'mosh_pit', venueSize: 'small', prompt: 'First-person POV from stage looking at small venue crowd of 50-200 people, hands raised, moshing, intimate punk rock atmosphere, grainy handheld camera, MTV2 aesthetic' },
  { category: 'crowd', variant: 'head_bobbing', venueSize: 'small', prompt: 'First-person POV from stage looking at small club crowd nodding heads to music, dim lighting, intimate atmosphere, faces visible' },
  { category: 'crowd', variant: 'singing_along', venueSize: 'small', prompt: 'First-person POV from stage looking at small venue crowd singing along, mouths open, passionate, beer splashing, indie rock atmosphere' },
  { category: 'crowd', variant: 'crowd_surf', venueSize: 'small', prompt: 'First-person POV from stage looking at someone crowd surfing in small venue, chaotic energy, punk rock show, hands holding person up' },

  // Crowd - Medium venue
  { category: 'crowd', variant: 'phone_lights', venueSize: 'medium', prompt: 'First-person POV from stage looking at medium venue crowd of 500-2000 people holding up phone lights, swaying, emotional ballad moment, beautiful sea of lights' },
  { category: 'crowd', variant: 'jumping', venueSize: 'medium', prompt: 'First-person POV from stage looking at medium venue crowd jumping in unison, energetic rock concert, stage lights sweeping over audience' },
  { category: 'crowd', variant: 'hands_raised', venueSize: 'medium', prompt: 'First-person POV from stage looking at medium venue crowd with arms raised, rock concert energy, spotlights on audience' },
  { category: 'crowd', variant: 'lighters', venueSize: 'medium', prompt: 'First-person POV from stage looking at medium venue crowd holding up lighters and phones, power ballad moment, warm glow across audience' },

  // Crowd - Arena
  { category: 'crowd', variant: 'massive_crowd', venueSize: 'arena', prompt: 'First-person POV from massive arena stage looking at 5000+ people, sea of faces, massive production lighting, pyrotechnics, epic concert atmosphere' },
  { category: 'crowd', variant: 'pyro_reaction', venueSize: 'arena', prompt: 'First-person POV from arena stage, pyrotechnics going off, crowd screaming and cheering, massive production, smoke and fire' },
  { category: 'crowd', variant: 'arena_wave', venueSize: 'arena', prompt: 'First-person POV from arena stage looking at crowd doing the wave, thousands of people, stadium rock concert atmosphere' },
  { category: 'crowd', variant: 'confetti', venueSize: 'arena', prompt: 'First-person POV from arena stage, confetti cannons firing, crowd celebrating, colorful paper falling, finale energy' },

  // Crowd - Festival
  { category: 'crowd', variant: 'festival_day', venueSize: 'festival', prompt: 'First-person POV from outdoor festival stage looking at massive daylight crowd, flags waving, tents visible in background, summer festival atmosphere' },
  { category: 'crowd', variant: 'festival_sunset', venueSize: 'festival', prompt: 'First-person POV from festival stage at sunset, crowd silhouettes against orange sky, magical golden hour, festival field' },
  { category: 'crowd', variant: 'festival_night', venueSize: 'festival', prompt: 'First-person POV from outdoor festival stage at night, LED wristbands glowing in crowd, lasers cutting through darkness, epic festival energy' },
  { category: 'crowd', variant: 'festival_rain', venueSize: 'festival', prompt: 'First-person POV from festival stage in rain, crowd still dancing, mud and joy, rain drops on camera lens, festival spirit' },

  // Backstage
  { category: 'backstage', variant: 'corridor_walk', venueSize: 'any', prompt: 'First-person POV walking through backstage corridor toward stage, concrete walls, equipment cases, roadies moving gear, anticipation building' },
  { category: 'backstage', variant: 'tunnel_walk', venueSize: 'any', prompt: 'First-person POV walking through dark backstage tunnel toward bright stage light at the end, silhouettes of crew, adrenaline building' },
  { category: 'backstage', variant: 'green_room_exit', venueSize: 'any', prompt: 'First-person POV leaving green room, walking past mirror with band stickers, pushing through heavy door toward stage area' },

  // Walking onto stage
  { category: 'entrance', variant: 'stage_entrance', venueSize: 'any', prompt: 'First-person POV stepping onto stage from side, bright lights hitting face, crowd erupting in cheers, instruments visible on stage, overwhelming energy' },
  { category: 'entrance', variant: 'spotlight_entrance', venueSize: 'any', prompt: 'First-person POV walking into spotlight on dark stage, crowd roaring, drum kit and amps visible in shadows, adrenaline rush moment' },
  { category: 'entrance', variant: 'pyro_entrance', venueSize: 'any', prompt: 'First-person POV walking onto stage with pyrotechnics firing on both sides, crowd screaming, epic rock concert entrance, sparks flying' },

  // Bowing/exit
  { category: 'exit', variant: 'bow', venueSize: 'any', prompt: 'First-person POV bowing to cheering crowd, looking down at stage floor then up at applauding audience, sweat dripping, satisfying moment' },
  { category: 'exit', variant: 'wave_goodbye', venueSize: 'any', prompt: 'First-person POV waving goodbye to crowd while walking off stage, audience still cheering, turning to look back one more time, emotional moment' },
  { category: 'exit', variant: 'encore_exit', venueSize: 'any', prompt: 'First-person POV leaving stage after encore, throwing guitar pick into crowd, fans screaming for more, reluctant exit, beautiful chaos' },

  // Between songs
  { category: 'between_songs', variant: 'bandmate_look', venueSize: 'any', prompt: 'First-person POV looking across stage at bandmates between songs, nodding to drummer, guitarist tuning, brief moment of calm before next song' },
  { category: 'between_songs', variant: 'gear_adjust', venueSize: 'any', prompt: 'First-person POV looking down at pedal board adjusting effects, or tuning instrument between songs, roadie handing water bottle' },
  { category: 'between_songs', variant: 'crowd_talk', venueSize: 'any', prompt: 'First-person POV addressing crowd between songs, looking at faces in front row, pointing to fans, banter moment, crowd cheering' },

  // Stage lights/atmosphere
  { category: 'atmosphere', variant: 'smoke_lights', venueSize: 'any', prompt: 'First-person POV on stage with smoke machines and moving head lights, beams cutting through haze, atmospheric concert lighting, cinematic feel' },
  { category: 'atmosphere', variant: 'strobe_effect', venueSize: 'any', prompt: 'First-person POV on stage with strobe lights flashing, freeze-frame effect on crowd, high energy moment, rave-like intensity, grainy footage' },
];

// Total clip count
export const getTotalClipCount = (): number => {
  const instrumentClips = INSTRUMENT_CLIP_CONFIGS.reduce((sum, config) => sum + config.variants.length, 0);
  const universalClips = UNIVERSAL_CLIP_CONFIGS.length;
  return instrumentClips + universalClips;
};
