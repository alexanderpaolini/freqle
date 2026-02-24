import type { PuzzlePreviewEntry } from "./types";

type PuzzlePreviewProps = {
  entries: PuzzlePreviewEntry[];
};

export function PuzzlePreview({ entries }: PuzzlePreviewProps) {
  return (
    <div className="mt-5 rounded-2xl border border-stone-300 bg-stone-950 p-4 text-stone-100">
      <pre className="mt-2 overflow-x-auto font-mono text-lg leading-relaxed">
        {entries.map(({ key, value }) => `${key.padStart(2, " ")}: ${value}\n`)}
      </pre>
    </div>
  );
}
