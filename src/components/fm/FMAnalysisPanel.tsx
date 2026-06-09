import { ReactNode } from "react";
import { PanelCard } from "./PanelCard";
import { FMStatChart } from "./FMStatChart";

export const FMAnalysisPanel = ({
  title,
  chart,
  breakdown,
  actions,
}: {
  title: string;
  chart: React.ComponentProps<typeof FMStatChart>;
  breakdown?: ReactNode;
  actions?: ReactNode;
}) => (
  <PanelCard title={title} actions={actions} bodyClassName="p-0">
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-fm-border">
      <div className="p-3">
        <FMStatChart {...chart} />
      </div>
      {breakdown && <div className="p-3 text-xs">{breakdown}</div>}
    </div>
  </PanelCard>
);

export default FMAnalysisPanel;
