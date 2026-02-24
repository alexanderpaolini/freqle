ALTER TABLE "Player"
ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "Puzzle_new" (
  "key" TEXT NOT NULL,
  "dateKey" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Puzzle_new_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX "Puzzle_new_dateKey_key" ON "Puzzle_new"("dateKey");

WITH ranked AS (
  SELECT
    p."id" AS source_id,
    dp."dateKey" AS source_date_key,
    p."answer" AS source_answer,
    p."preview" AS source_data,
    p."createdAt" AS source_created_at,
    p."updatedAt" AS source_updated_at,
    ROW_NUMBER() OVER (PARTITION BY p."id" ORDER BY dp."dateKey") AS row_num
  FROM "DailyPuzzle" dp
  INNER JOIN "Puzzle" p ON p."id" = dp."puzzleId"
)
INSERT INTO "Puzzle_new" (
  "key",
  "dateKey",
  "answer",
  "data",
  "createdAt",
  "updatedAt"
)
SELECT
  CASE
    WHEN row_num = 1 THEN source_id
    ELSE source_id || '__' || source_date_key
  END AS key,
  source_date_key,
  source_answer,
  source_data,
  source_created_at,
  source_updated_at
FROM ranked;

UPDATE "Suggestion" s
SET "puzzleId" = p."key"
FROM "Puzzle_new" p
WHERE s."dateKey" = p."dateKey";

DROP TABLE "DailyPuzzle";
DROP TABLE "Puzzle";
ALTER TABLE "Puzzle_new" RENAME TO "Puzzle";
ALTER INDEX "Puzzle_new_dateKey_key" RENAME TO "Puzzle_dateKey_key";
