import { Link, Navigate, useParams } from "react-router-dom";
import { CalendarDays, Monitor } from "lucide-react";
import MobileCareer from "./MobileCareer";
import { MobilePageShell, MobileSectionCard, MobileSectionHeader, MobileStatusBadge } from "../components/MobilePrimitives";

const scheduleSections = new Set(["gigs", "rehearsals", "recording"]);

const labels: Record<string, string> = {
  band: "Band management",
  songs: "Song library",
  songwriting: "Songwriting",
  recording: "Recording",
  rehearsals: "Rehearsals",
  setlists: "Setlists",
  gigs: "Gigs",
  tours: "Tours",
  releases: "Releases",
  streaming: "Streaming",
  charts: "Charts",
  awards: "Awards",
};

export default function MobileCareerRoutes() {
  const { section } = useParams();

  if (!section || section === "overview") return <MobileCareer />;
  if (section === "practice") return <Navigate to="/mobile?view=day#practice" replace />;
  if (section === "schedule") return <Navigate to="/mobile?view=day" replace />;

  const label = labels[section] ?? "Career management";
  const canCheckSchedule = scheduleSections.has(section);

  return (
    <MobilePageShell>
      <MobileSectionHeader
        eyebrow="Career"
        title={label}
        description={canCheckSchedule
          ? "Mobile lets you check when this is happening. Detailed setup and management remain on desktop."
          : "This is part of full career gameplay and is intentionally desktop-only."}
      />

      {canCheckSchedule && (
        <MobileSectionCard
          title="Check your schedule"
          subtitle="Existing bookings and commitments are available in My Day."
          action={<MobileStatusBadge tone="info">Mobile</MobileStatusBadge>}
        >
          <Link to="/mobile?view=day" className="rm-tap flex items-center justify-center gap-2 rounded-xl bg-primary p-3 text-sm font-semibold text-primary-foreground">
            <CalendarDays className="h-4 w-4" /> Open My Day
          </Link>
        </MobileSectionCard>
      )}

      <MobileSectionCard
        title="Continue on desktop"
        subtitle="Configuration, creation and detailed management are intentionally not duplicated on mobile."
        action={<MobileStatusBadge>Desktop</MobileStatusBadge>}
      >
        <div className="flex items-start gap-3 rounded-xl border p-3 text-sm text-muted-foreground">
          <Monitor className="mt-0.5 h-5 w-5 shrink-0" />
          <p>Use the desktop version of RockMundo for {label.toLowerCase()}. Mobile is reserved for planning the day, quick practice, travel, recovery, communication and checking outcomes.</p>
        </div>
      </MobileSectionCard>

      <Link to="/mobile/career" className="rm-tap block rounded-xl border p-3 text-center text-sm font-semibold">
        Back to Career
      </Link>
    </MobilePageShell>
  );
}
