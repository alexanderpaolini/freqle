import type { DistributionBucket, PuzzleStats } from "./types";

type ResultsModalProps = {
  isOpen: boolean;
  hasGivenUp: boolean;
  triesUsed: number;
  stats: PuzzleStats | null;
  isLoadingStats: boolean;
  distribution: DistributionBucket[];
  maxDistributionCount: number;
  status: "authenticated" | "loading" | "unauthenticated";
  isGeneratingShare: boolean;
  shareUrl: string;
  onClose: () => void;
  onShare: () => void;
  onSignInToShare: () => void;
};

export function ResultsModal({
  isOpen,
  hasGivenUp,
  triesUsed,
  stats,
  isLoadingStats,
  distribution,
  maxDistributionCount,
  status,
  isGeneratingShare,
  shareUrl,
  onClose,
  onShare,
  onSignInToShare,
}: ResultsModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl rounded-3xl border border-stone-300 bg-[#fffdf7] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-stone-500">
              Daily Result
            </p>
            {hasGivenUp ? (
              <h2 className="mt-1 text-3xl font-semibold tracking-tight">
                Gave up after {triesUsed} {triesUsed === 1 ? "attempt" : "attempts"}
              </h2>
            ) : (
              <h2 className="mt-1 text-3xl font-semibold tracking-tight">
                Solved in {triesUsed} {triesUsed === 1 ? "attempt" : "attempts"}
              </h2>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-stone-300 px-3 py-1 text-xs font-medium hover:bg-stone-100"
          >
            Close
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <StatCard label="Total Solves" value={String(stats?.totalSolves ?? 0)} />
          <StatCard label="Average" value={formatStatValue(stats?.average)} />
          <StatCard label="Median" value={formatStatValue(stats?.median)} />
        </div>

        <div className="mt-4 rounded-2xl border border-stone-300 bg-white p-4">
          <p className="text-sm font-semibold">Distribution</p>
          {isLoadingStats ? (
            <p className="mt-2 text-sm text-stone-500">Loading chart...</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {distribution.map((bucket) => (
                <li
                  key={bucket.tries}
                  className="grid grid-cols-[32px_1fr_40px] items-center gap-2 text-sm"
                >
                  <span className="font-mono text-stone-500">{bucket.tries}</span>
                  <div className="h-5 overflow-hidden rounded-full bg-stone-200">
                    <div
                      className="h-full rounded-full bg-stone-800 transition-[width] duration-300"
                      style={{
                        width: `${(bucket.count / maxDistributionCount) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-right font-mono text-stone-600">{bucket.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {status === "authenticated" ? (
            <button
              type="button"
              onClick={onShare}
              disabled={isGeneratingShare}
              className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isGeneratingShare ? "Sharing..." : "Share"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignInToShare}
              className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700"
            >
              Sign in to Share
            </button>
          )}
          {shareUrl ? (
            <p className="min-w-0 flex-1 break-all font-mono text-xs text-stone-600">{shareUrl}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type StatCardProps = {
  label: string;
  value: string;
};

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="rounded-xl border border-stone-300 bg-white px-3 py-2">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function formatStatValue(value: number | null | undefined): string {
  if (typeof value !== "number") {
    return "-";
  }
  return String(value);
}
