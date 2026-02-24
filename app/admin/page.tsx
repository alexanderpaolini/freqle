import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { AdminPanel } from "@/components/admin-panel";
import { Button } from "@/components/ui/button";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Freqle Admin",
  description: "Manage daily Freqle puzzles.",
};

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/");
  }

  const player = await db.player.findUnique({
    where: {
      externalId: session.user.id,
    },
    select: {
      isAdmin: true,
    },
  });

  if (!player?.isAdmin) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fef6e7,#f8efe2_45%,#efe5d6)] px-4 py-8 text-stone-900">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-stone-500">
              freqle admin
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Puzzle Management</h1>
          </div>
          <Button asChild type="button" variant="outline">
            <Link href="/">Back to game</Link>
          </Button>
        </div>

        <AdminPanel />
      </div>
    </main>
  );
}

