import { recordAiUsageEvent } from "@/lib/ai-usage";
import { generatePostDraftFromSourceChat } from "@/lib/openai";
import {
  checkTryDemoRateLimit,
  getRequestIp,
  hashIp,
  recordTryDemoUsage,
} from "@/lib/try-demo-usage";
import { NextResponse } from "next/server";

// Public, no-login demo endpoint for /try. Anyone on the internet can hit
// this (that's the point — it's meant to be linked from social posts), so
// unlike every other /api/ai/* route it has no auth() check. In its place:
// a shorter input cap than the signed-in flow, and a per-IP + site-wide
// daily cap (lib/try-demo-usage.ts) so a viral spike can't run up the bill
// or be scripted into a free-generation abuse vector.
const MAX_DEMO_IDEA_CHARS = 1200;

export async function POST(request: Request) {
  try {
    const ip = getRequestIp(request);
    const ipHash = hashIp(ip);

    const rateLimit = await checkTryDemoRateLimit(ipHash);

    if (!rateLimit.allowed) {
      const message =
        rateLimit.reason === "per_ip"
          ? "You've used up today's free demo generations. Create a free account for unlimited drafts."
          : "The free demo is busy right now — please try again later, or create a free account to generate right away.";

      return NextResponse.json({ error: message }, { status: 429 });
    }

    const body = (await request.json()) as { idea?: string };
    const idea = body.idea?.trim() || "";

    if (!idea) {
      return NextResponse.json(
        { error: "Paste a rough idea, note, or conversation first." },
        { status: 400 },
      );
    }

    if (idea.length > MAX_DEMO_IDEA_CHARS) {
      return NextResponse.json(
        {
          error: `Keep the demo input under ${MAX_DEMO_IDEA_CHARS} characters. Create a free account for the full-length generator.`,
        },
        { status: 400 },
      );
    }

    const result = await generatePostDraftFromSourceChat({
      title: "",
      sourceChat: idea,
    });

    await Promise.all([
      recordTryDemoUsage(ipHash),
      recordAiUsageEvent({
        userId: null,
        feature: "try_demo",
        model: result.model,
        usage: result.usage,
      }),
    ]);

    return NextResponse.json({
      title: result.title,
      summary: result.summary,
      article: result.article,
      model: result.model,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The demo generator hit a snag. Please try again.",
      },
      { status: 400 },
    );
  }
}
