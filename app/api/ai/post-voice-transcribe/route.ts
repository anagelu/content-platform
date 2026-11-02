import { auth } from "@/auth";
import { recordAiUsageEvent } from "@/lib/ai-usage";
import { MAX_AUDIO_BYTES, transcribeVoiceIdea } from "@/lib/openai";
import { NextResponse } from "next/server";

// Authenticated counterpart to /api/ai/voice-transcribe, used by the
// signed-in New Post source field. Mirrors /api/ai/post-draft: auth-gated,
// no separate rate limit, usage tracked per user.
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = Number(session.user.id);
    const formData = await request.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: "No recording was received. Please try again." }, { status: 400 });
    }

    if (audio.size === 0) {
      return NextResponse.json(
        { error: "Didn't catch any audio. Try recording again." },
        { status: 400 },
      );
    }

    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: "That recording is too long. Keep voice notes to a few minutes, or type it instead." },
        { status: 400 },
      );
    }

    const arrayBuffer = await audio.arrayBuffer();
    const audioBase64 = Buffer.from(arrayBuffer).toString("base64");

    const result = await transcribeVoiceIdea({
      audioBase64,
      mimeType: audio.type || "audio/webm",
    });

    await recordAiUsageEvent({
      userId: Number.isFinite(userId) ? userId : null,
      feature: "voice_transcribe_post",
      model: result.model,
      usage: result.usage,
    });

    return NextResponse.json({ text: result.text, model: result.model });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Voice transcription failed. Please try again.",
      },
      { status: 400 },
    );
  }
}
