import { useEffect, useState } from "react";
import { Monitor } from "lucide-react";

const MIN_WIDTH = 1440;

export const DesktopOnlyGate = ({ children }: { children: React.ReactNode }) => {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1920);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (width < MIN_WIDTH) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-fm-bg text-fm-fg p-8">
        <div className="max-w-md text-center space-y-5">
          <Monitor className="h-16 w-16 mx-auto text-fm-accent" />
          <h1 className="text-2xl font-bold tracking-tight">Desktop Only</h1>
          <p className="text-sm text-fm-fg-muted leading-relaxed">
            RockMundo is built for the full desktop experience. Please open this
            site on a computer with a browser window at least <strong>1440&nbsp;×&nbsp;900</strong> pixels wide.
          </p>
          <p className="text-xs text-fm-fg-muted/70">
            Current width: {width}px · Required: {MIN_WIDTH}px
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default DesktopOnlyGate;
