import { auth } from "@/auth";
import { recordAiUsageEvent } from "@/lib/ai-usage";
import { refinePostDraftWithAi } from "@/lib/openai";
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
      sourceChat?: string;
      authorNotes?: string;
      currentSummary?: string;
      currentArticle?: string;
      intent?: "regenerate" | "improve" | "shorter" | "detailed" | "simplify" | "persuasive" | "tone";
      tone?: "professional" | "casual" | "persuasive" | "technical";
      length?: "shorter" | "same" | "longer";
      focus?: "clarity" | "detail" | "emotion" | "argument";
      instruction?: string;
      advancedPrompt?: string;
    };

    const result = await refinePostDraftWithAi({
      title: body.title?.trim() || "",
      sourceChat: body.sourceChat?.trim() || "",
      authorNotes: body.authorNotes?.trim() || "",
      currentSummary: body.currentSummary?.trim() || "",
      currentArticle: body.currentArticle?.trim() || "",
      intent:
        body.intent === "regenerate" ||
        body.intent === "improve" ||
        body.intent === "shorter" ||
        body.intent === "detailed" ||
        body.intent === "simplify" ||
        body.intent === "persuasive" ||
        body.intent === "tone"
          ? body.intent
          : "improve",
      tone:
        body.tone === "casual" ||
        body.tone === "persuasive" ||
        body.tone === "technical"
          ? body.tone
          : "professional",
      length:
        body.length === "shorter" || body.length === "longer"
          ? body.length
          : "same",
      focus:
        body.focus === "detail" ||
        body.focus === "emotion" ||
        body.focus === "argument"
          ? body.focus
          : "clarity",
      instruction: body.instruction?.trim() || "",
      advancedPrompt: body.advancedPrompt?.trim() || "",
    });

    await recordAiUsageEvent({
      userId: Number.isFinite(userId) ? userId : null,
      feature: "post_refine",
      model: result.model,
      usage: result.usage,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "AI post refinement failed.",
      },
      { status: 400 },
    );
  }
}
