import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GuessResult } from "./types";

type AttemptsSectionProps = {
  status: "authenticated" | "loading" | "unauthenticated";
  isLoadingAttempts: boolean;
  attempts: Array<{
    result: GuessResult;
    index: number;
  }>;
};

export function AttemptsSection({
  status,
  isLoadingAttempts,
  attempts,
}: AttemptsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Attempts</CardTitle>
      </CardHeader>
      <CardContent>
        {status === "authenticated" && isLoadingAttempts ? (
          <p className="mt-1 text-sm text-stone-600">
            Loading saved attempts...
          </p>
        ) : attempts.length === 0 ? (
          <p className="mt-1 text-sm text-stone-600">No guesses yet.</p>
        ) : (
          <ul className="mt-1 space-y-3">
            {attempts.map(({ result, index }) => (
              <li
                key={`${result.guess}-${index}`}
                className="rounded-xl border border-stone-300 bg-white p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{result.guess}</p>
                  <Badge variant={result.correct ? "secondary" : "destructive"}>
                    {result.correct ? "Correct" : "Incorrect"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-stone-600">
                  Closeness score:{" "}
                  <span className="font-semibold">{result.score}</span>/100
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
