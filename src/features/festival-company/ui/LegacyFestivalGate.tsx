import { ReactNode } from "react";
import { Archive, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { festivalRoutes } from "@/features/festivals/routes";
import { useFestivalFeatureFlags } from "../config/featureFlags";
import { FestivalRebuildingScreen } from "./FestivalRebuildingScreen";

interface Props {
  children: ReactNode;
  area?: string;
}

function LegacyFestivalReadOnlyScreen({ area }: { area?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Archive className="h-6 w-6" />
          </div>
          <CardTitle>Legacy Festival actions are read-only</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center text-sm text-muted-foreground">
          <p>
            {area ? `${area} belongs` : "This page belongs"} to the retired Festival gameplay flow.
            Historical records are preserved, but applications, purchases, performance settlement and management writes are disabled.
          </p>
          <p>Use the annual-edition Festival system for current gameplay.</p>
          <div className="flex flex-col justify-center gap-2 pt-2 sm:flex-row">
            <Button asChild>
              <Link to={festivalRoutes.publicDirectory()}>
                Open current Festivals <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/festivals/history">View legacy history</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Legacy Festival routes remain available only as explicitly enabled compatibility surfaces.
 * The read and write switches are separate so enabling historical reads can never silently
 * remount legacy gameplay mutations.
 */
export function LegacyFestivalGate({ children, area }: Props) {
  const {
    legacyFestivalSystemEnabled,
    legacyFestivalReadEnabled,
    legacyFestivalWriteEnabled,
  } = useFestivalFeatureFlags();

  if (!legacyFestivalSystemEnabled || !legacyFestivalReadEnabled) {
    return <FestivalRebuildingScreen area={area} />;
  }

  if (!legacyFestivalWriteEnabled) {
    return <LegacyFestivalReadOnlyScreen area={area} />;
  }

  return <>{children}</>;
}

export default LegacyFestivalGate;
