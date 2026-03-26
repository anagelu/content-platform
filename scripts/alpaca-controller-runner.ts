import nextEnv from "@next/env";
import { runAlpacaAutomationCycle } from "@/lib/alpaca-controller-automation";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

function parseCliArgs(args: string[]) {
  const watch = args.includes("--watch");
  const intervalArg = args.find((arg) => arg.startsWith("--interval="));
  const intervalSeconds = intervalArg ? Number(intervalArg.split("=")[1]) : 30;

  return {
    watch,
    intervalSeconds:
      Number.isFinite(intervalSeconds) && intervalSeconds > 0
        ? intervalSeconds
        : 30,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function runCycle() {
  const result = await runAlpacaAutomationCycle();
  console.log(JSON.stringify(result, null, 2));
}

async function main() {
  const { watch, intervalSeconds } = parseCliArgs(process.argv.slice(2));

  if (!watch) {
    await runCycle();
    return;
  }

  console.log(
    `Starting Alpaca controller runner in watch mode. Interval: ${intervalSeconds}s`,
  );

  while (true) {
    await runCycle();
    await sleep(intervalSeconds * 1000);
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Unknown Alpaca automation failure.",
  );
  process.exit(1);
});
