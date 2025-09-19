export interface Festival {
  name: string;
  dateRange: string;
  location: string;
  headliners: string[];
  attendance: string;
  ticketPrice: string;
  lineupUrl: string;
}

export const upcomingCityFestivals: Festival[] = [
  {
    name: "Skyline Sound Summit",
    dateRange: "May 24-26",
    location: "Harbor District Parklands",
    headliners: ["Neon Vale", "The Paper Sages", "Aurora State"],
    attendance: "35,000 per day",
    ticketPrice: "$120 weekend pass",
    lineupUrl: "/festivals",
  },
  {
    name: "Midnight Echo Fest",
    dateRange: "June 14-16",
    location: "Old Town Warehouse Quarter",
    headliners: ["Velvet Arcs", "Midnight Lions", "DJ Lumen"],
    attendance: "22,000 nightly",
    ticketPrice: "$85 single night",
    lineupUrl: "/festivals",
  },
  {
    name: "Riverfront Radiance",
    dateRange: "July 4-6",
    location: "Riverside Amphitheater Complex",
    headliners: ["Solar Parade", "The Tidebreakers", "Echo Garden"],
    attendance: "18,500 daily",
    ticketPrice: "$95 weekend pass",
    lineupUrl: "/festivals",
  },
];
