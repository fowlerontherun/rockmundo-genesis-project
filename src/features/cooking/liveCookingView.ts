/**
 * The kitchen is display-only, but users with skewed device clocks should
 * still see an accurate session deadline after a server status refresh.
 * dataUpdatedAt is the locally observed arrival time of that status payload.
 */
export function serverAnchoredCookingNow(
  localNowMs: number,
  serverNowISO: string | undefined,
  statusReceivedAtMs: number,
): number {
  const serverNowMs = Date.parse(serverNowISO ?? "");
  if (!Number.isFinite(serverNowMs) || !Number.isFinite(statusReceivedAtMs)
      || statusReceivedAtMs <= 0) return localNowMs;
  // The anchor captures the remote/local clock offset at receipt time;
  // local elapsed time still advances correctly if the tab was suspended.
  return localNowMs + serverNowMs - statusReceivedAtMs;
}

/**
 * Read-only kitchen animation derived from server-timestamped accepted actions.
 * This is a DISPLAY PROJECTION, never the authority for food quality or rewards.
 */
export type CookingHeat = "off" | "low" | "medium" | "high";
export type CookingPosition = "tray" | "pan" | "plate";
export type CookingStage = "Raw" | "Cooking" | "Ready" | "Overdone" | "Burnt";

export interface CookingActionEvent {
  action_sequence: number;
  action_type: "heat" | "add" | "remove" | "finish" | "timeout";
  ingredient_slug: string | null;
  heat: CookingHeat | null;
  recorded_at: string;
}
export interface CookingWindow {
  ingredient_slug: string;
  ready_seconds: number;
  overdone_seconds: number;
  burnt_seconds: number;
}
export interface CookingIngredient {
  ingredient_slug: string;
  units_required: number;
}
export interface KitchenItem {
  slug: string;
  position: CookingPosition;
  seconds: number;
  stage: CookingStage;
  window: CookingWindow | null;
}
export interface KitchenView {
  heat: CookingHeat;
  items: KitchenItem[];
  remainingSeconds: number;
  allPlated: boolean;
}

const HEAT_RATE: Record<CookingHeat, number> = {
  off: 0, low: 0.65, medium: 1, high: 1.5,
};

function getStage(seconds: number, window: CookingWindow | null): CookingStage {
  if (!window) return seconds > 0 ? "Cooking" : "Raw";
  if (seconds >= window.burnt_seconds) return "Burnt";
  if (seconds >= window.overdone_seconds) return "Overdone";
  if (seconds >= window.ready_seconds) return "Ready";
  return seconds > 0 ? "Cooking" : "Raw";
}

export function projectKitchen(
  startedAt: string,
  expiresAt: string,
  ingredients: readonly CookingIngredient[],
  windows: readonly CookingWindow[],
  acceptedActions: readonly CookingActionEvent[],
  nowMs: number,
): KitchenView {
  const started = Date.parse(startedAt);
  const expires = Date.parse(expiresAt);
  const deadline = Number.isFinite(expires) ? expires : nowMs;
  const ending = Math.max(started, Math.min(nowMs, deadline));
  const items = new Map<string, { position: CookingPosition; seconds: number }>(
    ingredients.map((ingredient) => [ingredient.ingredient_slug, { position: "tray", seconds: 0 }]),
  );
  let heat: CookingHeat = "off";
  let previous = started;

  function advance(timestamp: number) {
    const elapsed = Math.max(0, (timestamp - previous) / 1000) * HEAT_RATE[heat];
    if (elapsed > 0) for (const item of items.values()) {
      if (item.position === "pan") item.seconds += elapsed;
    }
    previous = Math.max(previous, timestamp);
  }

  for (const action of [...acceptedActions].sort((a, b) => a.action_sequence - b.action_sequence)) {
    const timestamp = Date.parse(action.recorded_at);
    if (!Number.isFinite(timestamp) || timestamp < previous || timestamp > ending) continue;
    advance(timestamp);
    if (action.action_type === "heat" && action.heat && action.heat in HEAT_RATE) {
      heat = action.heat;
    } else if (action.ingredient_slug && items.has(action.ingredient_slug)) {
      const item = items.get(action.ingredient_slug)!;
      if (action.action_type === "add" && item.position === "tray") item.position = "pan";
      if (action.action_type === "remove" && item.position === "pan") item.position = "plate";
    }
  }
  if (Number.isFinite(ending) && ending >= previous) advance(ending);

  const viewItems = ingredients.map(({ ingredient_slug }) => {
    const item = items.get(ingredient_slug)!;
    const window = windows.find((window) => window.ingredient_slug === ingredient_slug) ?? null;
    return {
      slug: ingredient_slug,
      position: item.position,
      seconds: Math.round(item.seconds * 100) / 100,
      stage: getStage(item.seconds, window),
      window,
    };
  });
  return {
    heat: nowMs >= deadline ? "off" : heat,
    items: viewItems,
    remainingSeconds: Math.max(0, Math.ceil((deadline - nowMs) / 1000)),
    allPlated: viewItems.length > 0 && viewItems.every((item) => item.position === "plate"),
  };
}
