import { DishIllustration } from "./CookingIllustrations";
import type { FoodVisualStage } from "./cookingVisualCatalogue";
import type { TechniqueMethod } from "./techniquePracticeModel";

/** Illustrated workstations use visual state only: no simulation or reward logic. */
export function CookingEquipmentScene({ method, recipeSlug, stage, heating, hasIngredients, stirring }: {
  method: TechniqueMethod;
  recipeSlug: string;
  stage: FoodVisualStage;
  heating: boolean;
  hasIngredients: boolean;
  stirring: boolean;
}) {
  return <div className={"cooking-equipment-scene cooking-equipment-" + method +
    (heating ? " cooking-equipment-active" : "") + (stirring ? " cooking-equipment-stirring" : "")}
    data-testid="cooking-equipment-scene" data-method={method} data-stage={stage}>
    <svg className="cooking-equipment-outline" viewBox="0 0 320 225" aria-hidden="true">
      <defs>
        <linearGradient id={"cooking-equipment-" + method + "-metal"} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#d4d2cb"/><stop offset=".55" stopColor="#777b80"/>
          <stop offset="1" stopColor="#343c49"/>
        </linearGradient>
      </defs>
      {method === "oven" && <g>
        <rect x="15" y="12" width="290" height="205" rx="19" fill="#4a5059" stroke="#aeb3b9" strokeWidth="7"/>
        <rect x="29" y="24" width="262" height="39" rx="6" fill="#242a36"/>
        {[70,113,156].map((x,i) => <g key={x}>
          <circle cx={x} cy="44" r="11" fill="#a7a8a7" stroke="#dad8d3" strokeWidth="3"/>
          <path d={i%2===0 ? "M"+x+" 44 v-6" : "M"+x+" 44 l7 -5"} stroke="#363b43" strokeWidth="3"/>
        </g>)}
        <rect x="231" y="33" width="45" height="23" rx="4" fill={heating ? "#c5654e" : "#596c6c"}/>
        <rect x="40" y="77" width="240" height="125" rx="9" fill="#171e28" stroke="#c7c8c6" strokeWidth="6"/>
        <rect x="51" y="88" width="218" height="102" rx="6" fill={heating ? "#965e48" : "#39424b"}/>
        <path d="M58 177 L263 177" stroke="#afb5b6" strokeWidth="7"/>
        <path d="M69 107 L251 107" stroke="#f5f0db" opacity=".16" strokeWidth="8"/>
      </g>}
      {method === "simmer" && <g>
        <rect x="32" y="190" width="256" height="21" rx="8" fill="#3d3e42"/>
        <rect x="54" y="160" width="214" height="27" rx="8" fill="#9eabb0" stroke="#53545a" strokeWidth="5"/>
        <path d="M78 89 L247 89 L228 175 Q159 196 96 175Z"
          fill="url(#cooking-equipment-simmer-metal)" stroke="#cad3d4" strokeWidth="7"/>
        <path d="M79 95 L50 92 Q21 102 47 126 L77 122" fill="none" stroke="#adb7bd" strokeWidth="12"/>
        <path d="M246 95 L272 93 Q300 106 274 128 L246 122" fill="none" stroke="#adb7bd" strokeWidth="12"/>
        <ellipse cx="160" cy="93" rx="87" ry="22" fill={heating ? "#c67c47" : "#8faaa3"} stroke="#f1eee4" strokeWidth="8"/>
        <circle cx="109" cy="86" r="10" fill="#719e62"/><circle cx="154" cy="102" r="13" fill="#ebba6b"/>
        <circle cx="195" cy="84" r="12" fill="#9e8e59"/>
        {heating && <path d="M100 202 Q110 189 123 205 M149 204 Q165 185 177 203 M197 201 Q209 190 221 201"
          fill="none" stroke="#ee9c5b" strokeWidth="5"/>}
      </g>}
      {method === "mix" && <g>
        <path d="M90 20 L221 20 L207 196 Q159 217 107 196Z"
          fill="#cce7ea" opacity=".72" stroke="#c7ebed" strokeWidth="8"/>
        <path d="M101 82 L211 82 L204 187 Q159 205 113 189Z"
          fill="#e0a96c" opacity=".75"/>
        <path d="M219 51 Q293 42 279 105 Q277 129 222 129"
          fill="none" stroke="#c7ebed" strokeWidth="15"/>
        <path d="M160 8 L169 67" stroke="#efe9cf" strokeWidth="8" strokeLinecap="round"/>
        <path d="M130 103 Q159 83 189 103" fill="none" stroke="#f3d7a7" strokeWidth="5"/>
        <circle cx="132" cy="147" r="14" fill="#d65e61"/><circle cx="181" cy="132" r="15" fill="#edc257"/>
        <path d="M127 132 Q132 119 143 128" fill="none" stroke="#598f68" strokeWidth="6"/>
        <path d="M118 189 Q158 205 202 189" fill="none" stroke="#fff" opacity=".6" strokeWidth="5"/>
      </g>}
    </svg>
    <div className={"cooking-equipment-food" + (hasIngredients ? "" : " cooking-equipment-empty")}>
      {hasIngredients ? <DishIllustration recipeSlug={recipeSlug} stage={stage} className="h-full w-full" />
        : <span className="text-sm font-medium">Add recipe ingredients</span>}
    </div>
    {(heating || stirring) && <div className="cooking-equipment-steam" aria-hidden="true">
      <span /><span /><span />
    </div>}
  </div>;
}

const PREPARATION_STAGES = ["Raw", "Warming", "Ready", "Overdone", "Burnt"] as const;
export function CookingStageGuide({ stage, compact = false }: {
  stage: FoodVisualStage; compact?: boolean;
}) {
  return <div className={"cooking-stage-guide" + (compact ? " cooking-stage-guide-compact" : "")}
    aria-label={"Cooking progress: " + stage}>
    {PREPARATION_STAGES.map(value => <div key={value}
      className={"cooking-stage-step cooking-stage-" + value.toLowerCase() +
        (stage === value || (stage === "Cooking" && value === "Warming") ? " cooking-stage-current" : "")}
      aria-current={stage === value || (stage === "Cooking" && value === "Warming") ? "step" : undefined}>
      <span aria-hidden="true" className="cooking-stage-dot" />
      <span>{value}</span>
    </div>)}
  </div>;
}
