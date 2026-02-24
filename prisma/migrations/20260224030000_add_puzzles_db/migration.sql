CREATE TABLE "Puzzle" (
  "id" TEXT NOT NULL,
  "preview" JSONB NOT NULL,
  "solutionLabel" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "acceptedAnswers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Puzzle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyPuzzle" (
  "dateKey" TEXT NOT NULL,
  "puzzleId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DailyPuzzle_pkey" PRIMARY KEY ("dateKey")
);

CREATE INDEX "DailyPuzzle_puzzleId_idx" ON "DailyPuzzle"("puzzleId");

ALTER TABLE "DailyPuzzle"
ADD CONSTRAINT "DailyPuzzle_puzzleId_fkey"
FOREIGN KEY ("puzzleId") REFERENCES "Puzzle"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
