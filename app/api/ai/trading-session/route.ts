import { auth } from "@/auth";
import { recordAiUsageEvent } from "@/lib/ai-usage";
import { getAlphaVantageQuote } from "@/lib/market-data";
import { generateTradingSessionAssist } from "@/lib/openai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = Number(session.user.id);
    const body = (await request.json()) as {
      title?: string;
      market?: string;
      timeframe?: string;
      setupType?: string;
      direction?: string;
      sourceChat?: string;
      setupContextText?: string;
      chartTimeframe?: string;
      chartScreenshotUrl?: string;
      chartNotes?: string;
    };
    const liveQuote = body.market?.trim()
      ? await getAlphaVantageQuote(body.market.trim())
      : null;

    const result = await generateTradingSessionAssist({
      title: body.title?.trim() || "",
      market: body.market?.trim() || "",
      timeframe: body.timeframe?.trim() || "",
      setupType: body.setupType?.trim() || "",
      direction: body.direction?.trim() || "",
      sourceChat: body.sourceChat?.trim() || "",
      setupContextText: body.setupContextText?.trim() || "",
      chartTimeframe: body.chartTimeframe?.trim() || "",
      chartScreenshotUrl: body.chartScreenshotUrl?.trim() || "",
      chartNotes: body.chartNotes?.trim() || "",
      livePrice: liveQuote?.price ?? null,
      liveChange: liveQuote?.change ?? null,
      liveChangePercent: liveQuote?.changePercent ?? null,
      liveFetchedAt: liveQuote?.fetchedAt ?? "",
    });

    await recordAiUsageEvent({
      userId: Number.isFinite(userId) ? userId : null,
      feature: "trading_session_assist",
      model: result.model,
      usage: result.usage,
    });

    return NextResponse.json({
      title: result.title,
      thesis: result.thesis,
      workflowNotes: result.workflowNotes,
      model: result.model,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Trading session AI assist failed.",
      },
      { status: 400 },
    );
  }
}
