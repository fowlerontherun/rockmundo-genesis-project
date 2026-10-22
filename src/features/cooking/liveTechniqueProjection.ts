/**
 * Read-only visual projection for live oven, pot and drink sessions.
 * This can never authorize cooking results or inventory; SQL replay owns that.
 */
export type LiveTechniqueMethod = "oven" | "simmer" | "mix";
export type LiveTechniqueStage = "Raw" | "Warming" | "Ready" | "Overdone" | "Burnt" | "Unmixed" | "Mixing";
export interface TechniqueServerAction {
  action_sequence: number;
  action_type: string;
  ingredient_slug: string | null;
  heat: string | null;
  recorded_at: string;
}
export interface TechniqueVisualSnapshot {
  method: LiveTechniqueMethod;
  heat: "off" | "low" | "medium" | "high";
  loaded: string[];
  served: string[];
  stirs: number;
  exposure: number;
  stage: LiveTechniqueStage;
  deadlineSeconds: number;
}
const rates: Record<string, number> = { off: 0, low: .65, medium: 1, high: 1.5 };
const windows = { oven: [15,23,31], simmer: [12,20,30] } as const;

export function visualTechniqueStage(
  method: LiveTechniqueMethod, exposure: number, stirs: number,
): LiveTechniqueStage {
  if (method === "mix") return stirs>=3 ? "Ready" : stirs>0 ? "Mixing" : "Unmixed";
  const [ready,overdone,burnt]=windows[method];
  return exposure>=burnt ? "Burnt" : exposure>=overdone ? "Overdone" :
    exposure>=ready ? "Ready" : exposure>0 ? "Warming" : "Raw";
}

export function projectLiveTechnique(
  method: LiveTechniqueMethod,
  ingredients: readonly string[],
  actions: readonly TechniqueServerAction[],
  startedAt: string,
  expiresAt: string,
  serverNowMs: number,
  running: boolean,
): TechniqueVisualSnapshot {
  const start=Date.parse(startedAt), expiry=Date.parse(expiresAt);
  const loaded=new Set<string>(), served=new Set<string>();
  let heat: TechniqueVisualSnapshot["heat"]="off", rate=0, exposure=0, stirs=0;
  const doneAt=new Map<string,number>();
  let previous=Number.isFinite(start)?start:0;
  const cutoff=Math.max(previous,Math.min(serverNowMs,Number.isFinite(expiry)?expiry:serverNowMs));
  for(const a of [...actions].sort((x,y)=>x.action_sequence-y.action_sequence)){
    const time=Date.parse(a.recorded_at);
    if(!Number.isFinite(time)||time<previous||time>cutoff) continue;
    exposure+=Math.max(0,time-previous)/1000*rate;
    previous=time;
    if(a.action_type==="heat"&&a.heat&&a.heat in rates){
      heat=a.heat as TechniqueVisualSnapshot["heat"];
      rate=rates[heat];
    } else if(a.action_type==="add"&&a.ingredient_slug&&ingredients.includes(a.ingredient_slug)){
      loaded.add(a.ingredient_slug);
    } else if(a.action_type==="remove"&&a.ingredient_slug&&loaded.has(a.ingredient_slug)){
      served.add(a.ingredient_slug);
      doneAt.set(a.ingredient_slug,exposure);
    } else if(a.action_type==="stir"&&method==="mix"){
      stirs++;
    }
  }
  if(running && method!=="mix" && !actions.some(a=>a.action_type==="finish")){
    exposure+=Math.max(0,cutoff-previous)/1000*rate;
  }
  const current=loaded.size>0 && served.size===loaded.size && served.size>0
    ? Math.max(...doneAt.values()) : exposure;
  return {
    method,heat,loaded:[...loaded],served:[...served],stirs,
    exposure:Math.max(0,Math.round(current*10)/10),
    stage:visualTechniqueStage(method,current,stirs),
    deadlineSeconds:Math.max(0,Math.ceil((expiry-serverNowMs)/1000)),
  };
}
