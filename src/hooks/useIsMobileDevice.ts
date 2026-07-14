import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 768;
const FLAG_KEY = "rm-mobile-ui";

/**
 * Detect whether the mobile RockMundo experience should be used.
 * True when:
 *  - viewport width < 768px, OR
 *  - `?mobile=1` is in the URL (persisted to localStorage), OR
 *  - localStorage rm-mobile-ui === "1"
 *
 * `?mobile=0` forces desktop and clears the flag.
 */
export function useIsMobileDevice(): boolean {
  const compute = () => {
    if (typeof window === "undefined") return false;
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get("mobile");
      if (q === "1") {
        window.localStorage.setItem(FLAG_KEY, "1");
        return true;
      }
      if (q === "0") {
        window.localStorage.removeItem(FLAG_KEY);
        return false;
      }
      if (window.localStorage.getItem(FLAG_KEY) === "1") return true;
    } catch {}
    return window.innerWidth < MOBILE_BREAKPOINT;
  };

  const [isMobile, setIsMobile] = useState<boolean>(compute);

  useEffect(() => {
    const onResize = () => setIsMobile(compute());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return isMobile;
}

export function setMobileFlag(on: boolean) {
  try {
    if (on) window.localStorage.setItem(FLAG_KEY, "1");
    else window.localStorage.removeItem(FLAG_KEY);
  } catch {}
}
