export type Puzzle = {
  id: string;
  preview: Record<number, number>;
  answer: string;
  acceptedAnswers: string[];
};

const PUZZLES: Puzzle[] = [
  {
    id: "month-day-counts",
    preview: {
      28: 1,
      30: 4,
      31: 7,
    },
    answer: "the number of days in each month in a non leap year",
    acceptedAnswers: [
      "days in each month",
      "number of days in each month",
      "days per month",
      "month lengths",
      "month lengths in a non leap year",
      "days in months non leap year",
    ],
  },
];

export function getDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDailyPuzzle(date = new Date()): Puzzle {
  const dayNumber = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
  const index =
    ((dayNumber % PUZZLES.length) + PUZZLES.length) % PUZZLES.length;
  return PUZZLES[index];
}

export function getDailyPuzzleFromDateKey(dateKey?: string): Puzzle {
  if (!dateKey) {
    return getDailyPuzzle();
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) {
    return getDailyPuzzle();
  }

  const [, year, month, day] = match;
  const parsedDate = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    12,
    0,
    0,
    0,
  );

  if (Number.isNaN(parsedDate.getTime())) {
    return getDailyPuzzle();
  }

  return getDailyPuzzle(parsedDate);
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isCorrectGuess(puzzle: Puzzle, guess: string): boolean {
  const normalizedGuess = normalizeText(guess);
  if (!normalizedGuess) {
    return false;
  }

  const answers = [puzzle.answer, ...puzzle.acceptedAnswers].map(normalizeText);

  return answers.some((candidate) => {
    if (!candidate) {
      return false;
    }

    return (
      normalizedGuess === candidate ||
      normalizedGuess.includes(candidate) ||
      candidate.includes(normalizedGuess)
    );
  });
}
