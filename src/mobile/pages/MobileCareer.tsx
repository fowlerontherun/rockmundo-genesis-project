import { useNavigate } from "react-router-dom";
import { Users, Music, Zap, Mic2, CalendarDays, Sparkles } from "lucide-react";
import { SwipeTabs } from "../components/SwipeTabs";
import { MCard } from "../components/MCard";
import { EmptyState } from "../components/EmptyState";

const Placeholder = ({ label, to }: { label: string; to: string }) => {
  const navigate = useNavigate();
  return (
    <div className="space-y-2">
      <MCard
        title={`Open ${label}`}
        subtitle="Full view with all controls"
        chevron
        onPress={() => navigate(to)}
        icon={<Sparkles className="h-5 w-5" />}
      />
      <EmptyState title={`${label} summary`} message="Live cards will appear here." />
    </div>
  );
};

export default function MobileCareer() {
  const tabs = [
    { key: "band", label: "Band", icon: <Users className="h-4 w-4" />, content: <Placeholder label="Band Manager" to="/bands" /> },
    { key: "songs", label: "Songs", icon: <Music className="h-4 w-4" />, content: <Placeholder label="Songs" to="/songs" /> },
    { key: "practice", label: "Practice", icon: <Zap className="h-4 w-4" />, content: <Placeholder label="Skills" to="/skills" /> },
    { key: "recording", label: "Studio", icon: <Mic2 className="h-4 w-4" />, content: <Placeholder label="Recording" to="/recording" /> },
    { key: "gigs", label: "Gigs", icon: <CalendarDays className="h-4 w-4" />, content: <Placeholder label="Gigs" to="/gigs" /> },
    { key: "skills", label: "Career", icon: <Sparkles className="h-4 w-4" />, content: <Placeholder label="Progression" to="/progression" /> },
  ];
  return <SwipeTabs tabs={tabs} />;
}
