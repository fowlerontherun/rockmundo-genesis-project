import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Heart, Moon, User, Zap, Activity, Monitor, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGameData } from "@/hooks/useGameData";
import { useWellnessState } from "@/hooks/useWellnessState";
import { StatCard } from "../components/StatCard";
import { MobileEntityCard, MobileErrorState, MobileLoadingSkeleton, MobilePageShell, MobileSectionCard, MobileSectionHeader, MobileStatusBadge } from "../components/MobilePrimitives";

const DESKTOP_ONLY: Record<string, { title: string; description: string }> = {
  inventory: { title: "Inventory management", description: "Equipment, item use, repairs and inventory organisation are desktop gameplay." },
  wardrobe: { title: "Wardrobe & avatar", description: "Detailed outfit creation and avatar customisation are desktop gameplay." },
  skills: { title: "Skill management", description: "The full skill tree and XP spending remain desktop gameplay. Mobile practice scheduling is available from Career." },
  education: { title: "Education management", description: "Course browsing, tutors and long-form education setup remain desktop gameplay." },
  achievements: { title: "Achievements", description: "Detailed achievement browsing and reward management remain desktop gameplay." },
  settings: { title: "Account settings", description: "Detailed account and character settings remain on desktop." },
};

const clamp = (v: unknown, fallback = 0) => Math.max(0, Math.min(100, Number(v ?? fallback)));

function DesktopOnly({ section }: { section: string }) {
  const item = DESKTOP_ONLY[section] ?? { title: "Desktop gameplay", description: "This area is intentionally available only on desktop." };
  return (
    <MobilePageShell>
      <MobileSectionHeader eyebrow="Me" title={item.title} description={item.description} />
      <MobileSectionCard title="Desktop required" action={<MobileStatusBadge tone="info">Desktop</MobileStatusBadge>}>
        <div className="flex items-start gap-3">
          <Monitor className="mt-0.5 h-6 w-6 text-primary" />
          <div>
            <p className="text-sm font-semibold">This is intentionally not reproduced on mobile.</p>
            <p className="mt-1 text-sm text-muted-foreground">Use RockMundo on desktop for deeper configuration and management. Mobile is for planning your day, checking outcomes and quick actions.</p>
          </div>
        </div>
      </MobileSectionCard>
    </MobilePageShell>
  );
}

function Overview() {
  const navigate = useNavigate();
  const { profile, activityStatus } = useGameData();
  const p: any = profile ?? {};
  const displayName = p.display_name || p.stage_name || p.username || "Player";
  const energy = clamp(p.energy, 80);
  const mood = clamp(p.mood ?? p.happiness, 70);
  const health = clamp(p.health, 85);

  return (
    <MobilePageShell>
      <MobileSectionHeader eyebrow="Me" title={displayName} description="Your current status and lightweight personal actions." />
      <MobileSectionCard title="Current status" action={<MobileStatusBadge tone={activityStatus ? "info" : "success"}>{activityStatus ? "Busy" : "Available"}</MobileStatusBadge>}>
        <MobileEntityCard
          title={activityStatus?.activity_type ? String(activityStatus.activity_type).replaceAll("_", " ") : "No activity in progress"}
          subtitle={activityStatus?.ends_at ? `Until ${new Date(activityStatus.ends_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Ready for an ad hoc task or scheduled activity"}
          icon={<User className="h-5 w-5" />}
        />
      </MobileSectionCard>

      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Energy" value={energy} icon={<Zap className="h-4 w-4" />} />
        <StatCard label="Mood" value={mood} icon={<Moon className="h-4 w-4" />} />
        <StatCard label="Health" value={health} icon={<Heart className="h-4 w-4" />} />
      </div>

      <MobileSectionCard title="Quick personal actions" subtitle="Actions that are useful away from desktop.">
        <Button className="min-h-11 w-full" onClick={() => navigate("/mobile/me/wellness")}>Recover / wellness</Button>
      </MobileSectionCard>

      <MobileSectionCard title="Desktop gameplay" subtitle="Complex personal management stays on desktop.">
        <div className="space-y-2">
          {Object.entries(DESKTOP_ONLY).slice(0, 5).map(([key, item]) => (
            <MobileEntityCard key={key} title={item.title} subtitle={item.description} icon={<Monitor className="h-5 w-5" />} onPress={() => navigate(`/mobile/me/${key}`)} meta={<MobileStatusBadge>Desktop</MobileStatusBadge>} />
          ))}
        </div>
      </MobileSectionCard>
    </MobilePageShell>
  );
}

function Wellness() {
  const { profile } = useGameData();
  const profileId = profile?.id ?? null;
  const { catalog, blocks, vitals, loading, error, perform } = useWellnessState(profileId);
  const [performing, setPerforming] = useState<string | null>(null);
  const recovery = useMemo(() => catalog.filter((entry) => entry.category === "recovery").slice(0, 6), [catalog]);
  const v: any = vitals ?? {};

  const run = async (slug: string) => {
    setPerforming(slug);
    try {
      await perform(slug);
    } finally {
      setPerforming(null);
    }
  };

  return (
    <MobilePageShell>
      <MobileSectionHeader eyebrow="Me" title="Wellness" description="Check your condition and perform quick recovery actions using the same authoritative wellness system as desktop." />
      {loading ? <MobileLoadingSkeleton cards={3} /> : error ? <MobileErrorState message={error} /> : !vitals ? (
        <MobileErrorState title="Wellness unavailable" message="Your current wellness state could not be loaded." />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Energy" value={clamp(v.energy)} icon={<Zap className="h-4 w-4" />} />
            <StatCard label="Health" value={clamp(v.health ?? v.physical_health)} icon={<Heart className="h-4 w-4" />} />
            <StatCard label="Mood" value={clamp(v.mood ?? v.happiness)} icon={<Moon className="h-4 w-4" />} />
          </div>

          {blocks.length > 0 && (
            <MobileSectionCard title="Activity blocks" action={<MobileStatusBadge tone="warning">{blocks.length}</MobileStatusBadge>}>
              <div className="space-y-2">{blocks.map((block) => <MobileEntityCard key={block.id} title={block.reason} subtitle={`Until ${new Date(block.expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`} icon={<ShieldCheck className="h-5 w-5" />} />)}</div>
            </MobileSectionCard>
          )}

          <MobileSectionCard title="Recover now" subtitle="These are real server-backed wellness actions, not mobile placeholders.">
            {recovery.length ? (
              <div className="space-y-2">
                {recovery.map((entry) => (
                  <MobileEntityCard
                    key={entry.id}
                    title={entry.name}
                    subtitle={(entry as any).description || "Quick recovery action"}
                    icon={<Activity className="h-5 w-5" />}
                    meta={<Button size="sm" disabled={performing === entry.slug} onClick={(event) => { event.stopPropagation(); run(entry.slug); }}>{performing === entry.slug ? "Working…" : "Do now"}</Button>}
                  />
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No recovery actions are currently available.</p>}
          </MobileSectionCard>

          <MobileSectionCard title="Desktop wellness" subtitle="Lifestyle setup, detailed fitness/medical choices, ailments and long-term management remain on desktop." />
        </>
      )}
    </MobilePageShell>
  );
}

export default function MobileMe() {
  const { section } = useParams();
  if (!section || section === "overview") return <Overview />;
  if (section === "wellness") return <Wellness />;
  return <DesktopOnly section={section} />;
}
