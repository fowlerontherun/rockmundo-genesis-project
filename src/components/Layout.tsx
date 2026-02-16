import { useEffect, lazy, Suspense } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Navigation from "@/components/ui/navigation";
import HorizontalNavigation from "@/components/ui/HorizontalNavigation";
import CharacterGate from "@/components/CharacterGate";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { useNavStyle } from "@/hooks/useNavStyle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useAutoGigStart } from "@/hooks/useAutoGigStart";
import { useAutoRehearsalCompletion } from "@/hooks/useAutoRehearsalCompletion";
import { useGlobalGigExecution } from "@/hooks/useGlobalGigExecution";
import { usePlaytimeTracker } from "@/hooks/usePlaytimeTracker";
import { useAutoManufacturingCompletion } from "@/hooks/useAutoManufacturingCompletion";
import { useAutoMajorEventCompletion } from "@/hooks/useAutoMajorEventCompletion";
import { TutorialTooltip } from "@/components/tutorial/TutorialTooltip";
import { useGameEventNotifications } from "@/hooks/useGameEventNotifications";
import { EventNotificationModal } from "@/components/events/EventNotificationModal";
import { RehearsalCompletionReport } from "@/components/rehearsal/RehearsalCompletionReport";
import { FloatingAvatarWidget } from "@/components/FloatingAvatarWidget";
import { InterviewModal } from "@/components/pr/InterviewModal";

const Layout = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: dataLoading, error: profileError } = useGameData();
  const { navStyle } = useNavStyle();
  const isHorizontal = navStyle === "horizontal";

  // Global auto-start for gigs - runs regardless of which page user is on
  useAutoGigStart();
  
  // Global auto-complete for rehearsals - get pending report for UI display
  const { pendingReport, clearPendingReport } = useAutoRehearsalCompletion(user?.id || null);

  // Global gig execution - processes active gigs
  useGlobalGigExecution(user?.id || null);

  // Track total hours played
  usePlaytimeTracker(user?.id || null);

  // Global auto-complete for release manufacturing
  useAutoManufacturingCompletion(user?.id || null);

  // Auto-complete major events when game date passes event date
  useAutoMajorEventCompletion(user?.id || null);

  // Global game event notifications (gig results, offers, completions, etc.)
  useGameEventNotifications();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Removed automatic redirect to /my-character
  // Users can access character creation page directly if needed

  if (authLoading || dataLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-stage">
        <div className="text-center">
          <div className="mx-auto mb-4 h-32 w-32 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-lg font-oswald">Loading Rockmundo...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden">
      {isHorizontal ? <HorizontalNavigation /> : <Navigation />}
      <main className={`flex-1 ${isHorizontal ? 'pt-24 lg:pt-24' : 'pt-12 lg:pt-16'} pb-20 overflow-x-hidden max-w-full`}>
        <div className="p-3 md:p-4 max-w-full overflow-x-hidden">
          {profileError && (
            <Alert variant="destructive" className="mb-4 max-w-2xl">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Profile error</AlertTitle>
              <AlertDescription>{profileError}</AlertDescription>
            </Alert>
          )}
          <CharacterGate>
            <Outlet />
          </CharacterGate>
          <TutorialTooltip />
        </div>
      </main>
      <FloatingAvatarWidget />
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
    </div>
  );
};

export default Layout;
