import { auth } from "@/auth";
import { recordAiUsageEvent } from "@/lib/ai-usage";
import { generateStorySettingProfileWithAi } from "@/lib/openai";
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
      storySynopsis?: string;
      storyChapterCount?: number | null;
      storyStructureNotes?: string;
      characterProfilesJson?: string;
      settingName?: string;
      settingPurpose?: string;
      settingSeedNotes?: string;
    };

    const result = await generateStorySettingProfileWithAi({
      bookTitle: body.bookTitle?.trim() || "",
      storySynopsis: body.storySynopsis?.trim() || "",
      storyChapterCount:
        typeof body.storyChapterCount === "number" ? body.storyChapterCount : null,
      storyStructureNotes: body.storyStructureNotes?.trim() || "",
      characterProfilesJson: body.characterProfilesJson?.trim() || "",
      settingName: body.settingName?.trim() || "",
      settingPurpose: body.settingPurpose?.trim() || "",
      settingSeedNotes: body.settingSeedNotes?.trim() || "",
    });

    await recordAiUsageEvent({
      userId: Number.isFinite(userId) ? userId : null,
      feature: "story_setting_profile",
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
            : "AI setting profile generation failed.",
      },
      { status: 400 },
    );
  }
}
