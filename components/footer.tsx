import { HowToDialog } from "./how-to-dialog";
import { SuggestDialog } from "./suggest-dialog";

export function HomeFooter() {
  return (
    <footer className="flex items-center justify-center gap-1 border-t border-stone-300/60 pt-3">
      <HowToDialog
        triggerLabel="how to play"
        triggerVariant="ghost"
        triggerClassName="h-8 px-2 font-mono text-xs uppercase tracking-[0.12em] text-stone-600"
      />
      <span className="font-mono text-xs uppercase tracking-[0.12em] text-stone-400">
        |
      </span>
      <SuggestDialog
        triggerLabel="suggest a puzzle"
        triggerVariant="ghost"
        triggerClassName="h-8 px-2 font-mono text-xs uppercase tracking-[0.12em] text-stone-600"
      />
    </footer>
  );
}
