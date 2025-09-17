const firstNames = [
  "Nova",
  "Echo",
  "Luna",
  "Axel",
  "Zara",
  "Ryder",
  "Sable",
  "Jett",
  "Reign",
  "Aria",
  "Maverick",
  "Nyx",
  "Indigo",
  "Kai",
  "Vesper"
];

const lastNames = [
  "Blaze",
  "Skye",
  "Voltage",
  "Riot",
  "Sterling",
  "Nova",
  "Night",
  "Rush",
  "Storm",
  "Vox",
  "Phoenix",
  "Rebel",
  "Onyx",
  "Pulse",
  "Eclipse"
];

const epithets = [
  "the Virtuoso",
  "the Renegade",
  "the Dreamer",
  "the Thunder",
  "the Maverick",
  "the Catalyst",
  "the Siren",
  "the Vision",
  "the Afterglow",
  "the Rhapsody"
];

const getRandom = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

const shouldIncludeEpithet = () => Math.random() > 0.6;

const formatName = (first: string, last: string, epithet?: string) =>
  epithet ? `${first} ${last} ${epithet}` : `${first} ${last}`;

export function generateRandomName(): string {
  const first = getRandom(firstNames);
  const last = getRandom(lastNames);
  const epithet = shouldIncludeEpithet() ? getRandom(epithets) : undefined;
  return formatName(first, last, epithet);
}

export function generateHandleFromName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const sanitized = base || "rockstar";
  const randomSuffix = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");

  return `${sanitized}-${randomSuffix}`;
}
