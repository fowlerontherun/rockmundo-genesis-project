import { useEffect, useReducer, useState } from "react";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { ChefHat, Flame, GlassWater, Soup, CakeSlice, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { allTechniqueIngredientsAdded, initialTechniquePractice, techniquePracticeResult,
  techniqueReducer, techniqueStage, TECHNIQUE_PRACTICE_RECIPES, TECHNIQUE_SESSION_MS,
  type TechniqueHeat, type TechniqueMethod } from "./techniquePracticeModel";
import { IngredientIllustration } from "./CookingIllustrations";
import { CookingEquipmentScene, CookingStageGuide } from "./CookingEquipmentScene";
import "./cooking.css";

const LABELS: Record<TechniqueMethod, { label: string; vessel: string; action: string; emoji: string }> = {
  oven: { label: "Baking", vessel: "Mixing bowl", action: "Put mixture in the oven", emoji: "🥧" },
  simmer: { label: "Soups & stews", vessel: "Soup pot", action: "Start simmering", emoji: "🍲" },
  mix: { label: "Drinks", vessel: "Mixing jug", action: "Stir ingredients", emoji: "🥤" },
};
const METHODS: TechniqueMethod[] = ["oven", "simmer", "mix"];
const HEAT: TechniqueHeat[] = ["off", "low", "medium", "high"];

function PracticeIngredient({ name, disabled, selected, onSelect }: {
  name: string; disabled: boolean; selected: boolean; onSelect: () => void;
}) {
  const { setNodeRef, attributes, listeners, transform, isDragging } = useDraggable({
    id: `technique:${name}`, disabled,
  });
  return <button type="button" ref={setNodeRef} {...attributes} {...listeners}
    disabled={disabled} aria-label={`Select ${name}`} aria-pressed={selected}
    onClick={onSelect}
    className={`cooking-ingredient ${selected ? "cooking-selected" : ""}`}
    style={{
      opacity: isDragging ? 0.3 : 1,
      transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined,
    }}>
    <IngredientIllustration slug={name} />
    <span className="text-sm font-medium">{name}</span>
  </button>;
}
function TechniqueVessel({ method, recipeSlug, items, stage, heating, stirCount }: {
  method: TechniqueMethod; recipeSlug: string; items: string[];
  stage: ReturnType<typeof techniqueStage>; heating: boolean; stirCount: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "technique-vessel" });
  const spec = LABELS[method];
  return <section ref={setNodeRef} aria-label={spec.vessel}
    className={`cooking-technique-vessel cooking-technique-${method} ${isOver ? "cooking-over" : ""}`}>
    <h4 className="font-semibold">{heating ? (method === "oven" ? "Baking in oven" : "Simmering in pot") : spec.vessel}</h4>
    <CookingEquipmentScene method={method} recipeSlug={recipeSlug} stage={stage}
      heating={heating} hasIngredients={items.length > 0} stirring={method === "mix" && stirCount > 0} />
    <p className="text-sm font-semibold">Current stage: {stage}</p>
    <p className="text-sm">{items.length ? items.join(" · ") : "Drop recipe ingredients here"}</p>
  </section>;
}

export function CookingTechniquePractice() {
  const [state, dispatch] = useReducer(techniqueReducer, undefined, initialTechniquePractice);
  const [selected, setSelected] = useState<string | null>(null);
  const [slower, setSlower] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const recipe = TECHNIQUE_PRACTICE_RECIPES.find(item => item.slug === state.recipeSlug)!;
  const spec = LABELS[state.method];
  const running = state.status === "running";
  const allAdded = allTechniqueIngredientsAdded(state);
  const stage = techniqueStage(state);
  const score = techniquePracticeResult(state);
  const remaining = running
    ? Math.max(0, Math.ceil((TECHNIQUE_SESSION_MS * (state.slower ? 2 : 1) -
      (state.updatedAt - state.startedAt)) / 1000))
    : 0;
  useEffect(() => {
    if (!running) return;
    const tick = () => dispatch({ type: "tick", now: Date.now() });
    const interval = window.setInterval(tick, 200);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [running]);

  const addIngredient = (name: string) => {
    dispatch({ type: "add", ingredient: name, now: Date.now() });
    setSelected(null);
  };
  const selectRecipe = (slug: string) => {
    setSelected(null);
    dispatch({ type: "select", recipeSlug: slug });
  };

  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><ChefHat className="h-5 w-5" />Cooking techniques workshop</CardTitle>
      <CardDescription>
        Practise baking pies and cakes, simmering soups, and mixing drinks with
        different cooking surfaces. Free simulation only: no ingredient purchases,
        food, cash, boosts or XP are created.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Choose cooking technique">
        {METHODS.map(method => <Button key={method} type="button" size="sm"
          variant={state.method === method ? "default" : "outline"}
          aria-pressed={state.method === method} disabled={running}
          onClick={() => selectRecipe(TECHNIQUE_PRACTICE_RECIPES.find(item => item.method === method)!.slug)}>
          {method === "oven" ? <CakeSlice className="mr-2 h-4 w-4" /> :
            method === "simmer" ? <Soup className="mr-2 h-4 w-4" /> :
              <GlassWater className="mr-2 h-4 w-4" />}
          {LABELS[method].label}
        </Button>)}
      </div>
      <label htmlFor="cooking-technique-recipe" className="block space-y-1 text-sm font-medium">
        Practice recipe
        <select id="cooking-technique-recipe" value={state.recipeSlug}
          disabled={running} onChange={event => selectRecipe(event.target.value)}
          className="block w-full rounded-md border bg-background p-2">
          {TECHNIQUE_PRACTICE_RECIPES.filter(item => item.method === state.method)
            .map(item => <option key={item.slug} value={item.slug}>{item.name} · {item.portions} portions</option>)}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="button" disabled={running} onClick={() => {
          setSelected(null);
          dispatch({ type: "start", now: Date.now(), slower });
        }}>{state.status === "idle" ? "Start technique practice" : "Try this recipe again"}</Button>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={slower} disabled={running}
            onChange={event => setSlower(event.target.checked)} />
          Slower practice timing
        </label>
        {running && <span className="text-sm tabular-nums">{remaining}s remaining</span>}
      </div>
      <p className="text-sm text-muted-foreground">
        {state.method === "oven"
          ? "Put all ingredients into the bowl, begin baking, and remove the mixture when it turns golden. Too long in the oven burns it."
          : state.method === "simmer"
            ? "Fill the pot, start simmering, then serve at the right colour. Heat keeps cooking while the pot is on."
            : "Drop all drink ingredients in the jug and stir three to five times. Drinks do not need heat or a frying pan."}
        {" "}Choose an ingredient and press the add button if you prefer touch or keyboard to dragging.
      </p>
      <DndContext sensors={sensors} onDragEnd={({ active, over }) => {
        if (running && over?.id === "technique-vessel") {
          addIngredient(String(active.id).replace(/^technique:/, ""));
        }
      }}>
        <div className="grid gap-4 md:grid-cols-2">
          <section aria-label="Practice ingredient tray"
            className="cooking-zone cooking-tray">
            <h4 className="mb-3 font-semibold">Recipe ingredient tray</h4>
            <div className="cooking-zone-items">
              {state.ingredients.filter(item => !item.inVessel).map(item =>
                <PracticeIngredient key={item.name} name={item.name} disabled={!running}
                  selected={selected === item.name}
                  onSelect={() => setSelected(item.name)} />)}
              {state.ingredients.every(item => item.inVessel) &&
                <p className="text-sm">All ingredients placed.</p>}
            </div>
            <Button type="button" size="sm" variant="secondary" className="mt-3 w-full"
              disabled={!running || state.vessel !== "preparing" || !selected}
              onClick={() => selected && addIngredient(selected)}>
              Add selected to {spec.vessel.toLowerCase()}
            </Button>
          </section>
          <TechniqueVessel method={state.method} recipeSlug={state.recipeSlug}
            items={state.ingredients.filter(item => item.inVessel).map(item => item.name)}
            stage={stage} heating={state.vessel === "heating"} stirCount={state.stirCount} />
        </div>
      </DndContext>
      {state.method !== "mix" && <CookingStageGuide stage={stage} />}
      {state.method !== "mix" && <div className="space-y-3">
        <Button type="button" disabled={!running || !allAdded || state.vessel !== "preparing"}
          onClick={() => dispatch({ type: "begin", now: Date.now() })}>
          {spec.action}
        </Button>
        {state.vessel === "heating" && <fieldset className="space-y-2">
          <legend className="flex items-center gap-2 font-medium">
            <Flame className="h-4 w-4" />Cooking heat
          </legend>
          <div className="flex flex-wrap gap-2">
            {HEAT.map(heat => <label key={heat}
              className={`cooking-heat ${state.heat === heat ? "cooking-selected" : ""}`}>
              <input type="radio" name="cooking-technique-heat"
                checked={state.heat === heat}
                onChange={() => dispatch({ type: "heat", heat, now: Date.now() })} />
              {heat === "off" ? "Heat off" : heat.charAt(0).toUpperCase() + heat.slice(1)}
            </label>)}
          </div>
        </fieldset>}
        <p role="status" className="text-sm">
          {state.vessel === "heating" || state.vessel === "served"
            ? `Time on heat: ${state.exposureSeconds.toFixed(1)} equivalent seconds · ${stage}`
            : "Add every ingredient before starting the heat."}
        </p>
        <Button type="button" variant="outline"
          disabled={!running || state.vessel !== "heating"}
          onClick={() => dispatch({ type: "remove", now: Date.now() })}>
          {state.method === "oven" ? "Remove from oven" : "Serve from pot"}
        </Button>
      </div>}
      {state.method === "mix" && <div className="space-y-2">
        <Button type="button" disabled={!running || !allAdded || state.stirCount >= 8}
          onClick={() => dispatch({ type: "stir", now: Date.now() })}>
          <GlassWater className="mr-2 h-4 w-4" />Stir drink
        </Button>
        <p role="status" className="text-sm">Mixing: {state.stirCount}/5 stirs recommended · {stage}</p>
      </div>}
      <Button type="button"
        disabled={!running || !allAdded ||
          !(state.vessel === "served" || (state.method === "mix" && state.stirCount >= 3))}
        onClick={() => dispatch({ type: "finish", now: Date.now() })}>
        <Utensils className="mr-2 h-4 w-4" />Finish practice dish
      </Button>
      {state.status === "finished" && <div role="status" className="rounded-lg border p-4">
        <h4 className="font-semibold">{score.label}</h4>
        <p className="text-sm">Practice execution: {score.score}/100. {recipe.name} was simulated, not crafted.</p>
        <p className="text-xs text-muted-foreground">No ingredients or rewards were spent or granted. Live oven, simmer and drink recipes remain locked until server validation is complete.</p>
      </div>}
      {state.status === "timed-out" && <p role="status" className="text-sm font-medium">
        Practice time expired. No food or rewards were created; start again to retry.
      </p>}
    </CardContent>
  </Card>;
}
