import { useEffect } from "react";
import { Outlet, useNavigate, Navigate } from "react-router-dom";
import CharacterGate from "@/components/CharacterGate";
import { useIsMobileDevice } from "@/hooks/useIsMobileDevice";
import { useAuth } from "@/hooks/use-auth-context";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useGameData } from "@/hooks/useGameData";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useAutoGigStart } from "@/hooks/useAutoGigStart";
import { useAutoRehearsalCompletion } from "@/hooks/useAutoRehearsalCompletion";
import { useGlobalGigExecution } from "@/hooks/useGlobalGigExecution";
import { usePlaytimeTracker } from "@/hooks/usePlaytimeTracker";
import { useAutoManufacturingCompletion } from "@/hooks/useAutoManufacturingCompletion";
import { useAutoMajorEventCompletion } from "@/hooks/useAutoMajorEventCompletion";
import { useAutoRejoinTour } from "@/hooks/useAutoRejoinTour";
import { TutorialTooltip } from "@/components/tutorial/TutorialTooltip";
import { useGameEventNotifications } from "@/hooks/useGameEventNotifications";
import { EventNotificationModal } from "@/components/events/EventNotificationModal";
import { RehearsalCompletionReport } from "@/components/rehearsal/RehearsalCompletionReport";
import { useGigDayReminders } from "@/hooks/useGigDayReminders";
import { useReachMilestoneReminders } from "@/hooks/useReachMilestoneReminders";
import { InterviewModal } from "@/components/pr/InterviewModal";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { FMShell } from "@/components/fm/FMShell";
import { DesktopOnlyGate } from "@/components/DesktopOnlyGate";
import { useGameCalendar } from "@/hooks/useGameCalendar";
import { useAutoRecordingCompletion } from "@/hooks/useAutoRecordingCompletion";

const Layout = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: dataLoading, error: profileError } = useGameData();
  const { profileId } = useActiveProfile();
  const isMobile = useIsMobileDevice();



  // Global auto-start for gigs - runs regardless of which page user is on
  useAutoGigStart();
  
  // Global auto-complete for rehearsals - get pending report for UI display
  const { pendingReport, clearPendingReport } = useAutoRehearsalCompletion(user?.id || null);

  // Global gig execution - processes active gigs
  useGlobalGigExecution(user?.id || null);

  // Track total hours played
  usePlaytimeTracker(profileId || null);

  // Global auto-complete for release manufacturing
  useAutoManufacturingCompletion(user?.id || null);

  // Global auto-complete for recording sessions so finished studio bookings become recorded songs
  useAutoRecordingCompletion(user?.id || null, profileId || null);

  // Auto-complete major events when game date passes event date
  useAutoMajorEventCompletion(user?.id || null);

  // Auto-rejoin nearest tour leg if the player missed a pickup
  useAutoRejoinTour();

  // Global game event notifications (gig results, offers, completions, etc.)
  useGameEventNotifications();

  // Reminders for gigs in the next 24h
  useGigDayReminders();

  // Reminders when close to unlocking the next reach tier (local/regional/national)
  useReachMilestoneReminders();

  // Global game calendar for seasonal effects
  const { data: calendar } = useGameCalendar();

  // Dev-only guest bypass: in `vite dev` we skip the /auth redirect and the
  // unauthenticated null-render so pages can be inspected without logging in.
  // Production builds keep the original behavior.
  const devGuestBypass = import.meta.env.DEV;

  useEffect(() => {
    if (!authLoading && !user && !devGuestBypass) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate, devGuestBypass]);

  // Removed automatic redirect to /my-character
  // Users can access character creation page directly if needed

  if (authLoading || (dataLoading && user)) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-stage" role="status" aria-live="polite" aria-busy="true">
        <div className="text-center">
          <div className="mx-auto mb-4 h-32 w-32 animate-spin rounded-full border-b-2 border-primary" aria-hidden="true"></div>
          <p className="text-lg font-oswald">Loading Rockmundo...</p>
        </div>
      </div>
    );
  }

  if (!user && !devGuestBypass) {
    return null;
  }

  // Mobile users get redirected to the dedicated /mobile shell only from the
  // primary landing routes. Deep-links to feature pages (from mobile quick
  // actions, FAB, etc.) must render inline so buttons actually work — otherwise
  // every tap bounces back to /mobile.
  if (isMobile) {
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    if (path === "/" || path === "/home" || path === "/index") {
      return <Navigate to="/mobile" replace />;
    }
  }




  return (
    <ConditionalDesktopGate bypass={isMobile}>
    <FMShell>

      {profileError && (
        <Alert variant="destructive" className="mb-4 max-w-2xl">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Profile error</AlertTitle>
          <AlertDescription>{profileError}</AlertDescription>
        </Alert>
      )}
      <MaintenanceBanner />
      <CharacterGate>
        <Breadcrumbs />
        <Outlet />
      </CharacterGate>
      <TutorialTooltip />

      <EventNotificationModal />
      <InterviewModal />
      {pendingReport && (
        <RehearsalCompletionReport
          open={!!pendingReport}
          onClose={clearPendingReport}
          results={pendingReport.results}
          chemistryGain={pendingReport.chemistryGain}
          xpGained={pendingReport.xpGained}
          durationHours={pendingReport.durationHours}
        />
      )}
    </FMShell>
    </ConditionalDesktopGate>
  );
};

const ConditionalDesktopGate = ({ bypass, children }: { bypass: boolean; children: React.ReactNode }) =>
  bypass ? <>{children}</> : <DesktopOnlyGate>{children}</DesktopOnlyGate>;

export default Layout;

