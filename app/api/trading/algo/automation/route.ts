import { NextResponse } from "next/server";
import { runAlpacaAutomationCycle } from "@/lib/alpaca-controller-automation";

export async function POST(request: Request) {
  const expectedSecret = process.env.ALPACA_AUTOMATION_SECRET?.trim();

  if (expectedSecret) {
    const providedSecret =
      request.headers.get("x-alpaca-automation-secret")?.trim() ?? "";

    if (providedSecret !== expectedSecret) {
      return NextResponse.json(
        { error: "Unauthorized automation request." },
        { status: 401 },
      );
    }
  }

  try {
    const result = await runAlpacaAutomationCycle();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown Alpaca automation failure.",
      },
      { status: 500 },
    );
  }
}
