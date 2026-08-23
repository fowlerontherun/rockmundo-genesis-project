import { useState } from "react";
import type { FestivalPlayerAttendance } from "./festivalAttendance";
import { FestivalModeHome } from "./FestivalModeHome";
import { FestivalModeMyDay } from "./FestivalModeMyDay";
import { FestivalModeShell, type FestivalModeSection } from "./FestivalModeShell";

export const FestivalModeExperience = ({ attendance }: { attendance: FestivalPlayerAttendance }) => {
  const [activeSection, setActiveSection] = useState<FestivalModeSection>("home");

  return (
    <FestivalModeShell
      attendance={attendance}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
    >
      {activeSection === "my-day" ? (
        <FestivalModeMyDay attendance={attendance} />
      ) : (
        <FestivalModeHome attendance={attendance} />
      )}
    </FestivalModeShell>
  );
};

export default FestivalModeExperience;
