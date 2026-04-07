"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  createAlpacaOrderLog,
  listAlpacaOrderLogs,
  updateAlpacaOrderLog,
} from "@/lib/alpaca-order-log";
import {
  getAlpacaCredentials,
  type AlpacaBarTimeframe,
  type AlpacaOrder,
  getLatestCryptoTrade,
  listAlpacaOrders,
  listAlpacaPositions,
  getAlpacaPosition,
  isAlpacaCryptoSymbol,
  normalizeAlpacaTradingSymbol,
  submitMarketOrder,
  waitForOrderResolution,
} from "@/lib/alpaca";
import {
  type AlpacaPaperStrategyType,
  getAlpacaPaperStrategySnapshot,
} from "@/lib/alpaca-paper-trading";
import {
  getAlpacaTradeController,
  listAlpacaTradeControllers,
  upsertAlpacaTradeController,
} from "@/lib/alpaca-trade-controller";
import { runAlpacaAutomationCycle } from "@/lib/alpaca-controller-automation";

async function requireSignedInUser() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("You must be signed in to use the Alpaca algo workspace.");
  }

  return Number(session.user.id);
}

async function submitTrackedPaperOrder({
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
  const normalizedSymbol = normalizeAlpacaTradingSymbol(symbol);

  if (isAlpacaCryptoSymbol(normalizedSymbol)) {
    const latestTrade = await getLatestCryptoTrade(normalizedSymbol, credentials);
    const estimatedNotional = latestTrade.price * qty;

    if (estimatedNotional < 10) {
      throw new Error(
        `Estimated crypto order value is ${estimatedNotional.toFixed(2)} USD. Increase the size so the order value is at least 10 USD.`,
      );
    }
  }

  const submittedOrder = await submitMarketOrder(
    {
      symbol: normalizedSymbol,
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

  return resolution;
}

function normalizeControllerInput(input: {
  symbol: string;
  targetQty: number;
  strategyType: AlpacaPaperStrategyType;
  strategyTimeframe: AlpacaBarTimeframe;
  fastPeriod: number;
  slowPeriod: number;
  bollingerLength: number;
  bollingerStdDev: number;
  maxNotional: number;
  maxDailyLoss: number;
}) {
  const symbol = normalizeAlpacaTradingSymbol(input.symbol);
  const targetQty = Number(input.targetQty);
  const strategyTimeframe: AlpacaBarTimeframe =
    input.strategyTimeframe === "30Min" ||
    input.strategyTimeframe === "5Min" ||
    input.strategyTimeframe === "15Min" ||
    input.strategyTimeframe === "1Hour" ||
    input.strategyTimeframe === "1Day" ||
    input.strategyTimeframe === "1Week"
      ? input.strategyTimeframe
      : "1Min";
  const strategyType: AlpacaPaperStrategyType =
    input.strategyType === "BOLLINGER"
      ? "BOLLINGER"
      : input.strategyType === "EMA"
        ? "EMA"
      : input.strategyType === "SMA"
        ? "SMA"
        : "NONE";
  const fastPeriod = Math.floor(input.fastPeriod);
  const slowPeriod = Math.floor(input.slowPeriod);
  const bollingerLength = Math.floor(input.bollingerLength);
  const bollingerStdDev = Number(input.bollingerStdDev);

  if (!symbol) {
    throw new Error("Add a ticker symbol first.");
  }

  if (!Number.isFinite(targetQty) || targetQty <= 0) {
    throw new Error("Target position size must be greater than zero.");
  }

  if (!Number.isFinite(fastPeriod) || !Number.isFinite(slowPeriod)) {
    throw new Error("Fast and slow moving-average values must be valid numbers.");
  }

  if (
    (strategyType === "SMA" || strategyType === "EMA") &&
    slowPeriod <= fastPeriod
  ) {
    throw new Error(`Slow ${strategyType} must be greater than fast ${strategyType}.`);
  }

  if (
    strategyType === "BOLLINGER" &&
    (!Number.isFinite(bollingerLength) || bollingerLength < 5)
  ) {
    throw new Error("Bollinger length must be at least 5.");
  }

  if (
    strategyType === "BOLLINGER" &&
    (!Number.isFinite(bollingerStdDev) || bollingerStdDev <= 0)
  ) {
    throw new Error("Bollinger standard deviation must be greater than zero.");
  }

  return {
    symbol,
    targetQty,
    strategyType,
    strategyTimeframe,
    fastPeriod,
    slowPeriod,
    bollingerLength,
    bollingerStdDev,
    maxNotional: input.maxNotional,
    maxDailyLoss: input.maxDailyLoss,
  };
}

export async function getAlpacaAlgoSnapshot(input: {
  symbol: string;
  strategyType: AlpacaPaperStrategyType;
  strategyTimeframe: AlpacaBarTimeframe;
  fastPeriod: number;
  slowPeriod: number;
  bollingerLength: number;
  bollingerStdDev: number;
  maxNotional: number;
  maxDailyLoss: number;
}) {
  await requireSignedInUser();

  const symbol = input.symbol.trim().toUpperCase();

  if (!symbol) {
    throw new Error("Add a ticker symbol first.");
  }

  return getAlpacaPaperStrategySnapshot({
    symbol,
    strategyType: input.strategyType,
    timeframe: input.strategyTimeframe,
    fastPeriod: input.fastPeriod,
    slowPeriod: input.slowPeriod,
    bollingerLength: input.bollingerLength,
    bollingerStdDev: input.bollingerStdDev,
    maxNotional: input.maxNotional,
    maxDailyLoss: input.maxDailyLoss,
  });
}

export async function submitAlpacaPaperOrder(input: {
  symbol: string;
  qty: number;
  side: "buy" | "sell";
  strategyType: AlpacaPaperStrategyType;
  strategyTimeframe: AlpacaBarTimeframe;
  fastPeriod: number;
  slowPeriod: number;
  bollingerLength: number;
  bollingerStdDev: number;
  maxNotional: number;
  maxDailyLoss: number;
}) {
  const userId = await requireSignedInUser();

  const credentials = getAlpacaCredentials();

  if (credentials.environment !== "paper") {
    throw new Error("Website order entry is restricted to Alpaca paper mode.");
  }

  const symbol = input.symbol.trim().toUpperCase();
  const normalizedSymbol = normalizeAlpacaTradingSymbol(symbol);
  const qty = Number(input.qty);

  if (!normalizedSymbol) {
    throw new Error("Add a ticker symbol first.");
  }

  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error("Quantity must be greater than zero.");
  }

  const resolution = await submitTrackedPaperOrder({
    userId,
    symbol: normalizedSymbol,
    qty,
    side: input.side,
    clientOrderId: `manual-${input.side}-${normalizedSymbol.toLowerCase().replaceAll("/", "-")}-${Date.now()}`,
  });

  const snapshot = await getAlpacaPaperStrategySnapshot({
    symbol: normalizedSymbol,
    strategyType: input.strategyType,
    timeframe: input.strategyTimeframe,
    fastPeriod: input.fastPeriod,
    slowPeriod: input.slowPeriod,
    bollingerLength: input.bollingerLength,
    bollingerStdDev: input.bollingerStdDev,
    maxNotional: input.maxNotional,
    maxDailyLoss: input.maxDailyLoss,
  });

  revalidatePath("/trading/algo");

  return {
    order: resolution.order,
    reachedFinalState: resolution.reachedFinalState,
    snapshot,
  };
}

export async function getAlpacaOrderHistory() {
  const session = await auth();

  if (!session?.user?.id) {
    return [];
  }

  return listAlpacaOrderLogs(Number(session.user.id));
}

export async function getAlpacaControllerHistory() {
  const session = await auth();

  if (!session?.user?.id) {
    return [];
  }

  return listAlpacaTradeControllers(Number(session.user.id));
}

export async function runAlpacaAutomationNow() {
  await requireSignedInUser();
  const result = await runAlpacaAutomationCycle();
  revalidatePath("/trading/algo");
  return result;
}

export async function getAlpacaExecutionState() {
  await requireSignedInUser();

  const credentials = getAlpacaCredentials();
  const [positions, openOrders, recentOrders] = await Promise.all([
    listAlpacaPositions(credentials),
    listAlpacaOrders({ status: "open", limit: 25 }, credentials),
    listAlpacaOrders({ status: "all", limit: 50 }, credentials),
  ]);

  return {
    positions,
    openOrders,
    recentOrders,
  };
}

function normalizePositionActionQty(value: number) {
  const rounded = Number(value.toFixed(6));
  return rounded > 0 ? rounded : 0;
}

export type HeldAssetActionState = {
  error: string;
  success: string;
};

export async function manageAlpacaHeldAssetAction(
  _previousState: HeldAssetActionState,
  formData: FormData,
): Promise<HeldAssetActionState> {
  try {
    const userId = await requireSignedInUser();
    const credentials = getAlpacaCredentials();

    if (credentials.environment !== "paper") {
      return {
        error: "Quick position actions are restricted to Alpaca paper mode.",
        success: "",
      };
    }

    const rawSymbol = formData.get("symbol");
    const rawAction = formData.get("positionAction");
    const symbol =
      typeof rawSymbol === "string" ? normalizeAlpacaTradingSymbol(rawSymbol) : "";
    const positionAction =
      rawAction === "REDUCE_HALF" || rawAction === "CLOSE"
        ? rawAction
        : null;

    if (!symbol) {
      return {
        error: "Missing position symbol.",
        success: "",
      };
    }

    if (!positionAction) {
      return {
        error: "Invalid position action.",
        success: "",
      };
    }

    const position = await getAlpacaPosition(symbol, credentials);

    if (!position) {
      return {
        error: `No open position was found for ${symbol}.`,
        success: "",
      };
    }

    const absoluteQty = Math.abs(position.qty);
    const availableQty = Math.abs(position.availableQty);

    if (absoluteQty <= 0) {
      return {
        error: `No remaining quantity was found for ${symbol}.`,
        success: "",
      };
    }

    if (availableQty <= 0) {
      return {
        error: `${symbol} cannot be closed right now because the full position is reserved by another open order.`,
        success: "",
      };
    }

    const requestedQty =
      positionAction === "CLOSE"
        ? availableQty
        : normalizePositionActionQty(Math.min(availableQty, absoluteQty / 2));

    if (requestedQty <= 0) {
      return {
        error: `The available size for ${symbol} is too small to reduce further.`,
        success: "",
      };
    }

    const side = position.side === "short" ? "buy" : "sell";

    await submitTrackedPaperOrder({
      userId,
      symbol,
      qty: requestedQty,
      side,
      clientOrderId: `position-${positionAction.toLowerCase()}-${symbol.toLowerCase().replaceAll("/", "-")}-${Date.now()}`,
    });

    revalidatePath("/trading/algo");

    return {
      error: "",
      success:
        positionAction === "CLOSE"
          ? `${symbol} close order submitted for ${requestedQty}.`
          : `${symbol} reduce order submitted for ${requestedQty}.`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to manage this holding right now.",
      success: "",
    };
  }
}

export async function runAlpacaTradeController(input: {
  symbol: string;
  command: "PLAY" | "PAUSE" | "RESUME" | "EJECT";
  targetQty: number;
  strategyType: AlpacaPaperStrategyType;
  strategyTimeframe: AlpacaBarTimeframe;
  fastPeriod: number;
  slowPeriod: number;
  bollingerLength: number;
  bollingerStdDev: number;
  maxNotional: number;
  maxDailyLoss: number;
}) {
  const userId = await requireSignedInUser();
  const credentials = getAlpacaCredentials();

  if (credentials.environment !== "paper") {
    throw new Error("Trade controller execution is restricted to Alpaca paper mode.");
  }

  const normalized = normalizeControllerInput(input);
  const existingController = await getAlpacaTradeController(userId, normalized.symbol);
  const position = await getAlpacaPosition(normalized.symbol, credentials);
  const currentQty = position?.qty ?? 0;
  const orders: AlpacaOrder[] = [];
  let allOrdersReachedFinalState = true;
  let actionSummary = "";
  const preTradeSnapshot = await getAlpacaPaperStrategySnapshot({
    symbol: normalized.symbol,
    strategyType: normalized.strategyType,
    timeframe: normalized.strategyTimeframe,
    fastPeriod: normalized.fastPeriod,
    slowPeriod: normalized.slowPeriod,
    bollingerLength: normalized.bollingerLength,
    bollingerStdDev: normalized.bollingerStdDev,
    maxNotional: normalized.maxNotional,
    maxDailyLoss: normalized.maxDailyLoss,
  });

  if (input.command === "PLAY" || input.command === "RESUME") {
    if (existingController?.status === "EJECTED" && input.command === "RESUME") {
      throw new Error("Ejected controllers cannot be resumed. Use Play to start a new active cycle.");
    }

    if (normalized.strategyType === "NONE" && currentQty < normalized.targetQty) {
      const buyQty = normalized.targetQty - currentQty;
      const resolution = await submitTrackedPaperOrder({
        userId,
        symbol: normalized.symbol,
        qty: buyQty,
        side: "buy",
        clientOrderId: `controller-${input.command.toLowerCase()}-${normalized.symbol.toLowerCase().replaceAll("/", "-")}-${Date.now()}`,
      });
      orders.push(resolution.order);
      allOrdersReachedFinalState =
        allOrdersReachedFinalState && resolution.reachedFinalState;
      actionSummary = `Submitted buy order for ${buyQty} ${normalized.symbol}.`;
    } else if (normalized.strategyType === "NONE" && currentQty > normalized.targetQty) {
      const sellQty = currentQty - normalized.targetQty;
      const resolution = await submitTrackedPaperOrder({
        userId,
        symbol: normalized.symbol,
        qty: sellQty,
        side: "sell",
        clientOrderId: `controller-${input.command.toLowerCase()}-${normalized.symbol.toLowerCase().replaceAll("/", "-")}-${Date.now()}`,
      });
      orders.push(resolution.order);
      allOrdersReachedFinalState =
        allOrdersReachedFinalState && resolution.reachedFinalState;
      actionSummary = `Submitted sell order for ${sellQty} ${normalized.symbol} to match the target size.`;
    } else if (normalized.strategyType === "NONE" && currentQty === normalized.targetQty) {
      actionSummary = `Controller is already at the target size for ${normalized.symbol}.`;
    } else {
      actionSummary =
        input.command === "RESUME"
          ? `Controller resumed for ${normalized.symbol} on ${normalized.strategyTimeframe} and is waiting for a ${normalized.strategyType.toLowerCase()} signal.`
          : `Controller armed for ${normalized.symbol} on ${normalized.strategyTimeframe} and waiting for a ${normalized.strategyType.toLowerCase()} signal.`;
    }

    await upsertAlpacaTradeController({
      userId,
      symbol: normalized.symbol,
      status: "ACTIVE",
      targetQty: normalized.targetQty,
      strategyType: normalized.strategyType,
      strategyTimeframe: normalized.strategyTimeframe,
      fastPeriod: normalized.fastPeriod,
      slowPeriod: normalized.slowPeriod,
      bollingerLength: normalized.bollingerLength,
      bollingerStdDev: normalized.bollingerStdDev,
      maxNotional: normalized.maxNotional,
      maxDailyLoss: normalized.maxDailyLoss,
      lastCommand: input.command,
    });
  }

  if (input.command === "PAUSE" || input.command === "EJECT") {
    if (currentQty !== 0) {
      const exitQty = Math.abs(currentQty);
      const exitSide = currentQty > 0 ? "sell" : "buy";
      const resolution = await submitTrackedPaperOrder({
        userId,
        symbol: normalized.symbol,
        qty: exitQty,
        side: exitSide,
        clientOrderId: `controller-${input.command.toLowerCase()}-${normalized.symbol.toLowerCase().replaceAll("/", "-")}-${Date.now()}`,
      });
      orders.push(resolution.order);
      allOrdersReachedFinalState =
        allOrdersReachedFinalState && resolution.reachedFinalState;
      actionSummary = `Submitted ${exitSide} order to flatten ${exitQty} ${normalized.symbol}.`;
    } else {
      actionSummary = `No open position was found for ${normalized.symbol}, so the controller state was updated without sending a sell order.`;
    }

    await upsertAlpacaTradeController({
      userId,
      symbol: normalized.symbol,
      status: input.command === "PAUSE" ? "PAUSED" : "EJECTED",
      targetQty: normalized.targetQty,
      strategyType: normalized.strategyType,
      strategyTimeframe: normalized.strategyTimeframe,
      fastPeriod: normalized.fastPeriod,
      slowPeriod: normalized.slowPeriod,
      bollingerLength: normalized.bollingerLength,
      bollingerStdDev: normalized.bollingerStdDev,
      maxNotional: normalized.maxNotional,
      maxDailyLoss: normalized.maxDailyLoss,
      lastCommand: input.command,
    });
  }

  const snapshot = await getAlpacaPaperStrategySnapshot({
    symbol: normalized.symbol,
    strategyType: normalized.strategyType,
    timeframe: normalized.strategyTimeframe,
    fastPeriod: normalized.fastPeriod,
    slowPeriod: normalized.slowPeriod,
    bollingerLength: normalized.bollingerLength,
    bollingerStdDev: normalized.bollingerStdDev,
    maxNotional: normalized.maxNotional,
    maxDailyLoss: normalized.maxDailyLoss,
  });
  const controller = await getAlpacaTradeController(userId, normalized.symbol);
  revalidatePath("/trading/algo");
  revalidatePath("/trading/algo/controller-v2");

  return {
    controller,
    orders,
    reachedFinalState: allOrdersReachedFinalState,
    actionSummary,
    preTradeSignal: preTradeSnapshot.signal,
    snapshot,
  };
}
