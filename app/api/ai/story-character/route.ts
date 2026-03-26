import { auth } from "@/auth";
import { recordAiUsageEvent } from "@/lib/ai-usage";
import { generateStoryCharacterProfileWithAi } from "@/lib/openai";
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
      settingProfilesJson?: string;
      characterName?: string;
      characterRole?: string;
      characterSeedNotes?: string;
    };

    const result = await generateStoryCharacterProfileWithAi({
      bookTitle: body.bookTitle?.trim() || "",
      storySynopsis: body.storySynopsis?.trim() || "",
      storyChapterCount:
        typeof body.storyChapterCount === "number" ? body.storyChapterCount : null,
      storyStructureNotes: body.storyStructureNotes?.trim() || "",
      settingProfilesJson: body.settingProfilesJson?.trim() || "",
      characterName: body.characterName?.trim() || "",
      characterRole: body.characterRole?.trim() || "",
      characterSeedNotes: body.characterSeedNotes?.trim() || "",
    });

    await recordAiUsageEvent({
      userId: Number.isFinite(userId) ? userId : null,
      feature: "story_character_profile",
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
            : "AI character profile generation failed.",
      },
      { status: 400 },
    );
  }
}
