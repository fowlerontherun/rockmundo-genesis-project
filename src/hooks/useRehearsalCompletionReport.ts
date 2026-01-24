import { useState, useCallback } from "react";
import type { SongRehearsalResult } from "@/components/rehearsal/RehearsalCompletionReport";

interface RehearsalReportData {
  results: SongRehearsalResult[];
  chemistryGain: number;
  xpGained: number;
  durationHours: number;
}

/**
 * Hook to manage post-rehearsal completion report state
 */
export function useRehearsalCompletionReport() {
  const [isOpen, setIsOpen] = useState(false);
  const [reportData, setReportData] = useState<RehearsalReportData | null>(null);

  const showReport = useCallback((data: RehearsalReportData) => {
    setReportData(data);
    setIsOpen(true);
  }, []);

  const closeReport = useCallback(() => {
    setIsOpen(false);
    // Delay clearing data to allow animation
    setTimeout(() => setReportData(null), 300);
  }, []);

  return {
    isOpen,
    reportData,
    showReport,
    closeReport,
  };
}
