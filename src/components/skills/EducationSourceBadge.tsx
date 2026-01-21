import { Badge } from "@/components/ui/badge";
import { GraduationCap, BookOpen, Video, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type EducationSource = 'university' | 'book' | 'video' | 'mentor' | 'training';

interface EducationSourceBadgeProps {
  source: EducationSource;
  className?: string;
  showLabel?: boolean;
}

const sourceConfig: Record<EducationSource, { icon: typeof GraduationCap; label: string; className: string }> = {
  university: {
    icon: GraduationCap,
    label: "University",
    className: "bg-blue-500/10 text-blue-700 border-blue-500/30"
  },
  book: {
    icon: BookOpen,
    label: "Book",
    className: "bg-amber-500/10 text-amber-700 border-amber-500/30"
  },
  video: {
    icon: Video,
    label: "Video",
    className: "bg-red-500/10 text-red-700 border-red-500/30"
  },
  mentor: {
    icon: Users,
    label: "Mentor",
    className: "bg-purple-500/10 text-purple-700 border-purple-500/30"
  },
  training: {
    icon: Users,
    label: "Training",
    className: "bg-green-500/10 text-green-700 border-green-500/30"
  }
};

export const EducationSourceBadge = ({ source, className, showLabel = false }: EducationSourceBadgeProps) => {
  const config = sourceConfig[source];
  const Icon = config.icon;
  
  return (
    <Badge 
      variant="outline" 
      className={cn("gap-1 text-xs px-1.5 py-0.5", config.className, className)}
    >
      <Icon className="h-3 w-3" />
      {showLabel && <span>{config.label}</span>}
    </Badge>
  );
};

export const getSourceFromActivityType = (activityType: string): EducationSource | null => {
  if (activityType.includes('university')) return 'university';
  if (activityType.includes('book')) return 'book';
  if (activityType.includes('video') || activityType.includes('youtube')) return 'video';
  if (activityType.includes('mentor')) return 'mentor';
  if (activityType.includes('training') || activityType.includes('xp_spent')) return 'training';
  return null;
};
