export const SkeletonCard = ({ lines = 2 }: { lines?: number }) => (
  <div className="rm-mcard p-4 space-y-2">
    <div className="rm-skeleton h-4 w-2/3 rounded bg-muted" />
    {Array.from({ length: lines }).map((_, i) => (
      <div key={i} className="rm-skeleton h-3 w-full rounded bg-muted" style={{ animationDelay: `${i * 120}ms` }} />
    ))}
  </div>
);
