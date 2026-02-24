export type GuessResult = {
  guess: string;
  score: number;
  correct: boolean;
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
