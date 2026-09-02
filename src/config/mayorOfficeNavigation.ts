import { matchPath } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Crown,
  FileText,
  Gavel,
  GraduationCap,
  Hammer,
  Landmark,
  Megaphone,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type MayorOfficeSection =
  | "overview"
  | "treasury"
  | "projects"
  | "education"
  | "laws"
  | "services"
  | "opinion"
  | "promises"
  | "communications"
  | "elections"
  | "history";

export type MayorOfficeNavItem = {
  label: string;
  section: MayorOfficeSection;
  icon: LucideIcon;
};

export const MAYOR_OFFICE_ROUTE = "/cities/:cityId/mayor-dashboard";

export const MAYOR_OFFICE_TABS: MayorOfficeNavItem[] = [
  { label: "Overview", section: "overview", icon: Landmark },
  { label: "Treasury", section: "treasury", icon: CircleDollarSign },
  { label: "Projects", section: "projects", icon: Hammer },
  { label: "Universities", section: "education", icon: GraduationCap },
  { label: "Laws", section: "laws", icon: Gavel },
  { label: "Opinion", section: "opinion", icon: BarChart3 },
  { label: "Elections", section: "elections", icon: CalendarDays },
];

export const MAYOR_OFFICE_SIDEBAR: Array<{
  label: string;
  items: MayorOfficeNavItem[];
}> = [
  {
    label: "City Hall",
    items: [
      { label: "Command Centre", section: "overview", icon: Crown },
      { label: "Treasury & Budget", section: "treasury", icon: CircleDollarSign },
      { label: "Projects & Upgrades", section: "projects", icon: Hammer },
      { label: "Universities", section: "education", icon: GraduationCap },
    ],
  },
  {
    label: "Government",
    items: [
      { label: "Laws & Taxes", section: "laws", icon: Gavel },
      { label: "City Services", section: "services", icon: ShieldCheck },
      { label: "Public Opinion", section: "opinion", icon: BarChart3 },
    ],
  },
  {
    label: "Politics",
    items: [
      { label: "Promises", section: "promises", icon: CheckCircle2 },
      { label: "PR & Communications", section: "communications", icon: Megaphone },
      { label: "Elections & Term", section: "elections", icon: CalendarDays },
      { label: "City Hall History", section: "history", icon: BookOpen },
    ],
  },
];

const VALID_SECTIONS = new Set<MayorOfficeSection>(
  MAYOR_OFFICE_SIDEBAR.flatMap((group) => group.items.map((item) => item.section)),
);

export function isMayorOfficePath(pathname: string) {
  return Boolean(matchPath({ path: MAYOR_OFFICE_ROUTE, end: false }, pathname));
}

export function getMayorOfficeCityId(pathname: string) {
  return matchPath({ path: MAYOR_OFFICE_ROUTE, end: false }, pathname)?.params.cityId ?? null;
}

export function getMayorOfficeSection(search: string | URLSearchParams): MayorOfficeSection {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const candidate = params.get("section") as MayorOfficeSection | null;
  return candidate && VALID_SECTIONS.has(candidate) ? candidate : "overview";
}

export function buildMayorOfficePath(cityId: string, section: MayorOfficeSection = "overview") {
  const base = `/cities/${cityId}/mayor-dashboard`;
  return section === "overview" ? base : `${base}?section=${section}`;
}

export const MAYOR_OFFICE_MODULE_LABEL = "City Hall";
export const MAYOR_OFFICE_MODULE_ICON = Crown;

export const MAYOR_OFFICE_SECTION_TITLES: Record<MayorOfficeSection, string> = {
  overview: "Command Centre",
  treasury: "Treasury & Budget",
  projects: "Projects & Upgrades",
  education: "Universities",
  laws: "Laws & Taxes",
  services: "City Services",
  opinion: "Public Opinion",
  promises: "Campaign Promises",
  communications: "PR & Communications",
  elections: "Elections & Term",
  history: "City Hall History",
};

export const MAYOR_OFFICE_SECTION_DESCRIPTIONS: Record<MayorOfficeSection, string> = {
  overview: "A live view of your term, city finances, development and political pressure.",
  treasury: "Track the treasury, committed spending, tax receipts and mayoral expenditure.",
  projects: "Plan and monitor the upgrades that permanently change the city.",
  education: "Invest in university teaching quality and set local course fee policy without changing institutional prestige.",
  laws: "Set taxes, permits, nightlife rules and music policy for the city.",
  services: "Review the city attributes and services influenced by laws and investment.",
  opinion: "Monitor approval, integrity and the decisions shaping public confidence.",
  promises: "Track the commitments you made to voters and whether you are delivering them.",
  communications: "Use public relations actions to shape approval and your political profile.",
  elections: "See the current term, election timetable, candidates and previous results.",
  history: "Audit mayoral actions, law changes and previous administrations.",
};

export const MAYOR_OFFICE_DOCUMENT_ICON = FileText;
