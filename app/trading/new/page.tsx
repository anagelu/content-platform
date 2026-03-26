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
import { prisma } from "@/lib/prisma";
import { TradingSessionForm } from "./trading-session-form";

function getParamValue(
  value: string | string[] | undefined,
) {
  return typeof value === "string" ? value.trim() : "";
}

function getInitialTradingSessionValues(
  searchParams: Record<string, string | string[] | undefined> | undefined,
) {
  const market = getParamValue(searchParams?.market).toUpperCase();
  const preset = getParamValue(searchParams?.preset).toLowerCase();

  if (market !== "SPX") {
    return undefined;
  }

  const baseValues = {
    market: "SPX",
    timeframe: "5m",
    chartTimeframe: "5m",
  };

  if (preset === "orb") {
    return {
      ...baseValues,
      title: "SPX Opening Range Break",
      setupType: "OPENING_RANGE_BREAK",
    };
  }

  if (preset === "trend") {
    return {
      ...baseValues,
      title: "SPX Trend Day Continuation",
      setupType: "TREND_CONTINUATION",
    };
  }

  if (preset === "fade") {
    return {
      ...baseValues,
      title: "SPX Mean Reversion Fade",
      setupType: "MEAN_REVERSION",
      direction: "SHORT" as const,
    };
  }

  return {
    ...baseValues,
    title: "SPX Session Plan",
  };
}

export default async function NewTradingSessionPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: Number(session.user.id),
    },
  });
  const [aiAssistEnabled, aiProvider, aiTier] = await Promise.all([
    isAiProviderConfigured(),
    getAiProvider(),
    getAiCapacityTier(),
  ]);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const importedFromPosts = resolvedSearchParams?.from === "posts";
  const initialValues = getInitialTradingSessionValues(resolvedSearchParams);

  return (
    <main>
      <div className="site-shell">
        <h1 className="page-title">New Trading Session</h1>
        <p className="page-subtitle">
          Capture a trade thesis, keep the source thinking, and gradually build
          a workflow that can evolve into a public framework with credit.
        </p>

        <div className="toolbar">
          <Link href="/trading" className="button-link secondary">
            Back to Trading
          </Link>
          <Link href="/trading/tools" className="button-link secondary">
            Tools
          </Link>
        </div>

        <TradingSessionForm
          user={{
            publicTradingProfile: user?.publicTradingProfile ?? false,
            tradingFocus: user?.tradingFocus ?? "",
            tradingBio: user?.tradingBio ?? "",
          }}
          initialValues={initialValues}
          importedFromPosts={importedFromPosts}
          aiAssistEnabled={aiAssistEnabled}
          aiProviderLabel={getProviderLabel(aiProvider)}
          aiTierLabel={getTierLabel(aiTier)}
        />
      </div>
    </main>
  );
}
