import { auth } from "@/auth";
import { recordAiUsageEvent } from "@/lib/ai-usage";
import { generatePostDraftFromSourceChat } from "@/lib/openai";
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
    };

    const result = await generatePostDraftFromSourceChat({
      title: body.title?.trim() || "",
      sourceChat: body.sourceChat?.trim() || "",
      authorNotes: body.authorNotes?.trim() || "",
    });

    await recordAiUsageEvent({
      userId: Number.isFinite(userId) ? userId : null,
      feature: "post_draft",
      model: result.model,
      usage: result.usage,
    });

    return NextResponse.json({
      title: result.title,
      summary: result.summary,
      presentationOutline: result.presentationOutline,
      article: result.article,
      model: result.model,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "AI draft generation failed.",
      },
      { status: 400 },
    );
  }
}
