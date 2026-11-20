import { Check, Radio, Sun, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { festivalThemes, festivalMotifs, type FestivalBranding } from "../domain/festivalBranding";

export function FestivalThemePicker({ value, onChange, disabled, name, place, dates }: {
  value: FestivalBranding; onChange: (value: FestivalBranding) => void; disabled?: boolean;
  name: string; place: string; dates: string;
}) {
  return <div className="grid min-w-0 gap-5 lg:grid-cols-[1fr_280px]">
    <div className="min-w-0 space-y-4">
      <div role="group" aria-label="Festival colour theme" className="grid gap-2 sm:grid-cols-2">
        {festivalThemes.map(theme => <Button key={theme.key} variant="outline" disabled={disabled}
          aria-pressed={value.theme === theme.key} onClick={() => onChange({ ...value, theme: theme.key })}
          className={`festival-theme-${theme.key} h-auto justify-start gap-3 p-3 text-left ${value.theme === theme.key ? "border-primary ring-1 ring-ring" : ""}`}>
          <span className="festival-colour-swatch h-9 w-9 shrink-0 rounded-md" />
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{theme.name}</span><span className="block whitespace-normal text-xs text-muted-foreground">{theme.mood}</span></span>
          {value.theme === theme.key && <Check className="h-4 w-4 shrink-0" />}
        </Button>)}
      </div>
      <div role="group" aria-label="Festival motif" className="flex flex-wrap gap-2">
        {festivalMotifs.map((motif, index) => {
          const Icon = [Radio, Waves, Sun][index];
          return <Button key={motif} variant={value.motif === motif ? "default" : "outline"} size="sm" disabled={disabled}
            aria-pressed={value.motif === motif} onClick={() => onChange({ ...value, motif })}>
            {Icon && <Icon className="mr-2 h-4 w-4" />}{motif[0].toUpperCase() + motif.slice(1)}
          </Button>;
        })}
        <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onChange({ ...value, theme: null, motif: "spotlight" })}>Original colours</Button>
      </div>
    </div>
    <FestivalThemePreview branding={value} name={name} place={place} dates={dates} />
  </div>;
}

export function FestivalThemePreview({ branding, name, place, dates }: { branding: FestivalBranding; name: string; place: string; dates: string }) {
  return <div role="img" aria-label={`${name} festival artwork preview`} className={`festival-theme-${branding.theme ?? "electric"} festival-theme-art festival-motif-${branding.motif} relative flex aspect-[4/5] min-w-0 flex-col justify-between overflow-hidden rounded-md border p-5`}>
    <p className="relative text-xs font-semibold uppercase">Rockmundo · Festival</p>
    <div className="relative space-y-3"><h4 className="break-words text-3xl font-black uppercase leading-tight">{name || "Festival"}</h4>
      <p className="text-sm">{place || "City to be confirmed"}</p><p className="text-xs">{dates || "Date to be confirmed"}</p></div>
    <p className="relative text-xs">rockmundo.uk</p>
  </div>;
}