import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { GigViewerReplay } from "../events/types";
import { GIG_EVENT_SCHEMA_VERSION } from "../events/constants";
import { buildReplayEvidenceSummary } from "./engine/ReplayEvidenceSummary";

/** Read-only Phase 5 inspector. Renders nothing that could mutate gig state. */
export function ReplayEvidenceInspector({
  replay,
  validationFailures,
  className,
}: {
  replay: GigViewerReplay | null;
  validationFailures?: readonly string[] | null;
  className?: string;
}) {
  if (!replay) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-sm">Replay evidence inspector</CardTitle>
          <CardDescription>No replay loaded.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const summary = buildReplayEvidenceSummary({
    replay,
    supportedEventSchemaVersion: GIG_EVENT_SCHEMA_VERSION,
    validationFailures,
  });

  return (
    <Card className={className} data-replay-evidence-inspector data-evidence-mode={summary.evidenceMode}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Replay evidence inspector</CardTitle>
        <CardDescription>
          Read-only. Signed asset URLs and private cost data are never displayed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-[11px]">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">viewer v{summary.viewerVersion}</Badge>
          <Badge variant={summary.schemaCompatibility === "unsupported" ? "destructive" : "outline"}>
            schema v{summary.eventSchemaVersion} · {summary.schemaCompatibility}
          </Badge>
          <Badge variant="secondary">{summary.status}</Badge>
          <Badge variant={summary.evidenceMode === "aggregate" ? "default" : "outline"}>
            evidence: {summary.evidenceMode}
          </Badge>
          {summary.presentationInference ? <Badge variant="outline">presentation inference</Badge> : null}
          {summary.resultAvailable ? null : <Badge variant="outline">result pending</Badge>}
          <Badge variant="outline">{summary.checksumPresent ? "checksum stored" : "no checksum"}</Badge>
          <Badge variant={summary.checksumVerdict === "mismatched" ? "destructive" : "outline"}>
            checksum {summary.checksumVerdict}
          </Badge>
          {summary.commerce.savedEventCount > 0 ? (
            <Badge variant="outline">{summary.commerce.savedEventCount} saved commerce events</Badge>
          ) : null}

        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
          <Fact label="Seed fingerprint" value={summary.simulationSeedFingerprint} />
          <Fact label="Events" value={summary.eventCount} />
          <Fact label="Song starts" value={summary.songStartCount} />
          <Fact label="Duration" value={`${Math.round(summary.durationMs / 1000)}s`} />
          <Fact label="Merch sold" value={summary.commerce.merchandiseItemsSold ?? "—"} />
          <Fact label="Merch gross" value={summary.commerce.merchandiseGrossRevenue ?? "—"} />
          <Fact label="Merch lines" value={summary.commerce.merchandiseLineCount ?? "—"} />
          <Fact label="Drinks served" value={summary.commerce.barDrinksServed ?? "—"} />
          <Fact label="Bar gross" value={summary.commerce.barGrossRevenue ?? "—"} />
          <Fact label="Bar owner" value={summary.commerce.barOwner ?? "—"} />
          <Fact label="Bar share" value={summary.commerce.barShareSource ?? "—"} />
          <Fact label="Formula" value={summary.commerce.formulaVersion ?? "—"} />
        </dl>

        <div>
          <p className="font-medium text-muted-foreground">Events by phase</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {Object.entries(summary.eventCountsByPhase).map(([phase, count]) => (
              <span key={phase} className="rounded border px-1.5 py-0.5">
                {phase}: {count}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="font-medium text-muted-foreground">Validation</p>
          {summary.validationFailures.length ? (
            <ul className="mt-1 list-inside list-disc text-destructive">
              {summary.validationFailures.map((failure) => (
                <li key={failure}>{failure}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-muted-foreground">No validation failures reported.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-muted-foreground">{label}</dt>
      <dd className="truncate font-mono">{value}</dd>
    </div>
  );
}
