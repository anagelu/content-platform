import { auth } from "@/auth";
import { recordAiUsageEvent } from "@/lib/ai-usage";
import { generateAlgoControllerV2Copilot } from "@/lib/openai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = Number(session.user.id);
    const body = (await request.json()) as {
      userMessage?: string;
      contextText?: string;
      conversationText?: string;
    };

    const result = await generateAlgoControllerV2Copilot({
      userMessage: body.userMessage?.trim() || "",
      contextText: body.contextText?.trim() || "",
      conversationText: body.conversationText?.trim() || "",
    });

    await recordAiUsageEvent({
      userId: Number.isFinite(userId) ? userId : null,
      feature: "algo_controller_v2_copilot",
      model: result.model,
      usage: result.usage,
    });

    return NextResponse.json({
      reply: result.reply,
      suggestedActions: result.suggestedActions,
      warnings: result.warnings,
      recommendedMode: result.recommendedMode,
      model: result.model,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Algo Controller V2 copilot request failed.",
      },
      { status: 400 },
    );
  }
}
