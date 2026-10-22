import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { ChefHat, Flame, Utensils, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { FoodArt } from "./FoodArt";
import { projectKitchen, type CookingActionEvent, type CookingHeat, type CookingIngredient,
  type CookingPosition, type CookingWindow, type KitchenItem } from "./liveCookingView";
import "./cooking.css";

interface RecipeRow { slug: string; name: string; method: string; portions: number }
interface SessionRow {
  id: string;
  recipe_slug: string;
  mode: string;
  status: string;
  started_at: string;
  expires_at: string;
  finished_at: string | null;
  execution_score: number | null;
  result_batch_id: string | null;
}
interface GatewaySnapshot { session: SessionRow; actions: CookingActionEvent[] }
type GatewayAction = "start" | "status" | "heat" | "add" | "remove" | "finish";
interface GatewayRequest {
  action: GatewayAction;
  sessionId: string;
  recipeSlug?: string;
  heat?: CookingHeat;
  ingredientSlug?: string;
}
interface GatewayReply {
  status?: string;
  score?: number;
  batch_id?: string | null;
  error?: string;
  detail?: string;
}
const SERVICE_NAME = "cooking-session";
const heatChoices: CookingHeat[] = ["off", "low", "medium", "high"];
const prettify = (slug: string) => slug.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
function getArtId(slug: string): "onion" | "mushroom" | "pepper" | null {
  if (slug === "onion") return "onion";
  if (slug === "mushrooms") return "mushroom";
  if (slug === "peppers") return "pepper";
  return null;
}

async function callGateway<T>(body: GatewayRequest): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(SERVICE_NAME, { body });
  if (error) throw new Error(error.message || "Cooking service is unavailable");
  const response = data as T & GatewayReply;
  if (response && response.error) throw new Error(response.detail || response.error);
  return data as T;
}

function LiveIngredient({ item, selected, disabled, onSelect }: {
  item: KitchenItem; selected: boolean; disabled: boolean; onSelect: () => void;
}) {
  const { setNodeRef, attributes, listeners, transform, isDragging } = useDraggable({
    id: `ingredient:${item.slug}`, disabled,
  });
  const artId = getArtId(item.slug);
  return <button type="button" ref={setNodeRef} {...attributes} {...listeners}
    disabled={disabled} onClick={onSelect} aria-pressed={selected}
    aria-label={`${prettify(item.slug)}, ${item.position}, ${item.stage}`}
    className={`cooking-ingredient ${selected ? "cooking-selected" : ""}`}
    style={{ opacity: isDragging ? 0.35 : 1,
      transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined }}>
    {artId ? <FoodArt id={artId} stage={item.stage} /> :
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-900/15 text-xl" aria-hidden="true">🥘</span>}
    <span className="text-sm font-medium">{prettify(item.slug)}</span>
    <span className="text-xs">{item.stage}</span>
    {item.window && <span className="text-xs tabular-nums">{item.seconds.toFixed(1)}s</span>}
  </button>;
}
function LiveZone({ position, children, disabled, selectedItem, panFull, onMove }: {
  position: CookingPosition;
  children: ReactNode;
  disabled: boolean;
  selectedItem: KitchenItem | undefined;
  panFull: boolean;
  onMove: (position: CookingPosition) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `zone:${position}`, disabled });
  const title = position === "tray" ? "Ingredients" : position === "pan" ? "Cooking pan" : "Serving plate";
  const allow = Boolean(selectedItem && (
    (position === "pan" && selectedItem.position === "tray" && !panFull)
    || (position === "plate" && selectedItem.position === "pan")
  ));
  return <section ref={setNodeRef} aria-label={title}
    className={`cooking-zone cooking-${position} ${isOver ? "cooking-over" : ""}`}>
    <h3 className="mb-3 font-semibold">{title}</h3>
    <div className="cooking-zone-items">{children}</div>
    {position !== "tray" && <Button variant="secondary" className="mt-4 w-full"
      disabled={disabled || !allow} onClick={() => onMove(position)}>
      {position === "pan" ? "Add selected to pan" : "Plate selected ingredient"}
    </Button>}
  </section>;
}

/**
 * Production UI is gated by SERVER-ACTIVATED pan recipes.
 * Unlike the free practice kitchen, every move waits for the gateway's
 * confirmation before updating the accepted event stream.
 */
export function CookingLiveKitchen() {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [recipeSlug, setRecipeSlug] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const pendingStartKey = useRef<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const recipes = useQuery({
    queryKey: ["cooking-live-recipes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cooking_recipes").select("slug,name,method,portions")
        .eq("is_active", true).eq("method", "pan").order("name");
      if (error) throw error;
      return (data ?? []) as RecipeRow[];
    },
    staleTime: 30_000,
  });
  const active = useQuery({
    queryKey: ["cooking-active-session", profileId],
    enabled: Boolean(profileId),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cooking_sessions").select("id,recipe_slug")
        .eq("profile_id", profileId).in("status", ["pending", "running"])
        .order("started_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data as { id: string; recipe_slug: string } | null;
    },
    refetchOnMount: "always",
  });
  useEffect(() => {
    if (active.data?.id && !sessionId) setSessionId(active.data.id);
  }, [active.data?.id, sessionId]);

  const snapshot = useQuery({
    queryKey: ["cooking-session-snapshot", sessionId],
    enabled: Boolean(sessionId),
    queryFn: () => callGateway<GatewaySnapshot>({ action: "status", sessionId: sessionId! }),
    refetchInterval: (query) => {
      const status = query.state.data?.session.status;
      return !status || ["pending", "running"].includes(status) ? 2000 : false;
    },
    refetchOnWindowFocus: true,
  });
  const chosenSlug = snapshot.data?.session.recipe_slug ?? active.data?.recipe_slug ?? recipeSlug;
  const recipeData = useQuery({
    queryKey: ["cooking-recipe-components", chosenSlug],
    enabled: Boolean(chosenSlug),
    queryFn: async () => {
      const { data: ingredients, error: ingredientError } = await (supabase as any)
        .from("cooking_recipe_ingredients").select("ingredient_slug,units_required")
        .eq("recipe_slug", chosenSlug).order("ingredient_slug");
      if (ingredientError) throw ingredientError;
      const parts = (ingredients ?? []) as CookingIngredient[];
      const slugs = parts.map((part) => part.ingredient_slug);
      if (!slugs.length) return { ingredients: parts, windows: [] as CookingWindow[] };
      const { data: windows, error: windowError } = await (supabase as any)
        .from("cooking_ingredient_cook_windows")
        .select("ingredient_slug,ready_seconds,overdone_seconds,burnt_seconds")
        .in("ingredient_slug", slugs);
      if (windowError) throw windowError;
      return { ingredients: parts, windows: (windows ?? []) as CookingWindow[] };
    },
  });
  const mutation = useMutation({
    mutationFn: (request: GatewayRequest) => callGateway<GatewayReply>(request),
    onSuccess: async () => {
      setMessage(null);
      setSelected(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cooking-session-snapshot"] }),
        queryClient.invalidateQueries({ queryKey: ["cooking-active-session", profileId] }),
        queryClient.invalidateQueries({ queryKey: ["cooking-inventory", profileId] }),
      ]);
    },
    onError: (error: Error) => {
      setMessage(error.message);
      void queryClient.invalidateQueries({ queryKey: ["cooking-active-session", profileId] });
    },
  });
  const session = snapshot.data?.session;
  const running = Boolean(session && ["pending", "running"].includes(session.status));
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [running]);

  const view = session && recipeData.data
    ? projectKitchen(session.started_at, session.expires_at,
      recipeData.data.ingredients, recipeData.data.windows,
      snapshot.data?.actions ?? [], session.finished_at ? Math.min(now, Date.parse(session.finished_at)) : now)
    : null;
  const canAct = running && !mutation.isPending && Boolean(view?.remainingSeconds);
  const selectedItem = view?.items.find((item) => item.slug === selected);
  const panFull = (view?.items.filter((item) => item.position === "pan").length ?? 0) >= 2;

  async function start() {
    const slug = recipeSlug || recipes.data?.[0]?.slug;
    if (!slug || mutation.isPending || active.data?.id || running || !profileId) return;
    const id = pendingStartKey.current ?? crypto.randomUUID();
    pendingStartKey.current = id;
    try {
      await mutation.mutateAsync({ action: "start", sessionId: id, recipeSlug: slug });
      pendingStartKey.current = null;
      setSessionId(id);
      await queryClient.invalidateQueries({ queryKey: ["cooking-session-snapshot", id] });
    } catch {
      // A timed-out network response may have committed the start already;
      // retry with the same idempotency key until status is reconciled.
    }
  }

  function move(slug: string, to: CookingPosition) {
    if (!canAct || !view) return;
    const item = view.items.find((food) => food.slug === slug);
    if (!item) return;
    if (item.position === "tray" && to === "pan" && !panFull) {
      mutation.mutate({ action: "add", sessionId: sessionId!, ingredientSlug: slug });
    } else if (item.position === "pan" && to === "plate") {
      mutation.mutate({ action: "remove", sessionId: sessionId!, ingredientSlug: slug });
    }
  }
  const available = recipes.data ?? [];
  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><ChefHat className="h-5 w-5" />Live kitchen</CardTitle>
      <CardDescription>Cook using real ingredients when a recipe is activated. The server controls ingredient costs, doneness, expiry and rewards.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {!profileId && <p className="text-sm" role="status">Select your character to open the live kitchen.</p>}
      {(recipes.isLoading || active.isLoading) && <p role="status">Checking available recipes and saved cooking sessions…</p>}
      {(recipes.isError || active.isError || recipeData.isError || snapshot.isError) &&
        <p role="alert" className="text-sm text-destructive">Could not retrieve the live kitchen. Practice mode is still available.</p>}
      {!running && !session && !active.data?.id && !recipes.isLoading && !recipes.isError && available.length === 0 &&
        <p className="text-sm text-muted-foreground" role="status">
          No production pan recipes are enabled yet. You can use the free practice kitchen below without spending ingredients.
        </p>}
      {!session && available.length > 0 && !active.data?.id && <div className="space-y-3">
        <label htmlFor="cooking-live-recipe" className="block text-sm font-medium">Unlocked pan recipe</label>
        <select id="cooking-live-recipe" className="w-full rounded-md border bg-background p-2"
          value={recipeSlug || available[0].slug} onChange={(event) => setRecipeSlug(event.target.value)}>
          {available.map((recipe) => <option key={recipe.slug} value={recipe.slug}>{recipe.name} · {recipe.portions} portions</option>)}
        </select>
        <p className="text-xs text-muted-foreground">Starting reserves and consumes the required fresh ingredients. Burnt or abandoned dishes are not refunded.</p>
        <Button disabled={!profileId || mutation.isPending || Boolean(active.data?.id)} onClick={start}>
          Start cooking with ingredients
        </Button>
      </div>}
      {active.data?.id && !session && <p role="status">Restoring your active cooking session…</p>}
      {session && <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium">{prettify(session.recipe_slug)}</span>
          <span className="tabular-nums">{running ? `${view?.remainingSeconds ?? "…"} seconds remaining` : "Session ended"}</span>
          <span>{session.status}</span>
          <Button size="sm" variant="outline" disabled={snapshot.isFetching}
            onClick={() => void snapshot.refetch()}><RotateCcw className="mr-2 h-4 w-4" />Sync</Button>
        </div>
        {session.status === "completed" && <p role="status">Finished food saved to your inventory. Server score: {session.execution_score}/100.</p>}
        {session.status === "failed" && <p role="status">This dish was spoiled. Reserved ingredients were consumed; no food was awarded.</p>}
        {session.status === "timed_out" && <p role="status">Time ran out. This attempt cannot be resumed.</p>}
        {session.status === "cancelled" && <p role="status">This cooking session was cancelled.</p>}
        {!running && <Button type="button" variant="outline"
          onClick={() => { setSessionId(null); setSelected(null); setMessage(null); pendingStartKey.current = null;
            void queryClient.invalidateQueries({ queryKey: ["cooking-active-session", profileId] }); }}>
          Return to recipe selection
        </Button>}
        {view && <DndContext sensors={sensors} accessibility={{ screenReaderInstructions: {
          draggable: "Select an ingredient, then choose Add selected to pan or Plate selected ingredient. You can also drag ingredients into the pan or onto the plate.",
        } }} onDragEnd={({ active: drag, over }) => {
          const slug = String(drag.id).replace(/^ingredient:/, "");
          const target = String(over?.id ?? "").replace(/^zone:/, "") as CookingPosition;
          if (target === "pan" || target === "plate") move(slug, target);
        }}>
          <div className={`cooking-worktop ${view.heat !== "off" && running ? "cooking-heated" : ""}`}>
            {(["tray", "pan", "plate"] as const).map((position) =>
              <LiveZone key={position} position={position}
                disabled={!canAct} selectedItem={selectedItem} panFull={panFull}
                onMove={(target) => { if (selected) move(selected, target); }}>
                {view.items.filter((item) => item.position === position).map((item) =>
                  <LiveIngredient key={item.slug} item={item} selected={item.slug === selected}
                    disabled={!canAct} onSelect={() => setSelected(item.slug)} />)}
              </LiveZone>)}
          </div>
        </DndContext>}
        {view && <fieldset disabled={!canAct} className="space-y-2">
          <legend className="flex items-center gap-2 font-medium"><Flame className="h-4 w-4" />Pan heat</legend>
          <div className="flex flex-wrap gap-2">{heatChoices.map((heat) =>
            <label key={heat} className={`cooking-heat ${view.heat === heat ? "cooking-selected" : ""}`}>
              <input type="radio" name="live-cooking-heat" checked={view.heat === heat}
                onChange={() => mutation.mutate({ action: "heat", sessionId: sessionId!, heat })} />
              {heat === "off" ? "Heat off" : prettify(heat)}
            </label>)}</div>
        </fieldset>}
        <p className="text-xs text-muted-foreground">Displayed cooking colours and times are estimates derived from server-recorded actions. Only the server decides whether a batch succeeds.</p>
        <Button disabled={!canAct || !view?.allPlated}
          onClick={() => mutation.mutate({ action: "finish", sessionId: sessionId! })}>
          <Utensils className="mr-2 h-4 w-4" />Finish and serve
        </Button>
      </div>}
      {mutation.isPending && <p role="status" className="text-sm">Confirming cooking action with server…</p>}
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
    </CardContent>
  </Card>;
}
