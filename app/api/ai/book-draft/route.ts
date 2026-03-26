import { auth } from "@/auth";
import { recordAiUsageEvent } from "@/lib/ai-usage";
import { generateBookDraftFromSourceMaterial } from "@/lib/openai";
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
      bookType?: string;
      targetLength?: string;
      audience?: string;
      tone?: string;
      sourceDraft?: string;
      authorNotes?: string;
      storySynopsis?: string;
      storyChapterCount?: number | null;
      storyStructureNotes?: string;
      characterProfilesJson?: string;
      settingProfilesJson?: string;
    };

    const result = await generateBookDraftFromSourceMaterial({
      title: body.title?.trim() || "",
      bookType: body.bookType?.trim() || "",
      targetLength: body.targetLength?.trim() || "",
      audience: body.audience?.trim() || "",
      tone: body.tone?.trim() || "",
      sourceDraft: body.sourceDraft?.trim() || "",
      authorNotes: body.authorNotes?.trim() || "",
      storySynopsis: body.storySynopsis?.trim() || "",
      storyChapterCount:
        typeof body.storyChapterCount === "number" ? body.storyChapterCount : null,
      storyStructureNotes: body.storyStructureNotes?.trim() || "",
      characterProfilesJson: body.characterProfilesJson?.trim() || "",
      settingProfilesJson: body.settingProfilesJson?.trim() || "",
    });

    await recordAiUsageEvent({
      userId: Number.isFinite(userId) ? userId : null,
      feature: "book_draft",
      model: result.model,
      usage: result.usage,
    });

    return NextResponse.json({
      title: result.title,
      summary: result.summary,
      outline: result.outline,
      sections: result.sections,
      model: result.model,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AI book generation failed.",
      },
      { status: 400 },
    );
  }
}
