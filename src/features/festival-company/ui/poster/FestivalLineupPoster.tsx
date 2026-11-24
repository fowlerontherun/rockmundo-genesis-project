import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { festivalPosterTiers } from "./festivalPosterTiers";
import { useFestivalArtworkBranding } from "../useFestivalArtworkBranding";
import type { FestivalBranding } from "../../domain/festivalBranding";

interface Props { name: string; place: string; dates: string; artists: string[]; editionId?: string | null; }

function cssColor(token: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return v ? (v.startsWith("#") ? v : `hsl(${v})`) : "transparent";
}

function downloadPoster({ name, place, dates, artists }: Props, branding: FestivalBranding) {
  const t = festivalPosterTiers(artists);
  const c = document.createElement("canvas");
  c.width = 1080; c.height = 1350;
  const ctx = c.getContext("2d");
  if (!ctx) return;
  const bg = ctx.createLinearGradient(0, 0, 0, c.height);
  bg.addColorStop(0, cssColor(branding.theme ? `--festival-${branding.theme}-dark` : "--background")); bg.addColorStop(1, cssColor(branding.theme ? `--festival-${branding.theme}-mid` : "--primary"));
  ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
  ctx.textAlign = "center"; ctx.fillStyle = cssColor(branding.theme ? `--festival-${branding.theme}-light` : "--foreground");
  let y = 150;
  const line = (text: string, size: number, weight = "800") => {
    ctx.font = `${weight} ${size}px sans-serif`;
    let s = size;
    while (ctx.measureText(text).width > 980 && s > 18) { s -= 2; ctx.font = `${weight} ${s}px sans-serif`; }
    ctx.fillText(text, 540, y); y += s * 1.35;
  };
  line(name.toUpperCase(), 96); line(`${place} · ${dates}`, 30, "500"); y += 60;
  t.headliners.forEach((a) => line(a.toUpperCase(), 110));
  y += 20; t.subHeadliners.forEach((a) => line(a.toUpperCase(), 56, "700"));
  y += 30;
  for (let i = 0; i < t.support.length; i += 3) line(t.support.slice(i, i + 3).join("  ·  "), 30, "500");
  ctx.font = "500 24px sans-serif"; ctx.fillText("rockmundo.uk", 540, 1300);
  const a = document.createElement("a");
  a.download = `${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-poster.png`;
  a.href = c.toDataURL("image/png"); a.click();
}

export function FestivalLineupPoster(props: Props) {
  const branding = useFestivalArtworkBranding(props.editionId);
  const t = festivalPosterTiers(props.artists);
  if (!props.artists.length) return null;
  return (
    <section aria-label="Festival line-up poster" className="space-y-3">
      <div className={`relative overflow-hidden rounded-md border px-4 py-8 text-center shadow-lg ${branding.theme ? `festival-theme-${branding.theme} festival-theme-art festival-motif-${branding.motif}` : "bg-gradient-to-b from-background via-background to-primary/40"}`}>
        <p className="relative break-words text-3xl font-black uppercase">{props.name}</p>
        <p className="relative text-xs">{props.place} · {props.dates}</p>
        <div className="relative mt-6 space-y-2">
          {t.headliners.map((a) => <p key={a} className={`break-words text-4xl font-black uppercase sm:text-5xl ${branding.theme ? "festival-billing" : "text-primary"}`}>{a}</p>)}
          <div className="flex flex-wrap justify-center gap-x-4">
            {t.subHeadliners.map((a) => <p key={a} className="text-xl font-bold uppercase">{a}</p>)}
          </div>
          {t.support.length > 0 && <p className="mx-auto max-w-2xl text-sm">{t.support.join(" · ")}</p>}
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={() => downloadPoster(props, branding)}><Download className="mr-1 h-4 w-4" />Download poster</Button>
    </section>
  );
}
