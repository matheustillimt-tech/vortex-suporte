// Skeleton específico das páginas admin — mais informativo que o spinner.
export default function AdminLoading() {
  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        {/* header */}
        <div className="space-y-2">
          <div className="h-6 w-48 animate-pulse rounded bg-secondary/70" />
          <div className="h-3 w-72 animate-pulse rounded bg-secondary/40" />
        </div>
        {/* corpo */}
        <div className="space-y-2 pt-2">
          <div className="h-16 animate-pulse rounded-xl bg-card border border-border/40" />
          <div className="h-16 animate-pulse rounded-xl bg-card border border-border/40" />
          <div className="h-16 animate-pulse rounded-xl bg-card border border-border/40" />
        </div>
      </div>
    </div>
  );
}
