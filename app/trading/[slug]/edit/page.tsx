import { auth } from "@/auth";
import {
  getAiCapacityTier,
  getAiProvider,
  getProviderLabel,
  getTierLabel,
  isAiProviderConfigured,
} from "@/lib/ai-admin";
import { getTradingChartContext } from "@/lib/trading-chart-context";
import { prisma } from "@/lib/prisma";
import { parseTradingSetupContext } from "@/lib/trading-setups";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TradingSessionForm } from "@/app/trading/new/trading-session-form";
import { updateTradingSession } from "./actions";

export default async function EditTradingSessionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { slug } = await params;

  const tradingSession = await prisma.tradingSession.findUnique({
    where: {
      slug,
    },
    include: {
      author: true,
    },
  });

  if (!tradingSession) {
    return <div style={{ padding: "2rem" }}>Trading session not found.</div>;
  }

  const canManage =
    session.user.role === "admin" ||
    session.user.id === String(tradingSession.authorId);

  if (!canManage) {
    redirect(`/trading/${tradingSession.slug}`);
  }

  const [aiAssistEnabled, aiProvider, aiTier] = await Promise.all([
    isAiProviderConfigured(),
    getAiProvider(),
    getAiCapacityTier(),
  ]);
  const chartContext = await getTradingChartContext(tradingSession.id);

  return (
    <main>
      <div className="site-shell">
        <h1 className="page-title">Edit Trading Session</h1>
        <p className="page-subtitle">
          Refine the setup, thesis, and execution plan without losing the
          structure of the original submission.
        </p>

        <div className="toolbar">
          <Link
            href={`/trading/${tradingSession.slug}`}
            className="button-link secondary"
          >
            Back to Session
          </Link>
          <Link href="/trading" className="button-link secondary">
            Trading Home
          </Link>
        </div>

        <TradingSessionForm
          action={updateTradingSession}
          submitLabel="Update Trading Session"
          aiAssistEnabled={aiAssistEnabled}
          aiProviderLabel={getProviderLabel(aiProvider)}
          aiTierLabel={getTierLabel(aiTier)}
          user={{
            publicTradingProfile: tradingSession.author.publicTradingProfile,
            tradingFocus: tradingSession.author.tradingFocus ?? "",
            tradingBio: tradingSession.author.tradingBio ?? "",
          }}
          initialValues={{
            id: tradingSession.id,
            title: tradingSession.title,
            market: tradingSession.market,
            timeframe: tradingSession.timeframe,
            setupType: tradingSession.setupType,
            direction: tradingSession.direction,
            entryMin: String(tradingSession.entryMin),
            entryMax: String(tradingSession.entryMax),
            stopLoss: String(tradingSession.stopLoss),
            targetOne: String(tradingSession.targetOne),
            targetTwo: tradingSession.targetTwo ? String(tradingSession.targetTwo) : "",
            confidence: String(tradingSession.confidence),
            outcome: tradingSession.outcome,
            thesis: tradingSession.thesis,
            workflowNotes: tradingSession.workflowNotes ?? "",
            sourceChat: tradingSession.sourceChat ?? "",
            chartTimeframe: chartContext?.chartTimeframe ?? tradingSession.timeframe,
            chartScreenshotUrl: chartContext?.screenshotUrl ?? "",
            chartNotes: chartContext?.chartNotes ?? "",
            featuredPublic: tradingSession.featuredPublic,
            setupContext: parseTradingSetupContext(tradingSession.setupContext),
          }}
        />
      </div>
    </main>
  );
}
