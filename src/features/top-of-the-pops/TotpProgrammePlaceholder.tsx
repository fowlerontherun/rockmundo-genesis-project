import { Radio, Tv2 } from "lucide-react";

export function TotpProgrammePlaceholder({ label = "Preparing the programme" }: { label?: string }) {
  return (
    <section
      className="relative flex aspect-video min-h-[18rem] items-center justify-center overflow-hidden rounded-xl border bg-slate-950 text-white"
      aria-label={label}
      aria-busy="true"
      data-totp-programme-placeholder
    >
      <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_30%_30%,rgba(34,211,238,.16),transparent_32%),radial-gradient(circle_at_70%_68%,rgba(217,70,239,.16),transparent_36%)]" />
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-fuchsia-500 via-amber-300 to-cyan-400" />
      <div className="relative w-[min(38rem,82%)] space-y-5 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10">
          <Tv2 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">Top of the Pops</p>
          <h2 className="mt-2 text-xl font-black">{label}</h2>
        </div>
        <div className="mx-auto grid max-w-md gap-2" aria-hidden="true">
          <div className="h-3 animate-pulse rounded-full bg-white/15" />
          <div className="mx-auto h-3 w-4/5 animate-pulse rounded-full bg-white/10" />
          <div className="mx-auto mt-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/50">
            <Radio className="h-3.5 w-3.5" /> London television centre
          </div>
        </div>
      </div>
      <span className="sr-only">The television programme is loading. Controls and programme content will appear when ready.</span>
    </section>
  );
}

export default TotpProgrammePlaceholder;
