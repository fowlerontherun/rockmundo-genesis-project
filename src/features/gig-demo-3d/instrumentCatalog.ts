import type { StageRole } from './liveTypes';
/** Stable IDs match every instrument track in the skill tree (all three tiers). */
export const STAGE_INSTRUMENTS = {
    'acoustic_guitar': { label: 'Acoustic Guitar', family: 'strum', role: 'guitar', stationary: false },
    'classical_guitar': { label: 'Classical Guitar', family: 'strum', role: 'guitar', stationary: false },
    'electric_guitar': { label: 'Electric Guitar', family: 'strum', role: 'guitar', stationary: false },
    'bass_guitar': { label: 'Bass Guitar', family: 'strum', role: 'bass', stationary: false },
    'upright_bass': { label: 'Upright Bass', family: 'upright', role: 'bass', stationary: true },
    'violin': { label: 'Violin', family: 'bow', role: 'strings', stationary: false },
    'viola': { label: 'Viola', family: 'bow', role: 'strings', stationary: false },
    'cello': { label: 'Cello', family: 'upright', role: 'strings', stationary: true },
    'banjo': { label: 'Banjo', family: 'strum', role: 'guitar', stationary: false },
    'mandolin': { label: 'Mandolin', family: 'strum', role: 'guitar', stationary: false },
    'ukulele': { label: 'Ukulele', family: 'strum', role: 'guitar', stationary: false },
    'harp': { label: 'Harp', family: 'harp', role: 'strings', stationary: true },
    '12_string_guitar': { label: '12-String Guitar', family: 'strum', role: 'guitar', stationary: false },
    'pedal_steel': { label: 'Pedal Steel Guitar', family: 'steel', role: 'strings', stationary: true },
    'lap_steel': { label: 'Lap Steel Guitar', family: 'steel', role: 'strings', stationary: true },
    'dobro': { label: 'Dobro/Resonator', family: 'strum', role: 'guitar', stationary: false },
    'classical_piano': { label: 'Classical Piano', family: 'keys', role: 'keyboard', stationary: true },
    'jazz_piano': { label: 'Jazz Piano', family: 'keys', role: 'keyboard', stationary: true },
    'hammond_organ': { label: 'Hammond Organ', family: 'keys', role: 'keyboard', stationary: true },
    'pipe_organ': { label: 'Pipe Organ', family: 'keys', role: 'keyboard', stationary: true },
    'rhodes': { label: 'Rhodes Piano', family: 'keys', role: 'keyboard', stationary: true },
    'wurlitzer': { label: 'Wurlitzer', family: 'keys', role: 'keyboard', stationary: true },
    'accordion': { label: 'Accordion', family: 'bellows', role: 'keyboard', stationary: false },
    'harpsichord': { label: 'Harpsichord', family: 'keys', role: 'keyboard', stationary: true },
    'clavinet': { label: 'Clavinet', family: 'keys', role: 'keyboard', stationary: true },
    'mellotron': { label: 'Mellotron', family: 'keys', role: 'keyboard', stationary: true },
    'celesta': { label: 'Celesta', family: 'keys', role: 'keyboard', stationary: true },
    'rock_drums': { label: 'Rock Drums', family: 'kit', role: 'drums', stationary: true },
    'jazz_drums': { label: 'Jazz Drums', family: 'kit', role: 'drums', stationary: true },
    'latin_percussion': { label: 'Latin Percussion', family: 'handDrum', role: 'percussion', stationary: true },
    'african_drums': { label: 'African Drumming', family: 'handDrum', role: 'percussion', stationary: true },
    'tabla': { label: 'Tabla', family: 'handDrum', role: 'percussion', stationary: true },
    'marimba': { label: 'Marimba', family: 'mallets', role: 'percussion', stationary: true },
    'vibraphone': { label: 'Vibraphone', family: 'mallets', role: 'percussion', stationary: true },
    'timpani': { label: 'Timpani', family: 'mallets', role: 'percussion', stationary: true },
    'snare': { label: 'Snare Drum', family: 'mallets', role: 'percussion', stationary: true },
    'steelpan': { label: 'Steelpan', family: 'mallets', role: 'percussion', stationary: true },
    'taiko': { label: 'Taiko', family: 'mallets', role: 'percussion', stationary: true },
    'cajon': { label: 'Cajon', family: 'handDrum', role: 'percussion', stationary: true },
    'xylophone': { label: 'Xylophone', family: 'mallets', role: 'percussion', stationary: true },
    'glockenspiel': { label: 'Glockenspiel', family: 'mallets', role: 'percussion', stationary: true },
    'frame_drum': { label: 'Frame Drum', family: 'frame', role: 'percussion', stationary: false },
    'flute': { label: 'Flute', family: 'flute', role: 'woodwind', stationary: false },
    'clarinet': { label: 'Clarinet', family: 'reed', role: 'woodwind', stationary: false },
    'oboe': { label: 'Oboe', family: 'reed', role: 'woodwind', stationary: false },
    'bassoon': { label: 'Bassoon', family: 'reed', role: 'woodwind', stationary: false },
    'alto_sax': { label: 'Alto Saxophone', family: 'reed', role: 'woodwind', stationary: false },
    'tenor_sax': { label: 'Tenor Saxophone', family: 'reed', role: 'woodwind', stationary: false },
    'soprano_sax': { label: 'Soprano Saxophone', family: 'reed', role: 'woodwind', stationary: false },
    'bari_sax': { label: 'Baritone Saxophone', family: 'reed', role: 'woodwind', stationary: false },
    'recorder': { label: 'Recorder', family: 'reed', role: 'woodwind', stationary: false },
    'harmonica': { label: 'Harmonica', family: 'mouth', role: 'woodwind', stationary: false },
    'pan_flute': { label: 'Pan Flute', family: 'mouth', role: 'woodwind', stationary: false },
    'bagpipes': { label: 'Bagpipes', family: 'pipes', role: 'woodwind', stationary: false },
    'didgeridoo': { label: 'Didgeridoo', family: 'drone', role: 'woodwind', stationary: false },
    'piccolo': { label: 'Piccolo', family: 'flute', role: 'woodwind', stationary: false },
    'trumpet': { label: 'Trumpet', family: 'brass', role: 'brass', stationary: false },
    'trombone': { label: 'Trombone', family: 'brass', role: 'brass', stationary: false },
    'french_horn': { label: 'French Horn', family: 'brass', role: 'brass', stationary: false },
    'tuba': { label: 'Tuba', family: 'brass', role: 'brass', stationary: false },
    'euphonium': { label: 'Euphonium', family: 'brass', role: 'brass', stationary: false },
    'flugelhorn': { label: 'Flugelhorn', family: 'brass', role: 'brass', stationary: false },
    'cornet': { label: 'Cornet', family: 'brass', role: 'brass', stationary: false },
    'sousaphone': { label: 'Sousaphone', family: 'brass', role: 'brass', stationary: false },
    'turntablism': { label: 'Turntablism', family: 'decks', role: 'dj', stationary: true },
    'push_launchpad': { label: 'Push/Launchpad', family: 'pads', role: 'dj', stationary: true },
    'eurorack': { label: 'Eurorack Modular', family: 'modular', role: 'dj', stationary: true },
    'theremin': { label: 'Theremin', family: 'theremin', role: 'dj', stationary: true },
    'ewi': { label: 'EWI', family: 'reed', role: 'woodwind', stationary: false },
    'keytar': { label: 'Keytar', family: 'keytar', role: 'keyboard', stationary: false },
    'mpc': { label: 'MPC/Maschine', family: 'pads', role: 'dj', stationary: true },
    'loop_station': { label: 'Loop Station', family: 'pads', role: 'dj', stationary: true },
    'analog_synth': { label: 'Analog Synthesizer', family: 'keys', role: 'keyboard', stationary: true },
    'digital_synth': { label: 'Digital Synthesizer', family: 'keys', role: 'keyboard', stationary: true },
    'electronic_drums': { label: 'Electronic Drums', family: 'kit', role: 'drums', stationary: true },
    'vocoder': { label: 'Vocoder', family: 'keys', role: 'keyboard', stationary: true },
    'sitar': { label: 'Sitar', family: 'strum', role: 'guitar', stationary: false },
    'oud': { label: 'Oud', family: 'strum', role: 'guitar', stationary: false },
    'kora': { label: 'Kora', family: 'harp', role: 'strings', stationary: true },
    'erhu': { label: 'Erhu', family: 'upright', role: 'strings', stationary: true },
    'shamisen': { label: 'Shamisen', family: 'strum', role: 'guitar', stationary: false },
    'bouzouki': { label: 'Bouzouki', family: 'strum', role: 'guitar', stationary: false },
    'balalaika': { label: 'Balalaika', family: 'strum', role: 'guitar', stationary: false },
    'charango': { label: 'Charango', family: 'strum', role: 'guitar', stationary: false },
    'kalimba': { label: 'Kalimba/Mbira', family: 'thumb', role: 'percussion', stationary: false },
    'gamelan': { label: 'Gamelan', family: 'mallets', role: 'percussion', stationary: true },
    'uilleann': { label: 'Uilleann Pipes', family: 'pipes', role: 'woodwind', stationary: false },
    'guzheng': { label: 'Guzheng', family: 'steel', role: 'strings', stationary: true },
    'biwa': { label: 'Biwa', family: 'strum', role: 'guitar', stationary: false },
    'tin_whistle': { label: 'Tin Whistle', family: 'reed', role: 'woodwind', stationary: false },
    'concertina': { label: 'Concertina', family: 'bellows', role: 'keyboard', stationary: false },
    'vocal_performance': { label: 'Vocal & Performance Skills', family: 'voice', role: 'vocals', stationary: false },
    'rapping': { label: 'Rapping', family: 'voice', role: 'vocals', stationary: false },
    'freestyle_rap': { label: 'Freestyle', family: 'voice', role: 'vocals', stationary: false },
    'battle_rap': { label: 'Battle Rap', family: 'voice', role: 'vocals', stationary: false },
    'flow_and_cadence': { label: 'Flow & Cadence', family: 'voice', role: 'vocals', stationary: false },
    'rap_songwriting': { label: 'Rap Songwriting', family: 'voice', role: 'vocals', stationary: false },
    'ad_libs_and_vocal_fx': { label: 'Ad-Libs & Vocal FX', family: 'voice', role: 'vocals', stationary: false },
} as const;
export type InstrumentId = keyof typeof STAGE_INSTRUMENTS;
export type PlayingStyle = typeof STAGE_INSTRUMENTS[InstrumentId]['family'];
export type VocalRole = 'lead' | 'backing' | null;
const clean = (value: string) => value.toLowerCase().replace(/^instruments_(basic|professional|mastery)_/, '').replace(/[^a-z0-9]+/g, ' ').trim();
const names = Object.entries(STAGE_INSTRUMENTS).flatMap(([id, spec]) => [[clean(id), id], [clean(spec.label), id]] as [
    string,
    InstrumentId
][]).sort((a, b) => b[0].length - a[0].length);
const aliases: [
    RegExp,
    InstrumentId
][] = [
    [/\b(upright|double|stand up) bass\b/, 'upright_bass'], [/\bbass(ist| guitar)?\b/, 'bass_guitar'],
    [/\b(electronic|electric) drums?\b/, 'electronic_drums'], [/\b(drums?|drummer|drum kit)\b/, 'rock_drums'],
    [/\b(lead guitar|rhythm guitar|guitarist|guitar)\b/, 'electric_guitar'],
    [/\b(keyboard|keyboardist|keys|pianist|piano)\b/, 'classical_piano'], [/\b(synth|synthesizer)\b/, 'analog_synth'],
    [/\b(dj|turntables?)\b/, 'turntablism'], [/\b(electronic|producer|sampler)\b/, 'mpc'],
    [/\b(percussion|percussionist|congas?|bongos?)\b/, 'latin_percussion'], [/\bstrings?\b/, 'violin'],
    [/\bwoodwind\b/, 'flute'],
    [/\b(rapper|rap|mc|emcee)\b/, 'rapping'],
    [/\b(sax|saxophone|saxophonist)\b/, 'alto_sax'], [/\b(brass|horns?)\b/, 'trumpet'],
    [/\b(vocals?|vocalist|singer|frontperson|front man|front woman|harmony)\b/, 'vocal_performance'],
];
export function stageAssignment(value?: string | null, fallback?: StageRole): {
    instrument: InstrumentId | null;
    role: StageRole;
    vocal: VocalRole;
    stationary: boolean;
} {
    const text = clean(value ?? '');
    const vocal: VocalRole = /\b(vocal|vocals|vocalist|singer|singing|harmony|frontperson|front man|front woman)\b/.test(text)
        ? /backing|background|backup|harmony/.test(text) ? 'backing' : 'lead' : null;
    // Match specific instruments before the optional vocal duty (e.g. Bass + Backing Vocals).
    const match = names.find(([name, id]) => id !== 'vocal_performance' && (` ${text} `).includes(` ${name} `));
    const instrument = match?.[1] ?? aliases.find(([pattern]) => pattern.test(text))?.[1]
        ?? (fallback && fallback !== 'other' && fallback !== 'fan' ? aliases.find(([pattern]) => pattern.test(fallback))?.[1] : null) ?? null;
    const spec = instrument ? STAGE_INSTRUMENTS[instrument] : null;
    return { instrument, role: spec?.role ?? fallback ?? 'other', vocal: vocal ?? (spec?.family === 'voice' ? 'lead' : null), stationary: spec?.stationary ?? false };
}
