import { useEffect, useReducer, useState, type ReactNode } from "react";
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { ChefHat, Flame, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FoodArt } from "./FoodArt";
import { doneness, initialPractice, PRACTICE_INGREDIENTS, practiceReducer, practiceResult, SESSION_MS,
  type Heat, type IngredientId, type Position, type PracticeItem } from "./practiceModel";
import "./cooking.css";

function Ingredient({ item, selected, disabled, onSelect }: {
  item: PracticeItem; selected: boolean; disabled: boolean; onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id, disabled });
  const spec = PRACTICE_INGREDIENTS.find(({ id }) => id === item.id)!;
  const stage = doneness(item);
  return <button ref={setNodeRef} type="button" {...attributes} {...listeners}
    disabled={disabled} onClick={onSelect} aria-pressed={selected}
    aria-label={`${spec.name}: ${stage}, ${item.position}`}
    className={`cooking-ingredient ${selected ? "cooking-selected" : ""}`}
    style={{ opacity: isDragging ? 0.3 : 1, transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined }}>
    <FoodArt id={item.id} stage={stage} />
    <span className="font-medium">{spec.name}</span>
    <span className="text-xs">{stage}</span>
    <span className="cooking-meter" aria-hidden="true"><span style={{ width: `${Math.min(100, item.cooked / spec.burnt * 100)}%` }} /></span>
  </button>;
}

function Zone({ id, title, children, onMove, disabled, actionDisabled, action }: {
  id: Position; title: string; children: ReactNode; onMove?: () => void; disabled?: boolean; actionDisabled?: boolean; action?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: id === "tray" || disabled });
  return <section ref={setNodeRef} aria-label={title} className={`cooking-zone cooking-${id} ${isOver ? "cooking-over" : ""}`}>
    <h3 className="mb-3 font-semibold">{title}</h3>
    <div className="cooking-zone-items">{children}</div>
    {onMove && <Button className="mt-4 w-full" variant="secondary" disabled={disabled || actionDisabled} onClick={onMove}>{action}</Button>}
  </section>;
}

export function CookingPractice() {
  const [state, dispatch] = useReducer(practiceReducer, undefined, initialPractice);
  const [selected, setSelected] = useState<IngredientId | null>(null);
  const [dragged, setDragged] = useState<IngredientId | null>(null);
  const [slower, setSlower] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const running = state.status === "cooking";
  const ended = state.status === "finished" || state.status === "timed-out";
  useEffect(() => {
    if (!running) return;
    const tick = () => dispatch({ type: "tick", now: Date.now() });
    const interval = window.setInterval(tick, 100);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", tick); document.removeEventListener("visibilitychange", tick); };
  }, [running]);
  const move = (id: IngredientId, to: Position) => {
    dispatch({ type: "move", id, to, now: Date.now() });
    setSelected(null);
  };
  const selectedItem = state.items.find(({ id }) => id === selected);
  const remaining = Math.max(0, Math.ceil((SESSION_MS * (state.slower ? 2 : 1) - (state.updatedAt - state.startedAt)) / 1000));
  const result = practiceResult(state);
  const stageSummary = state.items.map((item) => `${item.id}: ${doneness(item)}`).join(". ");
  return <div className="space-y-5">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ChefHat className="h-5 w-5" />Practice: golden vegetable pan</CardTitle>
        <CardDescription>Free tutorial ingredients. No money, inventory, boosts or XP are awarded or spent.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">Drag food into the pan, turn on the heat, then drag it onto the plate when it says Ready. Leave it too long and it will burn. You can also select an ingredient, then use the pan or plate button with touch or keyboard.</p>
        <div className="flex flex-wrap items-center gap-4">
          <Button disabled={running} onClick={() => { setSelected(null); dispatch({ type: "start", slower, now: Date.now() }); }}>
            {state.status === "idle" ? "Start practice" : "Practise again"}
          </Button>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={slower} disabled={running} onChange={(event) => setSlower(event.target.checked)} />Slower timing (double the reaction time)</label>
          {running && <span className="text-sm tabular-nums">{remaining}s remaining</span>}
        </div>
        <p className="text-xs text-muted-foreground">At medium heat: onion is ready at 12–16s, mushroom at 18–23s, pepper at 9–13s. Each timer starts when that ingredient enters the heated pan. Slower timing doubles these times.</p>
        <p className="text-xs text-muted-foreground">Heat continues if you switch tabs. Turn it off before stepping away. Practice resets when you leave this page.</p>
      </CardContent>
    </Card>

    <DndContext sensors={sensors} accessibility={{ screenReaderInstructions: {
      draggable: "Select an ingredient with Enter or Space, then activate the pan or plate button to move it. Pointer users can drag ingredients between surfaces.",
    } }} onDragStart={({ active }) => setDragged(active.id as IngredientId)}
      onDragCancel={() => setDragged(null)} onDragEnd={({ active, over }) => {
        setDragged(null);
        if (running && (over?.id === "pan" || over?.id === "plate")) move(active.id as IngredientId, over.id);
      }}>
      <div className={`cooking-worktop ${running && state.heat !== "off" ? "cooking-heated" : ""}`}>
        {(["tray", "pan", "plate"] as const).map((position) => <Zone key={position} id={position}
          title={position === "tray" ? "Ingredients" : position === "pan" ? "Cooking pan" : "Serving plate"}
          action={position === "pan" ? "Add selected ingredient to pan" : "Plate selected ingredient"}
          disabled={!running} actionDisabled={!selectedItem || selectedItem.position === position}
          onMove={position === "tray" ? undefined : () => selected && move(selected, position)}>
          {state.items.filter((item) => item.position === position).map((item) =>
            <Ingredient key={item.id} item={item} selected={selected === item.id} disabled={!running} onSelect={() => setSelected(item.id)} />)}
        </Zone>)}
      </div>
      <DragOverlay>{dragged && <div className="cooking-drag-preview"><FoodArt id={dragged} stage={doneness(state.items.find(({ id }) => id === dragged)!)} /></div>}</DragOverlay>
    </DndContext>

    <Card>
      <CardContent className="space-y-4 pt-5">
        <fieldset disabled={!running} className="space-y-2">
          <legend className="mb-2 flex items-center gap-2 font-medium"><Flame className="h-4 w-4" />Pan heat</legend>
          <div className="flex flex-wrap gap-2">{(["off", "low", "medium", "high"] as Heat[]).map((heat) =>
            <label key={heat} className={`cooking-heat ${state.heat === heat ? "cooking-selected" : ""}`}>
              <input type="radio" name="cooking-heat" value={heat} checked={state.heat === heat}
                onChange={() => dispatch({ type: "heat", heat, now: Date.now() })} />
              {heat === "off" ? "Heat off" : `${heat.charAt(0).toUpperCase()}${heat.slice(1)}`}
            </label>)}</div>
        </fieldset>
        <p className="text-sm" role="status" aria-live="polite" aria-atomic="true">{stageSummary}</p>
        <Button disabled={!running || state.items.some((item) => item.position !== "plate")}
          onClick={() => dispatch({ type: "finish", now: Date.now() })}><Utensils className="mr-2 h-4 w-4" />Finish plating</Button>
        {ended && <div role="status" className="rounded-lg border p-4">
          <h3 className="font-semibold">{state.status === "timed-out" ? "Practice time ended" : result.label}</h3>
          <p className="text-sm">Execution score: {result.score}/100. {result.score === 0 ? "All ingredients must be plated and fully cooked; a burnt ingredient ruins this practice dish." : "Ready ingredients earn full marks; overdone ingredients earn fewer marks."}</p>
          <p className="mt-2 text-xs text-muted-foreground">This was a practice batch. No food items or character rewards were created.</p>
        </div>}
      </CardContent>
    </Card>
  </div>;
}
