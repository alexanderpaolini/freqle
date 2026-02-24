import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type GiveUpBannerProps = {
  revealedAnswer: string | null;
};

export function GiveUpBanner({ revealedAnswer }: GiveUpBannerProps) {
  if (!revealedAnswer) {
    return null;
  }

  return (
    <Alert variant="destructive" className="mt-5">
      <AlertTitle>You gave up.</AlertTitle>
      <AlertDescription className="flex">
        <p>Today&apos;s answer was:</p>
        <p className="font-bold">{revealedAnswer}</p>
      </AlertDescription>
    </Alert>
  );
}
