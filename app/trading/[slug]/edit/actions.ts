"use server";

import { auth } from "@/auth";
import { normalizeChartTimeframe } from "@/lib/chart-timeframes";
import { getMarketQuote } from "@/lib/market-data";
import { prisma } from "@/lib/prisma";
import { upsertTradingChartContext } from "@/lib/trading-chart-context";
import {
  buildTradingSetupNarrative,
  extractTradingSetupContext,
  getTradingSetupDefinition,
} from "@/lib/trading-setups";
import {
  buildPersonalizedInsight,
  buildStructuredTradingSummary,
} from "@/lib/trading";
import { redirect } from "next/navigation";

export async function updateTradingSession(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const id = Number(formData.get("id"));
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

  if (
    !id ||
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

  const existingTradingSession = await prisma.tradingSession.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      slug: true,
      authorId: true,
    },
  });

  if (!existingTradingSession) {
    throw new Error("Trading session not found.");
  }

  const canManage =
    session.user.role === "admin" ||
    session.user.id === String(existingTradingSession.authorId);

  if (!canManage) {
    throw new Error("You do not have permission to edit this trading session.");
  }

  const setupDefinition = getTradingSetupDefinition(setupType);
  const normalizedSetupType = setupDefinition?.label ?? setupType;
  const setupContext = extractTradingSetupContext(formData, setupType);
  const setupNarrative = buildTradingSetupNarrative(setupContext);

  const priorSessions = await prisma.tradingSession.findMany({
    where: {
      authorId: existingTradingSession.authorId,
      NOT: {
        id,
      },
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

  await prisma.user.update({
    where: {
      id: existingTradingSession.authorId,
    },
    data: {
      publicTradingProfile,
      tradingBio: tradingBio || null,
      tradingFocus: tradingFocus || null,
    },
  });
  const liveQuote = await getMarketQuote(market);

  const updatedTradingSession = await prisma.tradingSession.update({
    where: {
      id,
    },
    data: {
      title,
      market,
      timeframe,
      setupType: normalizedSetupType,
      direction: direction === "SHORT" ? "SHORT" : "LONG",
      thesis,
      summary: buildStructuredTradingSummary({
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
      }),
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
      personalizedInsight: buildPersonalizedInsight({
        market,
        timeframe,
        setupType: normalizedSetupType,
        priorSessions,
      }),
      featuredPublic: publicTradingProfile && featuredPublic,
    },
  });

  await upsertTradingChartContext({
    tradingSessionId: updatedTradingSession.id,
    chartTimeframe: chartTimeframe || null,
    screenshotUrl: chartScreenshotUrl || null,
    chartNotes: chartNotes || null,
  });

  redirect(`/trading/${updatedTradingSession.slug}`);
}
