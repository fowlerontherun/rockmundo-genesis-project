import { lazy, Suspense } from "react";
import { PersonStanding } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
const PlayerModelEditor = lazy(() => import("@/features/player-model/PlayerModelEditor"));

export default function AvatarDesigner() {
  return <FMPageScaffold title="Avatar Creator" subtitle="Your full-body character. Your look on stage." icon={PersonStanding} backTo="/hub/character">
    <Suspense fallback={<p role="status" className="p-8">Loading avatar creator…</p>}><PlayerModelEditor /></Suspense>
  </FMPageScaffold>;
}
