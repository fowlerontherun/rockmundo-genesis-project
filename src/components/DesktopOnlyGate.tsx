import { useEffect, useState } from"react";
import { Monitor } from"lucide-react";

const MIN_WIDTH = 1440;
const BYPASS_KEY ="rm-desktop-gate-bypass";

const initialBypass = () => {
 if (typeof window ==="undefined") return false;
 if (import.meta.env.DEV) return true;
 try {
 if (window.localStorage.getItem(BYPASS_KEY) ==="1") return true;
 if (new URLSearchParams(window.location.search).get("desktop") ==="off") {
 window.localStorage.setItem(BYPASS_KEY,"1");
 return true;
 }
 } catch {}
 return false;
};

export const DesktopOnlyGate = ({ children }: { children: React.ReactNode }) => {
 const [width, setWidth] = useState(typeof window !=="undefined"? window.innerWidth : 1920);
 const [bypass, setBypass] = useState(initialBypass);

 useEffect(() => {
 const onResize = () => setWidth(window.innerWidth);
 window.addEventListener("resize", onResize);
 return () => window.removeEventListener("resize", onResize);
 }, []);

 const enableBypass = () => {
 try { window.localStorage.setItem(BYPASS_KEY,"1"); } catch {}
 setBypass(true);
 };

 if (!bypass && width < MIN_WIDTH) {
 return (
 <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-fm-bg text-fm-fg p-8">
 <div className="max-w-md text-center space-y-5">
 <Monitor className="h-16 w-16 mx-auto text-fm-accent"/>
 <h1 className="font-bebas text-3xl">Desktop Only</h1>
 <p className="text-sm text-fm-fg-muted leading-relaxed">
 RockMundo is built for the full desktop experience. Please open this
 site on a computer with a browser window at least <strong>1440&nbsp;×&nbsp;900</strong> pixels wide.
 </p>
 <p className="text-xs text-fm-fg-muted/70">
 Current width: {width}px · Required: {MIN_WIDTH}px
 </p>
 <button
 onClick={enableBypass}
 className="text-[10px] text-fm-accent border border-fm-border px-3 py-1.5 rounded-sm hover:bg-fm-panel">
 Preview anyway (dev)
 </button>
 </div>
 </div>
 );
 }

 return <>{children}</>;
};

export default DesktopOnlyGate;

