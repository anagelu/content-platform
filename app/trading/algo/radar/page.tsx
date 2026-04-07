import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAlpacaControllerHistory, getAlpacaExecutionState } from "../actions";
import { AlgoRadarPage } from "./algo-radar-page";

export default async function TradingAlgoRadarPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  let initialSymbols: string[] = [];

  try {
    const [controllers, executionState] = await Promise.all([
      getAlpacaControllerHistory(),
      getAlpacaExecutionState(),
    ]);

    initialSymbols = Array.from(
      new Set([
        ...controllers.map((controller) => controller.symbol),
        ...executionState.positions.map((position) => position.symbol),
      ]),
    ).filter(Boolean);
  } catch {
    initialSymbols = ["SPY", "QQQ", "NVDA", "BTC/USD"];
  }

  return (
    <main>
      <div className="site-shell site-shell-wide">
        <h1 className="page-title">Confluence Radar</h1>
        <p className="page-subtitle">
          Scan a targeted watchlist against the detector stack and surface symbols that are already
          moving into your favorable entry range.
        </p>

        <div className="toolbar">
          <Link href="/trading/algo" className="button-link secondary">
            Back to Algo Workspace
          </Link>
          <Link href="/trading/algo/controller-v2" className="button-link secondary">
            Open Controller V2
          </Link>
          <Link href="/trading" className="button-link secondary">
            Back to Trading
          </Link>
        </div>

        <AlgoRadarPage initialSymbols={initialSymbols} />
      </div>
    </main>
  );
}
