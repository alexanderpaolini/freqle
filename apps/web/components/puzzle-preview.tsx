import { Card, CardContent } from "@/components/ui/card";
import type { PuzzlePreviewEntry } from "./types";

type PuzzlePreviewProps = {
  subject: string;
  entries: PuzzlePreviewEntry[];
};

export function PuzzlePreview({ subject, entries }: PuzzlePreviewProps) {
  return (
    <Card className="mt-5 border-border bg-preview text-preview-foreground">
      <CardContent>
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-preview-muted">
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
