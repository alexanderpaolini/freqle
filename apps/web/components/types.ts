export type GuessResult = {
  guess: string;
  score: number;
  correct: boolean;
  reason?: string;
};

export type DistributionBucket = {
  tries: number;
  count: number;
};

export type PuzzleStats = {
  totalSolves: number;
  average: number | null;
  median: number | null;
  distribution: DistributionBucket[];
};

export type FriendResultStatus =
  | "solved"
  | "gave_up"
  | "in_progress"
  | "pending";

export type FriendResult = {
  friendId: string;
  displayName: string;
  status: FriendResultStatus;
  tries: number;
};

export type SharedSummary = {
  ownerName: string;
  tries: number;
  dateKey: string;
  gaveUp: boolean;
};

export type PuzzlePreviewEntry = {
  key: string;
  value: string;
};
