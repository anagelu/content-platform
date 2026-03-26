"use server";

import { auth } from "@/auth";
import { getMarketQuote } from "@/lib/market-data";
import { prisma } from "@/lib/prisma";
import { normalizeChartTimeframe } from "@/lib/chart-timeframes";
import { upsertTradingChartContext } from "@/lib/trading-chart-context";
import {
  buildTradingSetupNarrative,
  extractTradingSetupContext,
  getTradingSetupDefinition,
} from "@/lib/trading-setups";
import {
  buildStructuredTradingSummary,
  buildTradeAutofill,
  buildPersonalizedInsight,
  generateUniqueTradingSessionSlug,
} from "@/lib/trading";
import { redirect } from "next/navigation";

export async function getTradingAutoFill(input: {
  market: string;
  timeframe: string;
  setupType: string;
  direction: string;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("You must be signed in to use live autofill.");
  }

  const market = input.market.trim().toUpperCase();
  const timeframe = input.timeframe.trim();
  const setupType = input.setupType.trim();
  const direction = input.direction === "SHORT" ? "SHORT" : "LONG";

  if (!market || !timeframe) {
    throw new Error("Add a market and timeframe first.");
  }

  const quote = await getMarketQuote(market);

  if (!quote) {
    throw new Error(
      "No live quote was available. Check the ticker or your market data API key.",
    );
  }

  return {
    quote,
    autofill: buildTradeAutofill({
      market,
      price: quote.price,
      timeframe,
      setupType,
      direction,
    }),
  };
}

export async function createTradingSession(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const authorId = Number(session.user.id);
  const title = formData.get("title")?.toString().trim() || "";
  const market = formData.get("market")?.toString().trim() || "";
  const timeframe = formData.get("timeframe")?.toString().trim() || "";
  const setupType = formData.get("setupType")?.toString().trim() || "";
  const direction = formData.get("direction")?.toString().trim() || "LONG";
  const thesis = formData.get("thesis")?.toString().trim() || "";
  const entryMin = Number(formData.get("entryMin"));
  const entryMax = Number(formData.get("entryMax"));
  const stopLoss = Number(formData.get("stopLoss"));
  const targetOne = Number(formData.get("targetOne"));
  const targetTwoValue = formData.get("targetTwo")?.toString().trim() || "";
  const confidence = Number(formData.get("confidence"));
  const outcome = formData.get("outcome")?.toString().trim() || "PENDING";
  const sourceChat = formData.get("sourceChat")?.toString().trim() || "";
  const workflowNotes = formData.get("workflowNotes")?.toString().trim() || "";
  const chartTimeframe = normalizeChartTimeframe(
    formData.get("chartTimeframe")?.toString().trim() || timeframe,
  );
  const chartScreenshotUrl =
    formData.get("chartScreenshotUrl")?.toString().trim() || "";
  const chartNotes = formData.get("chartNotes")?.toString().trim() || "";
  const publicTradingProfile =
    formData.get("publicTradingProfile")?.toString() === "on";
  const featuredPublic = formData.get("featuredPublic")?.toString() === "on";
  const tradingFocus = formData.get("tradingFocus")?.toString().trim() || "";
  const tradingBio = formData.get("tradingBio")?.toString().trim() || "";
  const setupDefinition = getTradingSetupDefinition(setupType);
  const normalizedSetupType = setupDefinition?.label ?? setupType;
  const setupContext = extractTradingSetupContext(formData, setupType);
  const setupNarrative = buildTradingSetupNarrative(setupContext);

  if (
    !title ||
    !market ||
    !timeframe ||
    !setupType ||
    !thesis ||
    !Number.isFinite(entryMin) ||
    !Number.isFinite(entryMax) ||
    !Number.isFinite(stopLoss) ||
    !Number.isFinite(targetOne) ||
    !Number.isFinite(confidence)
  ) {
    throw new Error("Fill in the required trading recommendation fields.");
  }

  const slug = await generateUniqueTradingSessionSlug(title);
  const priorSessions = await prisma.tradingSession.findMany({
    where: {
      authorId,
    },
    select: {
      market: true,
      timeframe: true,
      setupType: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  const liveQuote = await getMarketQuote(market);

  const summary = buildStructuredTradingSummary({
    market,
    timeframe,
    setupType: normalizedSetupType,
    direction: direction === "SHORT" ? "SHORT" : "LONG",
    thesis,
    workflowNotes,
    chartNotes,
    setupNarrative,
    entryMin,
    entryMax,
    stopLoss,
    targetOne,
    targetTwo: targetTwoValue ? Number(targetTwoValue) : null,
    confidence,
    currentPrice: liveQuote?.price ?? null,
  });
  const personalizedInsight = buildPersonalizedInsight({
    market,
    timeframe,
    setupType: normalizedSetupType,
    priorSessions,
  });

  await prisma.user.update({
    where: {
      id: authorId,
    },
    data: {
      publicTradingProfile,
      tradingBio: tradingBio || null,
      tradingFocus: tradingFocus || null,
    },
  });

  const tradingSession = await prisma.tradingSession.create({
    data: {
      title,
      slug,
      market,
      timeframe,
      setupType: normalizedSetupType,
      direction: direction === "SHORT" ? "SHORT" : "LONG",
      thesis,
      summary,
      entryMin,
      entryMax,
      stopLoss,
      targetOne,
      targetTwo: targetTwoValue ? Number(targetTwoValue) : null,
      confidence,
      outcome:
        outcome === "HIT_TARGET" ||
        outcome === "STOPPED_OUT" ||
        outcome === "PARTIAL" ||
        outcome === "INVALIDATED"
          ? outcome
          : "PENDING",
      sourceChat: sourceChat || null,
      setupContext: setupContext ? JSON.stringify(setupContext) : null,
      workflowNotes: workflowNotes || null,
      personalizedInsight,
      featuredPublic: publicTradingProfile && featuredPublic,
      authorId,
    },
  });

  await upsertTradingChartContext({
    tradingSessionId: tradingSession.id,
    chartTimeframe: chartTimeframe || null,
    screenshotUrl: chartScreenshotUrl || null,
    chartNotes: chartNotes || null,
  });

  redirect(`/trading/${tradingSession.slug}`);
}
