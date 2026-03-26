import { auth } from "@/auth";
import { recordAiUsageEvent } from "@/lib/ai-usage";
import { generateTradingJournalAssist } from "@/lib/openai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = Number(session.user.id);
    const body = (await request.json()) as {
      title?: string;
      market?: string;
      timeframe?: string;
      direction?: string;
      executionNotes?: string;
      mistakeReview?: string;
      lessonLearned?: string;
    };

    const result = await generateTradingJournalAssist({
      title: body.title?.trim() || "",
      market: body.market?.trim() || "",
      timeframe: body.timeframe?.trim() || "",
      direction: body.direction?.trim() || "",
      executionNotes: body.executionNotes?.trim() || "",
      mistakeReview: body.mistakeReview?.trim() || "",
      lessonLearned: body.lessonLearned?.trim() || "",
    });

    await recordAiUsageEvent({
      userId: Number.isFinite(userId) ? userId : null,
      feature: "trading_journal_assist",
      model: result.model,
      usage: result.usage,
    });

    return NextResponse.json({
      title: result.title,
      summary: result.summary,
      lessonLearned: result.lessonLearned,
      model: result.model,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Trading journal AI assist failed.",
      },
      { status: 400 },
    );
  }
}
