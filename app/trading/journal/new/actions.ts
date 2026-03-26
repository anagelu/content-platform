"use server";

import { auth } from "@/auth";
import { prismaWithJournal } from "@/lib/prisma-journal";
import { generateSummary } from "@/lib/post-summary";
import { generateUniqueTradingJournalSlug } from "@/lib/trading";
import { redirect } from "next/navigation";

export async function createTradingJournalEntry(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const title = formData.get("title")?.toString().trim() || "";
  const market = formData.get("market")?.toString().trim() || "";
  const timeframe = formData.get("timeframe")?.toString().trim() || "";
  const direction = formData.get("direction")?.toString().trim() || "LONG";
  const entryDateValue = formData.get("entryDate")?.toString().trim() || "";
  const stillHolding = formData.get("stillHolding")?.toString() === "on";
  const exitDateValue = formData.get("exitDate")?.toString().trim() || "";
  const entryPrice = Number(formData.get("entryPrice"));
  const exitPriceValue = formData.get("exitPrice")?.toString().trim() || "";
  const executionNotes = formData.get("executionNotes")?.toString().trim() || "";
  const mistakeReview = formData.get("mistakeReview")?.toString().trim() || "";
  const lessonLearned = formData.get("lessonLearned")?.toString().trim() || "";

  if (
    !title ||
    !market ||
    !timeframe ||
    !entryDateValue ||
    !Number.isFinite(entryPrice)
  ) {
    throw new Error("Title, market, timeframe, entry date, and entry price are required.");
  }

  const summary = generateSummary(
    [executionNotes, mistakeReview, lessonLearned].filter(Boolean).join(" "),
  );
  const slug = await generateUniqueTradingJournalSlug(title);

  const journalEntry = await prismaWithJournal.tradingJournalEntry.create({
    data: {
      title,
      slug,
      market,
      timeframe,
      direction: direction === "SHORT" ? "SHORT" : "LONG",
      entryDate: new Date(entryDateValue),
      exitDate: stillHolding ? null : exitDateValue ? new Date(exitDateValue) : null,
      entryPrice,
      exitPrice: stillHolding ? null : exitPriceValue ? Number(exitPriceValue) : null,
      summary,
      executionNotes: executionNotes || null,
      mistakeReview: mistakeReview || null,
      lessonLearned: lessonLearned || null,
      authorId: Number(session.user.id),
    },
  });

  redirect(`/trading/journal/${journalEntry.slug}`);
}
