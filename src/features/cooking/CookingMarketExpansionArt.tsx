/**
 * A city's food market is drawn from the SERVER-READ upgrade level.
 * These buildings are visual only; the database owns capacity and stock.
 */
export function marketStallCount(level: number): number {
  const safe = Number.isFinite(level) ? Math.floor(level) : 1;
  return Math.min(6, Math.max(2, safe + 1));
}

export function CookingMarketExpansionArt({ level }: { level: number }) {
  const stalls = marketStallCount(level);
  return <svg viewBox="0 0 440 155" role="img" className="h-auto w-full max-w-xl"
    aria-label={"Level " + Math.max(1, Math.min(5, Math.floor(level))) +
      " food marketplace with " + stalls + " illustrated produce stalls"}
    data-testid="cooking-market-expansion" data-stall-count={stalls}>
    <rect x="0" y="0" width="440" height="155" rx="12" fill="#dce6db"/>
    <path d="M0 95 Q85 35 150 81 Q240 22 315 72 Q387 36 440 83 L440 155 L0 155Z" fill="#a3bda6"/>
    <rect x="0" y="118" width="440" height="37" fill="#c9b79f"/>
    <path d="M0 128 L440 128" stroke="#a18c76" strokeDasharray="9 10" strokeWidth="3"/>
    {Array.from({length: stalls}, (_,i)=>{
      const x = 16 + i*68;
      const light = i%2===0;
      return <g key={i} data-testid="cooking-market-stall" transform={"translate("+x+" 0)"}>
        <path d="M4 112 L4 69 M58 112 L58 69" stroke="#785b49" strokeWidth="4"/>
        <rect x="3" y="88" width="56" height="26" rx="4" fill="#b68655" stroke="#825e42" strokeWidth="2" />
        <path d="M0 69 L12 47 L49 47 L63 69Z" fill={light ? "#be6573" : "#60897c"} stroke="#705647" strokeWidth="2"/>
        {[0,1,2,3].map(j=><path key={j}
          d={"M"+(j*16)+" 69 L"+(12+j*9)+" 47 L"+(20+j*9)+" 47 L"+(j*16+15)+" 69Z"}
          fill={j%2===0 ? "#f5e7cd" : light ? "#ca7275" : "#6b9e88"} opacity=".94"/>)}
        {[14,30,46].map((cx,j)=><g key={cx}>
          <circle cx={cx} cy={89 + j%2*4} r="8" fill={j%2 ? "#e0a647" : "#cb6559"}/>
          <path d={"M"+cx+" "+(80+j%2*4)+" l4 -5"} stroke="#6b9567" strokeWidth="3"/>
        </g>)}
        <path d="M10 106 L54 106" stroke="#edbd82" strokeWidth="3"/>
      </g>;
    })}
    {stalls >= 5 && <g>
      <path d="M0 40 L440 40" stroke="#a39f89" strokeWidth="2" />
      {[30,90,150,210,270,330,390].map(x=>
        <circle key={x} cx={x} cy="40" r="5" fill="#efc36c" />)}
    </g>}
  </svg>;
}
