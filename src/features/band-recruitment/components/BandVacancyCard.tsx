import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BandVacancy } from "../services/recruitment";

export function BandVacancyCard({ vacancy, onApply, onSave }: { vacancy: BandVacancy; onApply?: (vacancy: BandVacancy) => void; onSave?: (vacancy: BandVacancy) => void }) {
  const remaining = Math.max(0, vacancy.positions_available - vacancy.positions_filled);
  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm" aria-labelledby={`vacancy-${vacancy.id}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{vacancy.bands?.name ?? "Band"}</p>
          <h3 id={`vacancy-${vacancy.id}`} className="text-lg font-semibold">{vacancy.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{vacancy.short_description || vacancy.description.slice(0, 140)}</p>
        </div>
        {vacancy.match && <Badge variant="secondary" aria-label={`Match score ${vacancy.match.score} percent`}>{vacancy.match.score}% {vacancy.match.category}</Badge>}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div><dt className="text-muted-foreground">Role</dt><dd>{vacancy.role_type}</dd></div>
        <div><dt className="text-muted-foreground">Instrument</dt><dd>{vacancy.instrument}</dd></div>
        <div><dt className="text-muted-foreground">Commitment</dt><dd>{vacancy.commitment_level}</dd></div>
        <div><dt className="text-muted-foreground">Positions</dt><dd>{remaining} remaining</dd></div>
      </dl>
      {vacancy.genres?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{vacancy.genres.slice(0, 4).map((g) => <Badge key={g} variant="outline">{g}</Badge>)}</div>}
      {vacancy.match?.reasons?.length ? <ul className="mt-3 list-disc pl-5 text-sm text-muted-foreground">{vacancy.match.reasons.map((r) => <li key={r}>{r}</li>)}</ul> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild size="sm"><Link to={`/bands/${vacancy.band_id}/vacancies/${vacancy.id}`}>View vacancy</Link></Button>
        {onApply && <Button size="sm" variant="secondary" onClick={() => onApply(vacancy)}>Apply</Button>}
        {onSave && <Button size="sm" variant="outline" onClick={() => onSave(vacancy)}>{vacancy.saved ? "Saved" : "Save"}</Button>}
      </div>
    </article>
  );
}
