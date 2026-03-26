import { auth } from "@/auth";
import { recordAiUsageEvent } from "@/lib/ai-usage";
import { refineBookSectionWithAi } from "@/lib/openai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = Number(session.user.id);
    const body = (await request.json()) as {
      bookTitle?: string;
      bookType?: string;
      targetLength?: string;
      audience?: string;
      tone?: string;
      bookSummary?: string;
      outline?: string;
      authorNotes?: string;
      storySynopsis?: string;
      storyChapterCount?: number | null;
      storyStructureNotes?: string;
      characterProfilesJson?: string;
      settingProfilesJson?: string;
      selectedCharacterProfilesJson?: string;
      selectedSettingProfilesJson?: string;
      sceneGoal?: string;
      sceneConflict?: string;
      povCharacterName?: string;
      sectionKind?: string;
      sectionTitle?: string;
      sectionSummary?: string;
      sectionContent?: string;
    };

    const result = await refineBookSectionWithAi({
      bookTitle: body.bookTitle?.trim() || "",
      bookType: body.bookType?.trim() || "",
      targetLength: body.targetLength?.trim() || "",
      audience: body.audience?.trim() || "",
      tone: body.tone?.trim() || "",
      bookSummary: body.bookSummary?.trim() || "",
      outline: body.outline?.trim() || "",
      authorNotes: body.authorNotes?.trim() || "",
      storySynopsis: body.storySynopsis?.trim() || "",
      storyChapterCount:
        typeof body.storyChapterCount === "number" ? body.storyChapterCount : null,
      storyStructureNotes: body.storyStructureNotes?.trim() || "",
      characterProfilesJson: body.characterProfilesJson?.trim() || "",
      settingProfilesJson: body.settingProfilesJson?.trim() || "",
      selectedCharacterProfilesJson: body.selectedCharacterProfilesJson?.trim() || "",
      selectedSettingProfilesJson: body.selectedSettingProfilesJson?.trim() || "",
      sceneGoal: body.sceneGoal?.trim() || "",
      sceneConflict: body.sceneConflict?.trim() || "",
      povCharacterName: body.povCharacterName?.trim() || "",
      sectionKind: body.sectionKind?.trim() || "",
      sectionTitle: body.sectionTitle?.trim() || "",
      sectionSummary: body.sectionSummary?.trim() || "",
      sectionContent: body.sectionContent?.trim() || "",
    });

    await recordAiUsageEvent({
      userId: Number.isFinite(userId) ? userId : null,
      feature: "book_section_refine",
      model: result.model,
      usage: result.usage,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AI section refinement failed.",
      },
      { status: 400 },
    );
  }
}
