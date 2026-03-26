import { auth } from "@/auth";
import { getAlphaVantageQuote } from "@/lib/market-data";
import { buildTradeAutofill } from "@/lib/trading";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "You must be signed in to use live autofill." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as {
      market?: string;
      timeframe?: string;
      setupType?: string;
      direction?: string;
    };

    const market = body.market?.trim().toUpperCase() || "";
    const timeframe = body.timeframe?.trim() || "";
    const setupType = body.setupType?.trim() || "";
    const direction = body.direction === "SHORT" ? "SHORT" : "LONG";

    if (!market || !timeframe) {
      throw new Error("Add a market and timeframe first.");
    }

    const quote = await getAlphaVantageQuote(market);

    if (!quote) {
      throw new Error(
        "Alpha Vantage did not return a live quote. Check the ticker symbol or API key.",
      );
    }

    return NextResponse.json({
      quote,
      autofill: buildTradeAutofill({
        market,
        price: quote.price,
        timeframe,
        setupType,
        direction,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Autofill failed.",
      },
      { status: 400 },
    );
  }
}
