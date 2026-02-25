import { HowToDialog } from "./how-to-dialog";
import { HowWeJudgeDialog } from "./how-we-judge-dialog";
import { SuggestDialog } from "./suggest-dialog";

export function HomeFooter() {
  return (
    <footer className="flex items-center justify-center gap-1 border-t border-border/60 pt-3">
      <HowToDialog
        triggerLabel="how to play"
        triggerVariant="ghost"
        triggerClassName="h-8 px-2 font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground"
      />
      <span className="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground/70">
        |
      </span>
      <HowWeJudgeDialog
        triggerLabel="how we judge"
        triggerVariant="ghost"
        triggerClassName="h-8 px-2 font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground"
      />
      <span className="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground/70">
        |
      </span>
      <SuggestDialog
        triggerLabel="suggest a puzzle"
        triggerVariant="ghost"
        triggerClassName="h-8 px-2 font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground"
      />
    </footer>
  );
}
