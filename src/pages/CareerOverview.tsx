import { Briefcase, DollarSign, Trophy } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import { careerHubNavigation } from "@/config/hubNavigation";
import CareerDashboardPage from "./dashboard/career";

export default function CareerOverview() {
  const actions = [
    { label: "View employment", path: "/career/employment", icon: Briefcase },
    { label: "Review awards", path: "/career/awards", icon: Trophy },
    { label: "Personal finances", path: "/career/finances", icon: DollarSign },
  ];

  return (
    <HubLayout
      title="Career"
      description="Track personal progression, employment, fame, awards, achievements, charts, discography milestones and career history separately from character identity and company operations."
      icon={Trophy}
      overviewPath="/career"
      navigation={careerHubNavigation}
      actions={actions}
    >
      <CareerDashboardPage />
    </HubLayout>
  );
}
