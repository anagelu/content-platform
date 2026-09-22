import { auth } from "@/auth";
import {
  getAlpacaAccount,
  getAlpacaCredentials,
  listAlpacaOrders,
  listAlpacaPositions,
  type AlpacaBarTimeframe,
} from "@/lib/alpaca";
import { getLiveConfluenceSnapshot } from "@/lib/algo-backtest";
import { NextResponse } from "next/server";

// Read-only mirror of the Controller V2 dashboard data for an external
// (Claude-hosted) viewer. No order placement lives here. Admin session only.
const VALID_TIMEFRAMES: AlpacaBarTimeframe[] = [
  "1Min",
  "5Min",
  "15Min",
  "30Min",
  "1Hour",
  "1Day",
  "1Week",
];

export async function GET(request: Request) {
  const session = await auth();

  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const symbolsParam = url.searchParams.get("symbols")?.trim();
    const symbols = symbolsParam
      ? symbolsParam
          .split(",")
          .map((value) => value.trim().toUpperCase())
          .filter(Boolean)
      : ["SPY"];
    const timeframeParam = url.searchParams.get("timeframe")?.trim() as
      | AlpacaBarTimeframe
      | null;
    const timeframe: AlpacaBarTimeframe = VALID_TIMEFRAMES.includes(
      timeframeParam as AlpacaBarTimeframe,
    )
      ? (timeframeParam as AlpacaBarTimeframe)
      : "1Day";

    const credentials = getAlpacaCredentials();

    const [account, positions, recentOrders] = await Promise.all([
      getAlpacaAccount(credentials),
      listAlpacaPositions(credentials),
      listAlpacaOrders({ status: "closed", limit: 10 }, credentials),
    ]);

    const confluenceResults = await Promise.allSettled(
      symbols.map((symbol) =>
        getLiveConfluenceSnapshot({ symbol, timeframe, credentials }),
      ),
    );

    const watchlist = confluenceResults.map((result, index) =>
      result.status === "fulfilled"
        ? result.value
        : {
            symbol: symbols[index],
            error:
              result.reason instanceof Error
                ? result.reason.message
                : "Failed to compute a live snapshot for this symbol.",
          },
    );

    return NextResponse.json({
      fetchedAt: new Date().toISOString(),
      environment: credentials.environment,
      account: {
        equity: account.equity,
        buyingPower: account.buyingPower,
        cash: account.cash,
        portfolioValue: account.portfolioValue,
      },
      positions: positions.map((position) => {
        const costBasis = position.qty * position.avgEntryPrice;

        return {
          symbol: position.symbol,
          qty: position.qty,
          availableQty: position.availableQty,
          heldForOrdersQty: position.heldForOrdersQty,
          side: position.side,
          avgEntryPrice: position.avgEntryPrice,
          marketValue: position.marketValue,
          costBasis,
          unrealizedPl: position.unrealizedPl,
          unrealizedPlPercent:
            costBasis > 0 ? (position.unrealizedPl / costBasis) * 100 : null,
        };
      }),
      recentOrders: recentOrders.map((order) => ({
        symbol: order.symbol,
        side: order.side,
        qty: order.qty,
        filledQty: order.filledQty,
        filledAvgPrice: order.filledAvgPrice,
        status: order.status,
        submittedAt: order.submittedAt,
        filledAt: order.filledAt,
      })),
      watchlist,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to build the algo dashboard snapshot.",
      },
      { status: 500 },
    );
  }
}
