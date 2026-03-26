"use server";

import { auth } from "@/auth";
import { prismaWithJournal } from "@/lib/prisma-journal";
import { redirect } from "next/navigation";

async function requireTradingJournalAccess(id: number) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const entry = await prismaWithJournal.tradingJournalEntry.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      slug: true,
      authorId: true,
    },
  });

  if (!entry) {
    throw new Error("Trading journal entry not found.");
  }

  const canManage =
    session.user.role === "admin" || session.user.id === String(entry.authorId);

  if (!canManage) {
    throw new Error("You do not have permission to manage this journal entry.");
  }

  return entry;
}

export async function deleteTradingJournalEntry(formData: FormData) {
  const id = Number(formData.get("id"));

  if (!id) {
    throw new Error("Trading journal entry ID is required.");
  }

  await requireTradingJournalAccess(id);

  await prismaWithJournal.tradingJournalEntry.delete({
    where: {
      id,
    },
  });

  redirect("/trading/journal");
}
