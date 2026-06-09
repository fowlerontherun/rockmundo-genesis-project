import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type OpenThread = { profileId: string; displayName: string };
type Ctx = {
  open: boolean;
  setOpen: (v: boolean) => void;
  threads: OpenThread[];
  openThread: (t: OpenThread) => void;
  closeThread: (profileId: string) => void;
  minimize: () => void;
};

const ChatDockContext = createContext<Ctx | null>(null);

export function ChatDockProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<OpenThread[]>([]);

  const openThread = useCallback((t: OpenThread) => {
    setOpen(true);
    setThreads((prev) => {
      if (prev.some((p) => p.profileId === t.profileId)) return prev;
      const next = [...prev, t];
      return next.slice(-2); // keep at most 2 open windows
    });
  }, []);

  const closeThread = useCallback((profileId: string) => {
    setThreads((prev) => prev.filter((p) => p.profileId !== profileId));
  }, []);

  const minimize = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ open, setOpen, threads, openThread, closeThread, minimize }),
    [open, threads, openThread, closeThread, minimize],
  );

  return <ChatDockContext.Provider value={value}>{children}</ChatDockContext.Provider>;
}

export function useChatDock() {
  const ctx = useContext(ChatDockContext);
  if (!ctx) throw new Error("useChatDock must be used within ChatDockProvider");
  return ctx;
}
