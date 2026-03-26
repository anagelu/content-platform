import { auth } from "@/auth";
import {
  getAiCapacityTier,
  getAiProvider,
  getProviderLabel,
  getTierLabel,
  isAiProviderConfigured,
} from "@/lib/ai-admin";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TradingJournalEntryForm } from "./journal-entry-form";

const SPX_EXECUTION_REVIEW_TEMPLATE = `SPX execution review:
- Session window:
- Main setup:
- What price did at the key level:
- Was this a trend day, range day, or failed breakout?
- What I did well:
- What I did poorly:
- What I should repeat next time:`;

const SPX_MISTAKE_AUDIT_TEMPLATE = `SPX mistake audit:
- Did I trade my A+ setup?
- Did I respect opening volatility?
- Did I chase away from my level?
- Did I size too large?
- Did I ignore invalidation?
- Did I overtrade after one loss or win?`;

const SPX_LESSON_TEMPLATE = `SPX repeatable lesson:
- Best setup to keep:
- One condition that makes me stay flat:
- One execution mistake to eliminate:
- One time-of-day edge I should lean on:`;

function getParamValue(
  value: string | string[] | undefined,
) {
  return typeof value === "string" ? value.trim() : "";
}

function getInitialJournalValues(
  searchParams: Record<string, string | string[] | undefined> | undefined,
) {
  const market = getParamValue(searchParams?.market).toUpperCase();
  const preset = getParamValue(searchParams?.preset).toLowerCase();

  if (market !== "SPX") {
    return undefined;
  }

  if (preset === "review") {
    return {
      title: "SPX Review",
      market: "SPX",
      timeframe: "5m",
      direction: "LONG" as const,
      entryDate: "",
      entryPrice: "",
      stillHolding: true,
      exitDate: "",
      exitPrice: "",
      executionNotes: SPX_EXECUTION_REVIEW_TEMPLATE,
      mistakeReview: SPX_MISTAKE_AUDIT_TEMPLATE,
      lessonLearned: SPX_LESSON_TEMPLATE,
    };
  }

  return {
    title: "SPX Journal Entry",
    market: "SPX",
    timeframe: "5m",
    direction: "LONG" as const,
    entryDate: "",
    entryPrice: "",
    stillHolding: true,
    exitDate: "",
    exitPrice: "",
    executionNotes: "",
    mistakeReview: "",
    lessonLearned: "",
  };
}

export default async function NewTradingJournalEntryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const [aiAssistEnabled, aiProvider, aiTier] = await Promise.all([
    isAiProviderConfigured(),
    getAiProvider(),
    getAiCapacityTier(),
  ]);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialValues = getInitialJournalValues(resolvedSearchParams);

  return (
    <main>
      <div className="site-shell">
        <h1 className="page-title">New Journal Entry</h1>
        <p className="page-subtitle">
          Capture the executed trade, review what happened, and turn each trade
          into feedback for the next one.
        </p>

        <div className="toolbar">
          <Link href="/trading/journal" className="button-link secondary">
            Back to Journal
          </Link>
          <Link href="/trading" className="button-link secondary">
            Trading Home
          </Link>
        </div>

        <div className="form-card">
          <TradingJournalEntryForm
            initialValues={initialValues}
            aiAssistEnabled={aiAssistEnabled}
            aiProviderLabel={getProviderLabel(aiProvider)}
            aiTierLabel={getTierLabel(aiTier)}
          />
        </div>
      </div>
    </main>
  );
}
