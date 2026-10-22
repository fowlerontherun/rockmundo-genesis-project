import type { Doneness, IngredientId } from "./practiceModel";

const PALETTES: Record<Doneness, [string, string]> = {
  Raw: ["#f9e5ad", "#a77d98"], Cooking: ["#e6c679", "#b99756"],
  Ready: ["#e5a137", "#975b25"], Overdone: ["#925328", "#58301a"],
  Burnt: ["#302722", "#141210"],
};

export function FoodArt({ id, stage }: { id: IngredientId | "rice" | "soy-seasoning"; stage: Doneness }) {
  const [fill, edge] = PALETTES[stage];
  return (
    <svg viewBox="0 0 100 70" className="h-14 w-20 shrink-0" aria-hidden="true">
      <ellipse cx="50" cy="60" rx="34" ry="5" fill="#000" opacity=".18" />
      {id === "onion" && <g fill={fill} stroke={edge} strokeWidth="3">
        <ellipse cx="38" cy="34" rx="23" ry="18" transform="rotate(-20 38 34)" />
        <ellipse cx="38" cy="34" rx="15" ry="11" fill="none" transform="rotate(-20 38 34)" />
        <ellipse cx="63" cy="44" rx="23" ry="18" transform="rotate(15 63 44)" />
        <ellipse cx="63" cy="44" rx="15" ry="11" fill="none" transform="rotate(15 63 44)" />
      </g>}
      {id === "mushroom" && <g stroke={edge} strokeWidth="3" strokeLinejoin="round">
        <path d="M42 34 L39 58 Q50 64 61 58 L58 34" fill={fill} />
        <path d="M14 37 C16 2 84 2 86 37 Q51 52 14 37Z" fill={stage === "Raw" ? "#c8aa87" : fill} />
        <path d="M24 38 Q50 47 76 38" fill="none" />
      </g>}
      {id === "pepper" && <g fill={stage === "Raw" ? "#dc5936" : stage === "Cooking" ? "#c76732" : fill} stroke={edge} strokeWidth="3">
        <path d="M13 24 Q39 10 45 24 L38 57 L23 59 L28 29Z" />
        <path d="M50 17 Q76 9 87 28 L76 56 L64 53 L71 28Z" />
      </g>}
      {id === "rice" && <g fill={stage === "Raw" ? "#efe7d7" : fill} stroke={edge} strokeWidth="1.5">
        <path d="M14 45 Q49 9 86 43 L81 56 Q50 65 18 55Z" opacity=".65" />
        <ellipse cx="29" cy="37" rx="7" ry="3" transform="rotate(-19 29 37)" />
        <ellipse cx="47" cy="28" rx="7" ry="3" transform="rotate(18 47 28)" />
        <ellipse cx="67" cy="35" rx="7" ry="3" transform="rotate(-14 67 35)" />
        <ellipse cx="39" cy="44" rx="7" ry="3" transform="rotate(25 39 44)" />
        <ellipse cx="57" cy="48" rx="7" ry="3" transform="rotate(-24 57 48)" />
        <ellipse cx="74" cy="47" rx="6" ry="3" transform="rotate(20 74 47)" />
        <ellipse cx="25" cy="48" rx="5" ry="2.5" transform="rotate(22 25 48)" />
      </g>}
      {id === "soy-seasoning" && <g stroke={edge} strokeWidth="2.5"
        fill={stage === "Raw" ? "#513626" : stage === "Cooking" ? "#6b402b" : fill}>
        <path d="M12 44 Q22 30 34 36 Q47 11 58 32 Q77 24 87 44 Q91 57 75 58 L28 58 Q11 56 12 44Z" />
        <ellipse cx="37" cy="43" rx="8" ry="4" opacity=".6" stroke="none" fill="#b18a65" />
        <ellipse cx="63" cy="46" rx="7" ry="3" opacity=".45" stroke="none" fill="#b18a65" />
        <path d="M52 22 Q57 16 60 11" strokeWidth="3" fill="none" />
      </g>}
      {stage === "Burnt" && <g stroke="#c9c4bc" fill="none" strokeWidth="3" opacity=".8">
        <path d="M40 22 Q30 15 40 5" /><path d="M59 19 Q69 12 60 2" />
      </g>}
    </svg>
  );
}
