import { auth } from "@/auth";
import {
  getAiCapacityTier,
  getAiProvider,
  getProviderLabel,
  getTierLabel,
  isAiProviderConfigured,
} from "@/lib/ai-admin";
import { prismaWithJournal } from "@/lib/prisma-journal";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TradingJournalEntryForm } from "../../new/journal-entry-form";
import { updateTradingJournalEntry } from "./actions";

export default async function EditTradingJournalEntryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { slug } = await params;

  const entry = await prismaWithJournal.tradingJournalEntry.findUnique({
    where: {
      slug,
    },
    include: {
      author: true,
    },
  });

  if (!entry) {
    return <div style={{ padding: "2rem" }}>Trading journal entry not found.</div>;
  }

  const canManage =
    session.user.role === "admin" || session.user.id === String(entry.authorId);

  if (!canManage) {
    redirect(`/trading/journal/${entry.slug}`);
  }

  const [aiAssistEnabled, aiProvider, aiTier] = await Promise.all([
    isAiProviderConfigured(),
    getAiProvider(),
    getAiCapacityTier(),
  ]);

  return (
    <main>
      <div className="site-shell">
        <h1 className="page-title">Edit Journal Entry</h1>
        <p className="page-subtitle">
          Update the trade record, tighten the review, and keep the lesson tied
          to what actually happened.
        </p>

        <div className="toolbar">
          <Link
            href={`/trading/journal/${entry.slug}`}
            className="button-link secondary"
          >
            Back to Entry
          </Link>
          <Link href="/trading/journal" className="button-link secondary">
            Journal Home
          </Link>
        </div>

        <div className="form-card">
          <TradingJournalEntryForm
            action={updateTradingJournalEntry}
            submitLabel="Update Journal Entry"
            aiAssistEnabled={aiAssistEnabled}
            aiProviderLabel={getProviderLabel(aiProvider)}
            aiTierLabel={getTierLabel(aiTier)}
            initialValues={{
              id: entry.id,
              title: entry.title,
              market: entry.market,
              timeframe: entry.timeframe,
              direction: entry.direction,
              entryDate: new Date(entry.entryDate).toISOString().slice(0, 10),
              entryPrice: String(entry.entryPrice),
              stillHolding: !entry.exitDate && !entry.exitPrice,
              exitDate: entry.exitDate
                ? new Date(entry.exitDate).toISOString().slice(0, 10)
                : "",
              exitPrice: entry.exitPrice ? String(entry.exitPrice) : "",
              executionNotes: entry.executionNotes ?? "",
              mistakeReview: entry.mistakeReview ?? "",
              lessonLearned: entry.lessonLearned ?? "",
            }}
          />
        </div>
      </div>
    </main>
  );
}
