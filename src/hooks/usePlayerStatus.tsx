import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type PlayerActivityStatus =
  | "Songwriting"
  | "Song Recording"
  | "Studying"
  | "Traveling"
  | "Gigging"
  | "Rehearsing"
  | "Busking"
  | "Doing PR"
  | "Jamming";

export interface ActiveTimedStatus {
  status: PlayerActivityStatus;
  startedAt: string;
  endsAt: string;
  durationMinutes: number;
  metadata?: Record<string, unknown> | null;
}

export interface StartTimedStatusInput {
  status: PlayerActivityStatus;
  durationMinutes: number;
  metadata?: Record<string, unknown> | null;
}

interface PlayerStatusContextValue {
  activeStatus: ActiveTimedStatus | null;
  remainingMs: number;
  startTimedStatus: (input: StartTimedStatusInput) => void;
  clearStatus: () => void;
}

const STORAGE_KEY = "rockmundo:player-status";
const TICK_INTERVAL_MS = 1000;

const PlayerStatusContext = createContext<PlayerStatusContextValue | undefined>(
  undefined,
);

const readStoredStatus = (): ActiveTimedStatus | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ActiveTimedStatus> | null;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const { status, startedAt, endsAt, durationMinutes, metadata } = parsed;

    if (
      typeof status !== "string" ||
      typeof startedAt !== "string" ||
      typeof endsAt !== "string"
    ) {
      return null;
    }

    const parsedDuration = Number(durationMinutes);
    const safeDuration = Number.isFinite(parsedDuration)
      ? Math.max(1, Math.round(parsedDuration))
      : Math.ceil((new Date(endsAt).getTime() - Date.now()) / 60000);

    return {
      status: status as PlayerActivityStatus,
      startedAt,
      endsAt,
      durationMinutes: safeDuration,
      metadata: metadata && typeof metadata === "object" ? metadata : null,
    };
  } catch (error) {
    console.warn("Failed to parse stored player status", error);
    return null;
  }
};

const persistStatus = (status: ActiveTimedStatus | null) => {
  if (typeof window === "undefined") {
    return;
  }

  if (!status) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(status));
  } catch (error) {
    console.warn("Unable to persist player status", error);
  }
};

export const PlayerStatusProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [activeStatus, setActiveStatus] = useState<ActiveTimedStatus | null>(() => {
    const stored = readStoredStatus();
    if (!stored) {
      return null;
    }

    const endsAt = new Date(stored.endsAt).getTime();
    if (Number.isNaN(endsAt) || endsAt <= Date.now()) {
      persistStatus(null);
      return null;
    }

    return stored;
  });

  const [remainingMs, setRemainingMs] = useState<number>(() => {
    if (!activeStatus) {
      return 0;
    }

    const endsAt = new Date(activeStatus.endsAt).getTime();
    if (Number.isNaN(endsAt)) {
      return 0;
    }

    return Math.max(0, endsAt - Date.now());
  });

  const tickingRef = useRef<number | null>(null);

  const clearTicker = useCallback(() => {
    if (tickingRef.current !== null) {
      clearInterval(tickingRef.current);
      tickingRef.current = null;
    }
  }, []);

  const clearStatus = useCallback(() => {
    clearTicker();
    setActiveStatus(null);
    setRemainingMs(0);
    persistStatus(null);
  }, [clearTicker]);

  useEffect(() => {
    if (!activeStatus) {
      clearTicker();
      setRemainingMs(0);
      return;
    }

    const updateRemaining = () => {
      const endsAt = new Date(activeStatus.endsAt).getTime();
      if (Number.isNaN(endsAt)) {
        clearStatus();
        return;
      }

      const remaining = Math.max(0, endsAt - Date.now());
      setRemainingMs(remaining);

      if (remaining <= 0) {
        clearStatus();
      }
    };

    updateRemaining();
    clearTicker();
    tickingRef.current = window.setInterval(updateRemaining, TICK_INTERVAL_MS);

    return clearTicker;
  }, [activeStatus, clearStatus, clearTicker]);

  const startTimedStatus = useCallback(
    ({ status, durationMinutes, metadata }: StartTimedStatusInput) => {
      const safeDurationMinutes = Number.isFinite(durationMinutes)
        ? Math.max(1, Math.round(durationMinutes))
        : 1;

      const startedAt = new Date();
      const endsAt = new Date(
        startedAt.getTime() + safeDurationMinutes * 60 * 1000,
      );

      const nextStatus: ActiveTimedStatus = {
        status,
        startedAt: startedAt.toISOString(),
        endsAt: endsAt.toISOString(),
        durationMinutes: safeDurationMinutes,
        metadata: metadata ?? null,
      };

      setActiveStatus(nextStatus);
      setRemainingMs(Math.max(0, endsAt.getTime() - Date.now()));
      persistStatus(nextStatus);
    },
    [],
  );

  const value = useMemo<PlayerStatusContextValue>(
    () => ({ activeStatus, remainingMs, startTimedStatus, clearStatus }),
    [activeStatus, remainingMs, startTimedStatus, clearStatus],
  );

  return (
    <PlayerStatusContext.Provider value={value}>
      {children}
    </PlayerStatusContext.Provider>
  );
};

export const usePlayerStatus = (): PlayerStatusContextValue => {
  const context = useContext(PlayerStatusContext);

  if (!context) {
    throw new Error(
      "usePlayerStatus must be used within a PlayerStatusProvider",
    );
  }

  return context;
};

