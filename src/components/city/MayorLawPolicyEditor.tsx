import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateCityLaws } from "@/hooks/useMayorDashboard";
import type { CityLaws, DrugPolicyStatus } from "@/types/city-governance";
import { DRUG_POLICY_LABELS, LAW_FIELD_LABELS } from "@/types/city-governance";
import { MUSIC_GENRES } from "@/data/genres";

interface Props {
  cityId: string;
  currentLaws: CityLaws;
}

type EditableLawKey =
  | "income_tax_rate"
  | "sales_tax_rate"
  | "travel_tax"
  | "alcohol_legal_age"
  | "drug_policy"
  | "noise_curfew_hour"
  | "busking_license_fee"
  | "venue_permit_cost"
  | "prohibited_genres"
  | "promoted_genres"
  | "festival_permit_required"
  | "max_concert_capacity"
  | "community_events_funding";

const EDITABLE_FIELDS: EditableLawKey[] = [
  "income_tax_rate",
  "sales_tax_rate",
  "travel_tax",
  "alcohol_legal_age",
  "drug_policy",
  "noise_curfew_hour",
  "busking_license_fee",
  "venue_permit_cost",
  "prohibited_genres",
  "promoted_genres",
  "festival_permit_required",
  "max_concert_capacity",
  "community_events_funding",
];

export function MayorLawPolicyEditor({ cityId, currentLaws }: Props) {
  const updateLaws = useUpdateCityLaws();
  const [draft, setDraft] = useState<CityLaws>(currentLaws);
  const [changeReason, setChangeReason] = useState("");

  useEffect(() => {
    setDraft(currentLaws);
  }, [currentLaws]);

  const changedFields = useMemo(
    () => EDITABLE_FIELDS.filter((key) => JSON.stringify(draft[key]) !== JSON.stringify(currentLaws[key])),
    [currentLaws, draft],
  );

  const hasChanges = changedFields.length > 0;

  const change = <K extends EditableLawKey>(key: K, value: CityLaws[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const toggleGenre = (genre: string, target: "promoted" | "prohibited") => {
    const promoted = draft.promoted_genres ?? [];
    const prohibited = draft.prohibited_genres ?? [];

    if (target === "promoted") {
      const nextPromoted = promoted.includes(genre) ? promoted.filter((item) => item !== genre) : [...promoted, genre];
      change("promoted_genres", nextPromoted);
      if (!promoted.includes(genre)) change("prohibited_genres", prohibited.filter((item) => item !== genre));
      return;
    }

    const nextProhibited = prohibited.includes(genre) ? prohibited.filter((item) => item !== genre) : [...prohibited, genre];
    change("prohibited_genres", nextProhibited);
    if (!prohibited.includes(genre)) change("promoted_genres", promoted.filter((item) => item !== genre));
  };

  const save = async () => {
    if (!hasChanges) return;
    const updates = Object.fromEntries(changedFields.map((field) => [field, draft[field]])) as Partial<CityLaws>;
    await updateLaws.mutateAsync({ cityId, updates, changeReason: changeReason.trim() || undefined });
    setChangeReason("");
  };

  return (
    <div className="space-y-5">
      {hasChanges && (
        <Alert className="border-primary/40 bg-primary/5">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{changedFields.length} policy change{changedFields.length === 1 ? "" : "s"} ready to enact.</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setDraft(currentLaws)}>Reset</Button>
              <Button size="sm" disabled={updateLaws.isPending} onClick={save}>
                <Save className="mr-1 h-4 w-4" /> Enact changes
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle className="text-base">Taxes & city income</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <PolicySlider
                label="Income Tax Rate"
                value={draft.income_tax_rate ?? 10}
                suffix="%"
                min={5}
                max={25}
                onChange={(value) => change("income_tax_rate", value)}
                help="Applied to taxable income such as gig earnings where the city law is enforced."
              />
              <PolicySlider
                label="Sales Tax Rate"
                value={draft.sales_tax_rate ?? 8}
                suffix="%"
                min={0}
                max={15}
                onChange={(value) => change("sales_tax_rate", value)}
                help="City sales tax used by supported retail and sales systems."
              />
              <MoneyInput
                label="Travel Tax"
                value={draft.travel_tax ?? 0}
                max={500}
                onChange={(value) => change("travel_tax", value)}
                help="Per-trip travel levy configured for the city."
              />
              <MoneyInput
                label="Community Events Funding"
                value={draft.community_events_funding ?? 0}
                max={1_000_000}
                onChange={(value) => change("community_events_funding", value)}
                help="Funding level reserved in city policy for community events."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Venues, nightlife & permits</CardTitle></CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Alcohol Legal Age</Label>
                <Select value={String(draft.alcohol_legal_age ?? 21)} onValueChange={(value) => change("alcohol_legal_age", Number(value))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[18, 19, 20, 21].map((age) => <SelectItem key={age} value={String(age)}>{age} years</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Drug Policy</Label>
                <Select value={draft.drug_policy ?? "prohibited"} onValueChange={(value) => change("drug_policy", value as DrugPolicyStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DRUG_POLICY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Noise Curfew</Label>
                <Select
                  value={draft.noise_curfew_hour == null ? "none" : String(draft.noise_curfew_hour)}
                  onValueChange={(value) => change("noise_curfew_hour", value === "none" ? null : Number(value))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No curfew</SelectItem>
                    {[21, 22, 23, 24].map((hour) => (
                      <SelectItem key={hour} value={String(hour)}>{hour === 24 ? "Midnight" : `${hour}:00`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <MoneyInput
                label="Busking Licence Fee"
                value={draft.busking_license_fee ?? 0}
                max={1000}
                onChange={(value) => change("busking_license_fee", value)}
              />
              <MoneyInput
                label="Venue Permit Cost"
                value={draft.venue_permit_cost ?? 0}
                max={100_000}
                onChange={(value) => change("venue_permit_cost", value)}
              />
              <div className="space-y-2">
                <Label>Maximum Concert Capacity</Label>
                <Input
                  type="number"
                  min={0}
                  value={draft.max_concert_capacity ?? ""}
                  placeholder="No city cap"
                  onChange={(event) => change("max_concert_capacity", event.target.value === "" ? null : Number(event.target.value))}
                />
              </div>
              <div className="md:col-span-2 flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium">Festival permit required</div>
                  <div className="text-xs text-muted-foreground">Controls the city's festival permit policy.</div>
                </div>
                <Switch
                  checked={draft.festival_permit_required ?? false}
                  onCheckedChange={(checked) => change("festival_permit_required", checked)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Music policy</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Promote genres the city wants to champion or prohibit genres where supported by gameplay rules. A genre cannot be in both lists.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {MUSIC_GENRES.map((genre) => {
                  const promoted = (draft.promoted_genres ?? []).includes(genre);
                  const prohibited = (draft.prohibited_genres ?? []).includes(genre);
                  return (
                    <div key={genre} className="rounded-lg border p-3">
                      <div className="mb-2 font-medium">{genre}</div>
                      <div className="flex gap-2">
                        <Button size="sm" variant={promoted ? "default" : "outline"} onClick={() => toggleGenre(genre, "promoted")}>Promote</Button>
                        <Button size="sm" variant={prohibited ? "destructive" : "outline"} onClick={() => toggleGenre(genre, "prohibited")}>Prohibit</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle className="text-base">Policy change summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {changedFields.length === 0 ? (
                <p className="text-sm text-muted-foreground">Change a policy to preview the exact values that will be saved.</p>
              ) : (
                changedFields.map((field) => (
                  <div key={field} className="rounded-lg border p-2.5 text-sm">
                    <div className="font-medium">{LAW_FIELD_LABELS[field] ?? field.replace(/_/g, " ")}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{displayValue(currentLaws[field])}</span>
                      <span>→</span>
                      <Badge variant="secondary">{displayValue(draft[field])}</Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Reason for decision</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={changeReason}
                onChange={(event) => setChangeReason(event.target.value)}
                placeholder="Optional explanation recorded in city law history…"
                rows={5}
              />
              <p className="text-xs text-muted-foreground">The reason is stored with the policy history so future administrations can audit the decision.</p>
              <Button className="w-full" disabled={!hasChanges || updateLaws.isPending} onClick={save}>
                <Save className="mr-1 h-4 w-4" /> Enact {changedFields.length || ""} change{changedFields.length === 1 ? "" : "s"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PolicySlider({ label, value, suffix, min, max, onChange, help }: { label: string; value: number; suffix: string; min: number; max: number; onChange: (value: number) => void; help: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between"><Label>{label}</Label><Badge variant="secondary">{value}{suffix}</Badge></div>
      <Slider value={[value]} min={min} max={max} step={1} onValueChange={([next]) => onChange(next)} />
      <p className="text-xs text-muted-foreground">{help}</p>
    </div>
  );
}

function MoneyInput({ label, value, max, onChange, help }: { label: string; value: number; max: number; onChange: (value: number) => void; help?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2"><span className="text-muted-foreground">$</span><Input type="number" min={0} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /></div>
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}

function displayValue(value: unknown) {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "None";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value == null || value === "") return "None";
  return String(value);
}
