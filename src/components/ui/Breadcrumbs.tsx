import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

// Pretty labels for common path segments. Unknown segments are title-cased.
const LABELS: Record<string, string> = {
  dashboard: "Home",
  hub: "Hub",
  character: "Artist",
  "career-business": "Career",
  "band-live": "Band",
  "world-social": "World",
  music: "Music",
  "song-market": "Market",
  "clothing-shop": "Clothing",
  admin: "Admin",
  bands: "Bands",
  booking: "Booking",
  media: "Media",
  community: "Community",
  twaater: "Twaater",
  recording: "Recording",
  songwriting: "Songwriting",
  releases: "Releases",
  "release-manager": "Releases",
  "music-studio": "Studio",
  studio: "Studio",
  "music-hub": "Music",
  schedule: "Schedule",
  inbox: "Inbox",
  settings: "Settings",
  "version-history": "Version History",
  gigs: "Gigs",
  tours: "Tours",
  festivals: "Festivals",
  awards: "Awards",
  finances: "Finances",
  employment: "Jobs",
  education: "Education",
  wellness: "Wellness",
  travel: "Travel",
  city: "City",
  cities: "Cities",
};

const titleCase = (s: string) =>
  s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const labelFor = (segment: string) =>
  LABELS[segment] ?? (segment.length > 20 ? "Detail" : titleCase(segment));

export const Breadcrumbs = () => {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  // Hide on root, auth, onboarding and shallow top-level routes
  if (segments.length < 2) return null;
  if (["auth", "onboarding", "index"].includes(segments[0])) return null;

  const crumbs = segments.map((seg, i) => {
    const path = "/" + segments.slice(0, i + 1).join("/");
    return { label: labelFor(seg), path };
  });

  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-3 -mt-1 flex items-center gap-1 text-xs text-muted-foreground overflow-x-auto whitespace-nowrap scrollbar-none"
    >
      <Link
        to="/dashboard"
        className="flex items-center gap-1 hover:text-foreground transition-colors"
        aria-label="Home"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={c.path} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 opacity-50" />
            {isLast ? (
              <span className="font-medium text-foreground truncate max-w-[160px]">
                {c.label}
              </span>
            ) : (
              <Link
                to={c.path}
                className="hover:text-foreground transition-colors truncate max-w-[120px]"
              >
                {c.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
