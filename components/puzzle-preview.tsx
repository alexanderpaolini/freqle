import { Card, CardContent } from "@/components/ui/card";
import type { PuzzlePreviewEntry } from "./types";

type PuzzlePreviewProps = {
  subject: string;
  entries: PuzzlePreviewEntry[];
};

export function PuzzlePreview({ subject, entries }: PuzzlePreviewProps) {
  return (
    <Card className="mt-5 border-stone-300 bg-stone-950 text-stone-100">
      <CardContent>
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-stone-400">
          Subject: {subject}
        </p>
        <pre className="mt-2 overflow-x-auto font-mono text-lg leading-relaxed">
          {entries.map(
            ({ key, value }) => `${key.padStart(2, " ")}: ${value}\n`,
          )}
        </pre>
      </CardContent>
    </Card>
  );
}
