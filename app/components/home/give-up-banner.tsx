type GiveUpBannerProps = {
  revealedAnswer: string | null;
};

export function GiveUpBanner({ revealedAnswer }: GiveUpBannerProps) {
  if (!revealedAnswer) {
    return null;
  }

  return (
    <div className="mt-5 rounded-lg bg-red-100 px-3 py-2 text-sm text-amber-900">
      <p>You gave up. Today&apos;s answer was:</p>
      <p className="font-bold">{revealedAnswer}</p>
    </div>
  );
}
