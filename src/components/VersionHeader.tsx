export const version = "1.1.600";

interface VersionHeaderProps {
  className?: string;
}

export const VersionHeader = ({ className = "" }: VersionHeaderProps) => {
  return (
    <div className={`text-xs text-muted-foreground ${className}`}>
      v{version}
    </div>
  );
};
