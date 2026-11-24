import { useState, type KeyboardEvent } from "react";
import type { FestivalPublicStage } from "../domain/festivalLaunch";
import { festivalCrowdBandLabels, type PublicFestivalStageCrowd } from "../domain/publicFestivalStageCrowds";
import type { FestivalRuntimeWeatherState } from "../domain/festivalRuntime";

type FacilityKey = "travel" | "camping" | "foodAndDrink" | "accessibility" | "backstage" | "hospitality";
type PublicFacilityKey = Exclude<FacilityKey, "backstage" | "hospitality">;
type PublishedFacilities = Record<PublicFacilityKey, string | null>;

const facilityCatalogue: { key: FacilityKey; label: string; marker: string; fallback: string }[] = [
  { key: "travel", label: "Arrival & travel", marker: "A", fallback: "Arrival and transport routes have not been published for this edition." },
  { key: "foodAndDrink", label: "Market & food", marker: "M", fallback: "Market and food locations have not been confirmed for this edition." },
  { key: "camping", label: "Camping", marker: "C", fallback: "Camping availability and location have not been published for this edition." },
  { key: "accessibility", label: "Accessibility", marker: "♿", fallback: "Contact the organiser for verified accessible entrances and routes." },
  { key: "backstage", label: "Backstage", marker: "B", fallback: "Backstage is restricted to authorised personnel. This public map never displays private access routes or staff operations." },
  { key: "hospitality", label: "Hospitality", marker: "H", fallback: "Hospitality availability and location have not been confirmed for this edition." },
];

const activateFromKeyboard = (event: KeyboardEvent<SVGGElement>, action: () => void) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
};

/**
 * Edition-scoped discovery illustration. Stage and facility coordinates are
 * derived for presentation only, never asserted as an organiser's site layout.
 */
export function FestivalGroundsMap({ stages, selectedStageId, onSelectStage, visitorInformation, stageCrowds = [], weatherState, localHour }: {
  stages: FestivalPublicStage[];
  selectedStageId?: string;
  onSelectStage: (id: string) => void;
  visitorInformation: PublishedFacilities;
  stageCrowds?: PublicFestivalStageCrowd[];
  weatherState?: FestivalRuntimeWeatherState | null;
  localHour?: number;
}) {
  const [selectedFacility, setSelectedFacility] = useState<FacilityKey | null>(null);
  const facilities = facilityCatalogue.map((item) => ({
    ...item,
    details: item.key === "backstage" || item.key === "hospitality" ? null : visitorInformation[item.key]?.trim() || null,
  }));
  const facility = facilities.find((item) => item.key === selectedFacility);
  const rows = Math.ceil(stages.length / 3);
  const height = Math.max(565, 265 + rows * 142 + 55);
  const knownLocalHour = localHour !== undefined && Number.isFinite(localHour) && localHour >= 0 && localHour < 24;
  const night = typeof localHour === "number" && knownLocalHour && (localHour >= 20 || localHour < 6);

  return (
    <section className="space-y-3" aria-label="Interactive Festival grounds illustration">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Explore the grounds</h3>
        <span className="rounded-full border px-2 py-1 text-xs">{stages.length} announced stage{stages.length === 1 ? "" : "s"}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Illustrated discovery map, <strong>not a walking map</strong>. Stage and facility positions are not verified;
        use the organiser's official site information for entrances, routes and accessibility.
      </p>
      <div className="overflow-hidden rounded-xl border bg-slate-950">
        <svg
          data-testid="festival-svg-grounds"
          viewBox={`0 0 960 ${height}`}
          role="group"
          aria-label="Illustrated stage and published facility hotspots"
          className="block h-auto w-full"
        >
          <rect width="960" height={height} fill={!knownLocalHour ? "#29394a" : night ? "#101b35" : "#183b39"} />
          <path d={`M 0 105 H 960 M 45 105 V ${height - 25} M 920 105 V ${height - 25}`} stroke="#94a3b8" strokeOpacity="0.26" strokeWidth="14" fill="none" strokeDasharray="26 22" />
          <path d={`M 75 120 H 884 V ${height - 36} H 75 Z`} stroke="#a7f3d0" strokeOpacity="0.4" strokeWidth="3" fill="none" strokeDasharray="7 12" />
          <text x="36" y="38" fontSize="17" fill="#e2e8f0" fontWeight="700">FESTIVAL GROUNDS</text>
          <text x="36" y="61" fontSize="12" fill="#cbd5e1">Schematic zones · not to scale</text>
          {weatherState && <text x="923" y="38" textAnchor="end" fontSize="13" fill="#bae6fd">Runtime weather: {weatherState.replaceAll("_", " ")}</text>}

          {facilities.map((item, index) => {
            const x = 90 + (index % 3) * 280;
            const y = 75 + Math.floor(index / 3) * 76;
            const active = selectedFacility === item.key;
            const select = () => setSelectedFacility(active ? null : item.key);
            return (
              <g key={item.key} role="button" tabIndex={0} aria-pressed={active} aria-label={`${item.key === "backstage" ? "Restricted" : item.details ? "Published" : "Unconfirmed"} ${item.label} information`}
                onClick={select} onKeyDown={(event) => activateFromKeyboard(event, select)} className="group cursor-pointer">
                <rect x={x} y={y} width="215" height="63" rx="13" fill={active ? "#0f766e" : "#334155"} stroke={active ? "#fef08a" : "#94a3b8"} strokeWidth={active ? 4 : 2} className="group-focus-visible:stroke-yellow-200 group-focus-visible:stroke-[5px]" />
                <text x={x + 16} y={y + 29} fill="#fef3c7" fontSize="18" fontWeight="700">{item.marker}</text>
                <text x={x + 48} y={y + 27} fill="white" fontSize="14">{item.label}</text>
                <text x={x + 48} y={y + 46} fill="#cbd5e1" fontSize="11">{item.key === "backstage" ? "Restricted" : item.details ? "Published information" : "Not verified"}</text>
              </g>
            );
          })}

          {stages.map((stage, index) => {
            const x = 90 + (index % 3) * 280;
            const y = 264 + Math.floor(index / 3) * 142;
            const selected = stage.id === selectedStageId;
            const crowd = stageCrowds.find((item) => item.stageId === stage.id);
            const select = () => { setSelectedFacility(null); onSelectStage(stage.id); };
            return (
              <g key={stage.id} role="button" tabIndex={0} aria-pressed={selected}
                aria-label={`Explore ${stage.name}, ${stage.capacity.toLocaleString("en-GB")} capacity${crowd ? `, reported crowd ${festivalCrowdBandLabels[crowd.crowdBand]}` : ", stage crowd unavailable"}`}
                onClick={select} onKeyDown={(event) => activateFromKeyboard(event, select)} className="group cursor-pointer">
                <rect x={x} y={y} width="215" height="99" rx="14" fill={selected ? "#6d28d9" : "#334155"} stroke={selected ? "#fef08a" : "#94a3b8"} strokeWidth={selected ? 5 : 2} className="group-focus-visible:stroke-yellow-200 group-focus-visible:stroke-[5px]" />
                <path d={`M ${x + 15} ${y + 39} L ${x + 107} ${y + 12} L ${x + 200} ${y + 39}`} stroke="#c4b5fd" strokeWidth="5" fill="none" />
                <rect x={x + 42} y={y + 41} width="130" height="10" rx="2" fill="#c4b5fd" />
                <text x={x + 107} y={y + 70} fill="white" fontSize="15" textAnchor="middle" fontWeight="700">{stage.name.length > 23 ? `${stage.name.slice(0, 20)}…` : stage.name}</text>
                <text x={x + 107} y={y + 88} fill="#e2e8f0" fontSize="12" textAnchor="middle">{crowd ? `Crowd: ${festivalCrowdBandLabels[crowd.crowdBand]}` : "Crowd not reported"}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="text-xs text-muted-foreground">
        {knownLocalHour ? `${night ? "Night" : "Day"} colours reflect the festival's local clock, not measured light levels.` : "Neutral colours: no current verified festival day is available."} Crowd bands appear only from current verified edition snapshots.
      </p>
      <div role="group" aria-label="Explore Festival facility information" className="flex flex-wrap gap-2">
        {facilities.map((item) => (
          <button key={item.key} type="button" aria-pressed={selectedFacility === item.key}
            className="min-h-11 rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            onClick={() => setSelectedFacility((current) => current === item.key ? null : item.key)}>
            {item.label}{item.details ? " · published" : item.key === "backstage" ? " · restricted" : " · unconfirmed"}
          </button>
        ))}
      </div>
      {facility ? (
        <div role="status" className="rounded-lg border bg-card p-3 text-sm">
          <h4 className="font-semibold">{facility.label} · {facility.details ? "published information" : facility.key === "backstage" ? "restricted access" : "not verified"}</h4>
          <p className="mt-1 whitespace-pre-line">{facility.details ?? facility.fallback}</p>
        </div>
      ) : null}
      {facilities.every((item) => !item.details) && <p className="text-xs text-muted-foreground">No verified facility information has been published for this edition yet.</p>}
    </section>
  );
}
