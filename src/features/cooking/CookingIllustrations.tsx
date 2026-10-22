import { useId } from "react";
import { ingredientVisual, dishShape, dishSurfaceColor, type FoodVisualStage } from "./cookingVisualCatalogue";

/** Self-contained, lightweight game art. No external image URLs or server calls. */
export function IngredientIllustration({ slug, size = "medium" }: {
  slug: string; size?: "small" | "medium" | "large";
}) {
  const g = useId().replace(/:/g, "");
  const { form, color, accent } = ingredientVisual(slug);
  const width = size === "small" ? "h-11 w-14" : size === "large" ? "h-24 w-28" : "h-16 w-20";
  return <svg data-testid="cooking-ingredient-art" data-ingredient={slug}
    role="img" aria-label={slug.replace(/-/g, " ") + " ingredient illustration"}
    viewBox="0 0 120 95" className={width + " shrink-0"}>
    <defs><radialGradient id={g} cx="28%" cy="20%" r="88%">
      <stop stopColor={accent} /><stop offset=".75" stopColor={color} />
      <stop offset="1" stopColor="#624c42" />
    </radialGradient></defs>
    <ellipse cx="60" cy="84" rx="43" ry="7" fill="#21192a" opacity=".16" />
    {(form === "fruit" || form === "root" || form === "pepper") && <g>
      <path d={form === "root" ? "M32 31 Q10 45 40 81 Q65 74 58 32Z" :
        "M22 45 Q12 22 43 24 Q60 21 68 45 Q77 71 50 77 Q20 79 22 45Z"}
        fill={"url(#" + g + ")"} stroke="#906849" strokeWidth="2.5" />
      <path d={form === "root" ? "M68 30 Q47 44 73 82 Q99 76 95 30Z" :
        "M66 43 Q63 21 90 25 Q112 31 102 61 Q95 84 73 72Z"}
        fill={"url(#" + g + ")"} stroke="#906849" strokeWidth="2.5" />
      <path d="M47 31 Q45 17 56 11 M82 30 Q91 12 100 17" fill="none"
        stroke="#699562" strokeWidth="7" strokeLinecap="round" />
      <path d="M30 45 Q35 37 45 39" fill="none" stroke="#fff4d6" strokeWidth="4" opacity=".65" />
    </g>}
    {form === "mushroom" && <g stroke="#745a48" strokeWidth="2.5">
      <path d="M37 46 L39 73 Q53 82 65 72 L62 46Z" fill="#f6e5c6" />
      <path d="M16 48 Q20 10 55 14 Q87 16 90 48 Q53 59 16 48Z" fill={"url(#" + g + ")"} />
      <path d="M80 52 L79 75 Q93 81 100 71 L97 52Z" fill="#f3dfbd" />
      <path d="M66 52 Q66 29 88 29 Q112 31 114 51Z" fill={color} />
    </g>}
    {form === "leaf" && <g stroke="#4b7450" strokeWidth="2">
      <path d="M60 80 L60 17" strokeWidth="5" />
      <path d="M57 40 Q12 2 20 47 Q31 65 57 40Z" fill={"url(#" + g + ")"} />
      <path d="M64 56 Q107 13 109 49 Q96 70 64 56Z" fill={"url(#" + g + ")"} />
      <path d="M54 69 Q23 45 17 73 Q33 95 54 69Z" fill={color} />
      <path d="M73 22 Q68 2 91 11 Q103 30 73 22Z" fill={accent} />
    </g>}
    {(form === "bean" || form === "grain" || form === "powder") && <g>
      <path d="M23 43 L99 43 L91 76 Q61 90 31 76Z" fill="#b38c6c" stroke="#846445" strokeWidth="3" />
      <ellipse cx="61" cy="43" rx="39" ry="18" fill={"url(#" + g + ")"} />
      {form !== "powder" && Array.from({ length: 10 }, (_, i) =>
        <ellipse key={i} cx={28+(i%5)*16} cy={38+Math.floor(i/5)*17}
          rx={form === "bean" ? 8 : 6} ry={form === "bean" ? 5 : 3}
          fill={i%2 ? color : accent} stroke="#9b7353" strokeWidth=".9" />)}
      {form === "powder" && <path d="M31 43 Q61 22 89 43" stroke="#fff9eb" fill="none" strokeWidth="4" />}
    </g>}
    {form === "egg" && <g>
      <ellipse cx="45" cy="51" rx="23" ry="34" fill={"url(#" + g + ")"} stroke="#b5a28b" strokeWidth="2" />
      <ellipse cx="80" cy="52" rx="25" ry="33" fill="#f5e7ca" stroke="#baab90" strokeWidth="2" />
      <ellipse cx="84" cy="51" rx="12" ry="15" fill="#ecb959" opacity=".75" />
    </g>}
    {(["dairy","bottle","liquid"] as const).includes(form as "dairy" | "bottle" | "liquid") && <g>
      <path d="M44 29 L50 22 L50 13 L72 13 L72 22 L79 29 L81 77 Q59 87 39 77Z"
        fill="#c7d9d8" stroke="#687988" strokeWidth="3" />
      <path d="M44 43 L76 43 L77 73 Q60 81 44 73Z" fill={"url(#" + g + ")"} />
      <path d="M48 13 L75 13" stroke="#e9eee9" strokeWidth="8" />
      <path d="M50 31 L50 69" stroke="#fff" strokeWidth="6" opacity=".6" />
    </g>}
  </svg>;
}

export function DishIllustration({ recipeSlug, stage = "Ready", className = "h-32 w-full" }: {
  recipeSlug: string; stage?: FoodVisualStage; className?: string;
}) {
  const shape = dishShape(recipeSlug);
  const id = useId().replace(/:/g, "");
  const fill = dishSurfaceColor(stage);
  const drink = shape === "drink", soup = shape === "soup" || shape === "stew";
  return <svg role="img" aria-label={recipeSlug.replace(/-/g," ") + " " + stage.toLowerCase() + " dish illustration"}
    data-testid="cooking-dish-art" data-dish={recipeSlug}
    viewBox="0 0 240 160" className={className}>
    <defs><radialGradient id={id}><stop stopColor="#f6ebd7" /><stop offset="1" stopColor="#bd987d"/></radialGradient></defs>
    <rect width="240" height="160" rx="18" fill={"url(#" + id + ")"} />
    <ellipse cx="120" cy="141" rx="89" ry="11" fill="#3e342b" opacity=".18" />
    {!drink && <g>
      <ellipse cx="120" cy="108" rx="88" ry="43" fill="#eee6dc" stroke="#b8a89a" strokeWidth="3" />
      <ellipse cx="120" cy="104" rx="71" ry="31" fill="#fffaf1" stroke="#d5c7b9" strokeWidth="2" />
    </g>}
    {(shape === "pie" || shape === "cake") && <g>
      <path d="M67 95 Q73 65 117 62 Q164 63 173 96 L165 117 Q115 132 73 113Z"
        fill={fill} stroke="#865936" strokeWidth="3" />
      <ellipse cx="120" cy="88" rx="54" ry="27" fill={fill} stroke="#a27042" strokeWidth="3" />
      {shape === "pie" ?
        <g stroke="#f8dc9b" strokeWidth="5" opacity={stage === "Burnt" ? .2 : 1}>
          <path d="M75 77 L167 102 M77 99 L163 74 M101 64 L126 112 M125 63 L145 110" />
        </g> :
        <g>
          <path d="M77 87 Q90 77 105 85 Q128 75 144 85 Q158 79 166 87"
            fill="none" stroke="#f9f0d1" strokeWidth="8" />
          <circle cx="100" cy="74" r="7" fill="#d75f54"/><circle cx="136" cy="73" r="7" fill="#dfad48"/>
        </g>}
    </g>}
    {soup && <g>
      <path d="M55 93 Q56 141 119 142 Q184 142 185 93Z" fill="#ece6dd" stroke="#8c857e" strokeWidth="4"/>
      <ellipse cx="120" cy="94" rx="65" ry="29" fill={stage === "Burnt" ? "#463c33" : "#b57a45"}
        stroke="#ded7ca" strokeWidth="6" />
      {[[88,87],[118,98],[151,87],[127,76],[98,105]].map(([x,y],i)=>
        <g key={i}><ellipse cx={x} cy={y} rx="10" ry="6" fill={i%2?"#a5b46c":"#e1b773"}/>
          <path d={"M"+(x-5)+" "+y+" Q"+x+" "+(y-7)+" "+(x+5)+" "+y}
            stroke="#608956" strokeWidth="3" fill="none"/></g>)}
    </g>}
    {shape === "bowl" && <g>
      <path d="M55 99 Q57 142 120 145 Q181 143 185 99Z" fill="#aa826b" stroke="#77624d" strokeWidth="3"/>
      <ellipse cx="120" cy="96" rx="65" ry="26" fill={stage === "Burnt" ? "#483b32" : "#f0e1c4"} stroke="#c9b098" strokeWidth="4"/>
      {[[85,90],[111,100],[140,88],[154,101],[119,78]].map(([x,y],i)=>
        <ellipse key={i} cx={x} cy={y} rx="12" ry="7" fill={i%2 ? fill : "#99735c"} />)}
      <path d="M86 78 Q105 64 110 78 M139 80 Q158 65 165 82" stroke="#5e8b68" strokeWidth="4" fill="none" />
    </g>}
    {drink && <g>
      <path d="M81 36 L158 36 L148 140 Q119 148 92 140Z" fill="#e8f3f2" stroke="#9abac1" strokeWidth="5" opacity=".9"/>
      <path d="M85 66 L154 66 L146 132 Q118 142 95 132Z" fill={recipeSlug.includes("tea")?"#b17d4d":"#dbac65"} opacity=".9"/>
      <ellipse cx="120" cy="65" rx="35" ry="8" fill="#ecd4a5"/>
      <path d="M140 20 L163 8 M148 35 L147 93" stroke="#f2ecd9" strokeWidth="6" strokeLinecap="round"/>
      <circle cx="102" cy="103" r="12" fill="#e2c35d"/><circle cx="133" cy="120" r="9" fill="#ce6559"/>
      <path d="M96 90 Q105 83 116 93" stroke="#659d6a" strokeWidth="4" fill="none"/>
    </g>}
    {stage === "Burnt" && <g stroke="#ddd5c9" fill="none" strokeWidth="3" opacity=".85">
      <path d="M108 59 Q97 42 107 26 M137 61 Q150 41 134 23"/>
    </g>}
  </svg>;
}
