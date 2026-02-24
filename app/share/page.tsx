import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type SharePageProps = {
  searchParams: Promise<{
    tries?: string;
    date?: string;
    ref?: string;
  }>;
};

export default async function SharePage({ searchParams }: SharePageProps) {
  const params = await searchParams;
  const triesValue = Number(params.tries);
  const tries =
    Number.isFinite(triesValue) && triesValue > 0
      ? Math.floor(triesValue)
      : null;
  const date = params.date ?? "today";
  const ref = params.ref;
  const playHref = ref ? `/?friend=${encodeURIComponent(ref)}` : "/";

  return (
    <main className="app-shell-share">
      <Card className="mx-auto max-w-xl text-center shadow-[var(--shadow-elevated)]">
        <CardContent className="p-8">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
            freqle share
          </p>
          <h1 className="mt-2 text-4xl font-semibold">Daily Result</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            {tries ? (
              <>
                Solved in <span className="font-semibold">{tries}</span>{" "}
                {tries === 1 ? "attempt" : "attempts"}.
              </>
            ) : (
              "No tries count was provided in the share link."
            )}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Puzzle date: {date}</p>

          <Button asChild className="mt-6">
            <Link href={playHref}>Play today&apos;s puzzle</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
