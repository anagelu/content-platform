import { auth } from "@/auth";
import { type AlpacaBarTimeframe } from "@/lib/alpaca";
import { runAlgoBacktest } from "@/lib/algo-backtest";
import { getUserAlpacaCredentials } from "@/lib/alpaca-oauth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      symbol?: string;
      timeframe?: AlpacaBarTimeframe;
      startDate?: string;
      endDate?: string;
      trendThreshold?: number;
      timeframeConfluenceThreshold?: number;
      lookaheadBars?: number;
    };

    const credentials = await getUserAlpacaCredentials(Number(session.user.id));
    const report = await runAlgoBacktest({
      symbol: body.symbol?.trim() || "",
      timeframe: (body.timeframe || "1Min") as AlpacaBarTimeframe,
      startDate: body.startDate?.trim() || "",
      endDate: body.endDate?.trim() || "",
      trendThreshold: body.trendThreshold,
      timeframeConfluenceThreshold: body.timeframeConfluenceThreshold,
      lookaheadBars: body.lookaheadBars,
      credentials,
    });

    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Backtest simulation failed.",
      },
      { status: 400 },
    );
  }
}
