import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAlpacaControllerHistory, getAlpacaExecutionState } from "../actions";
import { AlgoControllerV2 } from "./algo-controller-v2";

export default async function TradingAlgoControllerV2Page({
  searchParams,
}: {
  searchParams?: Promise<{ symbol?: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const [controllers, executionState, params] = await Promise.all([
    getAlpacaControllerHistory(),
    getAlpacaExecutionState(),
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);

  const totalUnrealizedPl = executionState.positions.reduce(
    (sum, position) => sum + position.unrealizedPl,
    0,
  );
  const initialSymbol =
    params?.symbol?.trim().toUpperCase() ||
    controllers[0]?.symbol ||
    executionState.positions[0]?.symbol ||
    "SPY";

  return (
    <main>
      <div className="site-shell site-shell-wide">
        <h1 className="page-title">Algo Controller V2</h1>
        <p className="page-subtitle">
          Experimental control surface for comparing the standard stock workflow with a future
          Turbo mode for options-style execution. This version reuses the current Alpaca algo state
          while we test a faster cockpit layout.
        </p>

        <div className="toolbar">
          <Link href="/trading/algo" className="button-link secondary">
            Back to Algo Workspace
          </Link>
          <Link href="/trading" className="button-link secondary">
            Back to Trading
          </Link>
        </div>

        <AlgoControllerV2
          initialSymbol={initialSymbol}
          initialControllers={controllers}
          initialPositions={executionState.positions}
          initialPnl={totalUnrealizedPl}
        />
      </div>
    </main>
  );
}
