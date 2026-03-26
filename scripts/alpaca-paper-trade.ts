import nextEnv from "@next/env";
import {
  getAlpacaCredentials,
  submitMarketOrder,
} from "@/lib/alpaca";
import { getAlpacaPaperStrategySnapshot } from "@/lib/alpaca-paper-trading";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

function parseCliArgs(args: string[]) {
  return {
    execute: args.includes("--execute"),
  };
}

async function main() {
  const { execute } = parseCliArgs(process.argv.slice(2));
  const credentials = getAlpacaCredentials();
  const snapshot = await getAlpacaPaperStrategySnapshot();

  if (credentials.environment !== "paper" && execute) {
    throw new Error(
      "Order placement is blocked outside paper mode. Set ALPACA_ENVIRONMENT=paper.",
    );
  }

  if (!execute) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  if (snapshot.signal.action === "hold") {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  const orderQty = Math.floor(snapshot.maxNotional / snapshot.latestPrice);

  if (snapshot.signal.action === "buy" && orderQty < 1) {
    console.log(
      JSON.stringify(
        {
          ...snapshot,
          mode: "execution-skipped",
          reason: `Max notional ${snapshot.maxNotional.toFixed(2)} is too small to buy one share at ${snapshot.latestPrice.toFixed(2)}.`,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (snapshot.signal.action === "sell" && !snapshot.position) {
    console.log(
      JSON.stringify(
        {
          ...snapshot,
          mode: "execution-skipped",
          reason: "Sell signal was generated, but there is no open position.",
        },
        null,
        2,
      ),
    );
    return;
  }

  const order = await submitMarketOrder(
    {
      symbol: snapshot.symbol,
      qty:
        snapshot.signal.action === "buy"
          ? orderQty
          : Math.floor(snapshot.position!.qty),
      side: snapshot.signal.action,
      clientOrderId: `sma-${snapshot.symbol.toLowerCase()}-${Date.now()}`,
    },
    credentials,
  );

  console.log(
    JSON.stringify(
      {
        ...snapshot,
        order,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Unknown Alpaca strategy failure.",
  );
  process.exit(1);
});
