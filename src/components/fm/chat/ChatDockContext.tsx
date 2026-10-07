import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type OpenThread = { profileId: string; displayName: string };
type Ctx = {
  open: boolean;
  setOpen: (v: boolean) => void;
  threads: OpenThread[];
  openThread: (t: OpenThread) => void;
  closeThread: (profileId: string) => void;
  minimize: () => void;
  reset: () => void;
};

const ChatDockContext = createContext<Ctx | null>(null);

export function ChatDockProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<OpenThread[]>([]);

  const openThread = useCallback((t: OpenThread) => {
    setOpen(true);
    setThreads((prev) => {
      const withoutThread = prev.filter((p) => p.profileId !== t.profileId);
      const next = [...withoutThread, t];
      return next.slice(-2); // keep at most 2 open windows, most recently used last
    });
  }, []);

  const closeThread = useCallback((profileId: string) => {
    setThreads((prev) => prev.filter((p) => p.profileId !== profileId));
  }, []);

  const minimize = useCallback(() => setOpen(false), []);
  const reset = useCallback(() => { setOpen(false); setThreads([]); }, []);

  const value = useMemo(
    () => ({ open, setOpen, threads, openThread, closeThread, minimize, reset }),
    [open, threads, openThread, closeThread, minimize, reset],
  );

  return <ChatDockContext.Provider value={value}>{children}</ChatDockContext.Provider>;
}

export function useChatDock() {
  const ctx = useContext(ChatDockContext);
  if (!ctx) throw new Error("useChatDock must be used within ChatDockProvider");
  return ctx;
}
