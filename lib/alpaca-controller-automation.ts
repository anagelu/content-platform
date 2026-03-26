import {
  createAlpacaOrderLog,
  updateAlpacaOrderLog,
} from "@/lib/alpaca-order-log";
import {
  getAlpacaCredentials,
  getAlpacaPosition,
  type AlpacaOrder,
  listAlpacaOrders,
  submitMarketOrder,
  waitForOrderResolution,
} from "@/lib/alpaca";
import {
  getAlpacaPaperStrategySnapshot,
  type AlpacaPaperStrategyDecision,
} from "@/lib/alpaca-paper-trading";
import {
  listActiveAlpacaTradeControllers,
  type AlpacaTradeController,
} from "@/lib/alpaca-trade-controller";

type ControllerExecutionResult =
  | {
      controllerId: number;
      userId: number;
      symbol: string;
      status: "executed";
      reason: string;
      signal: AlpacaPaperStrategyDecision;
      orders: AlpacaOrder[];
    }
  | {
      controllerId: number;
      userId: number;
      symbol: string;
      status: "skipped";
      reason: string;
      signal: AlpacaPaperStrategyDecision | null;
      orders: AlpacaOrder[];
    }
  | {
      controllerId: number;
      userId: number;
      symbol: string;
      status: "error";
      reason: string;
      signal: AlpacaPaperStrategyDecision | null;
      orders: AlpacaOrder[];
    };

export type AlpacaAutomationCycleResult = {
  environment: "paper" | "live";
  ranAt: string;
  activeControllers: number;
  processedControllers: number;
  executedOrders: number;
  results: ControllerExecutionResult[];
};

async function submitTrackedAutomationOrder({
  userId,
  symbol,
  qty,
  side,
  clientOrderId,
}: {
  userId: number;
  symbol: string;
  qty: number;
  side: "buy" | "sell";
  clientOrderId: string;
}) {
  const credentials = getAlpacaCredentials();
  const submittedOrder = await submitMarketOrder(
    {
      symbol,
      qty,
      side,
      clientOrderId,
    },
    credentials,
  );

  await createAlpacaOrderLog({
    userId,
    environment: credentials.environment,
    symbol: submittedOrder.symbol,
    side: submittedOrder.side,
    orderType: submittedOrder.type,
    timeInForce: submittedOrder.timeInForce,
    status: submittedOrder.status,
    qty: submittedOrder.qty,
    notional: submittedOrder.notional,
    filledQty: submittedOrder.filledQty,
    filledAvgPrice: submittedOrder.filledAvgPrice,
    alpacaOrderId: submittedOrder.id,
    clientOrderId: submittedOrder.clientOrderId,
  });

  const resolution = await waitForOrderResolution(submittedOrder.id, undefined, credentials);

  await updateAlpacaOrderLog({
    userId,
    alpacaOrderId: resolution.order.id,
    status: resolution.order.status,
    qty: resolution.order.qty,
    notional: resolution.order.notional,
    filledQty: resolution.order.filledQty,
    filledAvgPrice: resolution.order.filledAvgPrice,
  });

  return resolution.order;
}

async function executeController(
  controller: AlpacaTradeController,
): Promise<ControllerExecutionResult> {
  try {
    if (controller.strategyType === "NONE") {
      return {
        controllerId: controller.id,
        userId: controller.userId,
        symbol: controller.symbol,
        status: "skipped",
        reason:
          "No Strategy mode is manual-only. The automation runner does not auto-enter or auto-exit it.",
        signal: null,
        orders: [],
      };
    }

    const credentials = getAlpacaCredentials();
    const openOrders = await listAlpacaOrders({
      status: "open",
      symbols: [controller.symbol],
      limit: 10,
    }, credentials);

    if (openOrders.length > 0) {
      return {
        controllerId: controller.id,
        userId: controller.userId,
        symbol: controller.symbol,
        status: "skipped",
        reason: "Skipped because Alpaca still has an open order for this symbol.",
        signal: null,
        orders: [],
      };
    }

    const [snapshot, position] = await Promise.all([
      getAlpacaPaperStrategySnapshot({
        symbol: controller.symbol,
        strategyType: controller.strategyType,
        timeframe: controller.strategyTimeframe,
        fastPeriod: controller.fastPeriod,
        slowPeriod: controller.slowPeriod,
        bollingerLength: controller.bollingerLength,
        bollingerStdDev: controller.bollingerStdDev,
        maxNotional: controller.maxNotional,
        maxDailyLoss: controller.maxDailyLoss,
      }),
      getAlpacaPosition(controller.symbol, credentials),
    ]);

    const currentQty = position?.qty ?? 0;

    if (snapshot.signal.action === "buy") {
      if (currentQty >= controller.targetQty) {
        return {
          controllerId: controller.id,
          userId: controller.userId,
          symbol: controller.symbol,
          status: "skipped",
          reason: "Buy signal detected, but the controller is already at or above target size.",
          signal: snapshot.signal,
          orders: [],
        };
      }

      const buyQty = controller.targetQty - currentQty;
      const order = await submitTrackedAutomationOrder({
        userId: controller.userId,
        symbol: controller.symbol,
        qty: buyQty,
        side: "buy",
        clientOrderId: `auto-buy-${controller.symbol.toLowerCase().replaceAll("/", "-")}-${Date.now()}`,
      });

      return {
        controllerId: controller.id,
        userId: controller.userId,
        symbol: controller.symbol,
        status: "executed",
        reason: snapshot.signal.reason,
        signal: snapshot.signal,
        orders: [order],
      };
    }

    if (snapshot.signal.action === "sell") {
      if (currentQty <= 0) {
        return {
          controllerId: controller.id,
          userId: controller.userId,
          symbol: controller.symbol,
          status: "skipped",
          reason: "Sell signal detected, but there is no open position to exit.",
          signal: snapshot.signal,
          orders: [],
        };
      }

      const order = await submitTrackedAutomationOrder({
        userId: controller.userId,
        symbol: controller.symbol,
        qty: currentQty,
        side: "sell",
        clientOrderId: `auto-sell-${controller.symbol.toLowerCase().replaceAll("/", "-")}-${Date.now()}`,
      });

      return {
        controllerId: controller.id,
        userId: controller.userId,
        symbol: controller.symbol,
        status: "executed",
        reason: snapshot.signal.reason,
        signal: snapshot.signal,
        orders: [order],
      };
    }

    return {
      controllerId: controller.id,
      userId: controller.userId,
      symbol: controller.symbol,
      status: "skipped",
      reason: snapshot.signal.reason,
      signal: snapshot.signal,
      orders: [],
    };
  } catch (error) {
    return {
      controllerId: controller.id,
      userId: controller.userId,
      symbol: controller.symbol,
      status: "error",
      reason:
        error instanceof Error
          ? error.message
          : "Unknown automation error while processing controller.",
      signal: null,
      orders: [],
    };
  }
}

export async function runAlpacaAutomationCycle(): Promise<AlpacaAutomationCycleResult> {
  const credentials = getAlpacaCredentials();

  if (credentials.environment !== "paper") {
    throw new Error(
      "Automated controller execution is restricted to Alpaca paper mode.",
    );
  }

  const activeControllers = await listActiveAlpacaTradeControllers();
  const results: ControllerExecutionResult[] = [];

  for (const controller of activeControllers) {
    results.push(await executeController(controller));
  }

  return {
    environment: credentials.environment,
    ranAt: new Date().toISOString(),
    activeControllers: activeControllers.length,
    processedControllers: results.length,
    executedOrders: results.reduce(
      (sum, result) => sum + result.orders.length,
      0,
    ),
    results,
  };
}
