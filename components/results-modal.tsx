import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import type {
  DistributionBucket,
  FriendResult,
  FriendResultStatus,
  PuzzleStats,
} from "./types";
import { DialogTitle } from "@radix-ui/react-dialog";

type ResultsModalProps = {
  isOpen: boolean;
  hasGivenUp: boolean;
  triesUsed: number;
  stats: PuzzleStats | null;
  isLoadingStats: boolean;
  distribution: DistributionBucket[];
  maxDistributionCount: number;
  status: "authenticated" | "loading" | "unauthenticated";
  friendsResults: FriendResult[];
  isLoadingFriendsResults: boolean;
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
  friendsResults,
  isLoadingFriendsResults,
  isGeneratingShare,
  shareUrl,
  onClose,
  onShare,
  onSignInToShare,
}: ResultsModalProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-xl [&>button]:hidden">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle>Daily Result</DialogTitle>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-stone-500"></p>
              {hasGivenUp ? (
                <h2 className="mt-1 text-3xl font-semibold tracking-tight">
                  Gave up after {triesUsed}{" "}
                  {triesUsed === 1 ? "attempt" : "attempts"}
                </h2>
              ) : (
                <h2 className="mt-1 text-3xl font-semibold tracking-tight">
                  Solved in {triesUsed}{" "}
                  {triesUsed === 1 ? "attempt" : "attempts"}
                </h2>
              )}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 text-sm">
          <StatCard
            label="Total Solves"
            value={String(stats?.totalSolves ?? 0)}
          />
          <StatCard label="Average" value={formatStatValue(stats?.average)} />
          <StatCard label="Median" value={formatStatValue(stats?.median)} />
        </div>

        <Card className="border-stone-300 bg-white">
          <CardContent>
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
                    <span className="font-mono text-stone-500">
                      {bucket.tries}
                    </span>
                    <div className="h-5 overflow-hidden rounded-full bg-stone-200">
                      <div
                        className="h-full rounded-full bg-stone-800 transition-[width] duration-300"
                        style={{
                          width: `${(bucket.count / maxDistributionCount) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-right font-mono text-stone-600">
                      {bucket.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-stone-300 bg-white">
          <CardContent>
            <p className="text-sm font-semibold">Friends</p>
            {status !== "authenticated" ? (
              <p className="mt-2 text-sm text-stone-500">
                Sign in to see friends&apos; results.
              </p>
            ) : isLoadingFriendsResults ? (
              <p className="mt-2 text-sm text-stone-500">Loading friends...</p>
            ) : friendsResults.length === 0 ? (
              <p className="mt-2 text-sm text-stone-500">
                No friends added yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {friendsResults.map((entry) => (
                  <li
                    key={`${entry.friendId}-${entry.displayName}`}
                    className="rounded-lg border border-stone-200 bg-stone-50 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-stone-900">
                        {entry.displayName}
                      </p>
                      <Badge variant={getFriendBadgeVariant(entry.status)}>
                        {getFriendStatusLabel(entry.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-stone-600">
                      {formatFriendDetail(entry)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {status === "authenticated" ? (
            <Button
              type="button"
              onClick={onShare}
              disabled={isGeneratingShare}
            >
              {isGeneratingShare ? "Preparing..." : "Share"}
            </Button>
          ) : (
            <Button type="button" onClick={onSignInToShare}>
              Sign in to Share
            </Button>
          )}
          {shareUrl ? (
            <p className="min-w-0 flex-1 break-all font-mono text-xs text-stone-600">
              {shareUrl}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type StatCardProps = {
  label: string;
  value: string;
};

function StatCard({ label, value }: StatCardProps) {
  return (
    <Card className="rounded-xl border-stone-300 bg-white">
      <CardContent className="px-3">
        <p className="text-xs text-stone-500">{label}</p>
        <p className="mt-1 text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function formatStatValue(value: number | null | undefined): string {
  if (typeof value !== "number") {
    return "-";
  }
  return String(value);
}

function getFriendStatusLabel(status: FriendResultStatus): string {
  switch (status) {
    case "solved":
      return "Solved";
    case "gave_up":
      return "Gave up";
    case "in_progress":
      return "In progress";
    default:
      return "No result";
  }
}

function getFriendBadgeVariant(
  status: FriendResultStatus,
): "secondary" | "destructive" | "outline" {
  if (status === "solved") {
    return "secondary";
  }
  if (status === "gave_up") {
    return "destructive";
  }
  return "outline";
}

function formatFriendDetail(entry: FriendResult): string {
  if (entry.status === "solved") {
    return `Solved in ${entry.tries} ${entry.tries === 1 ? "attempt" : "attempts"}.`;
  }

  if (entry.status === "gave_up") {
    return `Gave up after ${entry.tries} ${entry.tries === 1 ? "attempt" : "attempts"}.`;
  }

  if (entry.status === "in_progress") {
    return `${entry.tries} ${entry.tries === 1 ? "guess" : "guesses"} so far.`;
  }

  return "No result yet.";
}
