import { recordAiUsageEvent } from "@/lib/ai-usage";
import { MAX_AUDIO_BYTES, transcribeVoiceIdea } from "@/lib/openai";
import {
  checkVoiceRateLimit,
  getRequestIp,
  hashIp,
  recordVoiceUsage,
} from "@/lib/voice-usage";
import { NextResponse } from "next/server";

// Public, no-login voice-input endpoint for the homepage idea field and
// the /try demo. Like /api/ai/try-demo, anyone can hit this, so it has no
// auth() check and instead relies on a per-IP + site-wide daily cap
// (lib/voice-usage.ts) rather than a hard content limit.
export async function POST(request: Request) {
  try {
    const ip = getRequestIp(request);
    const ipHash = hashIp(ip);

    const rateLimit = await checkVoiceRateLimit(ipHash);

    if (!rateLimit.allowed) {
      const message =
        rateLimit.reason === "per_ip"
          ? "You've used up today's free voice transcriptions. Type your idea instead, or create a free account."
          : "Voice transcription is busy right now — please try again later, or type your idea instead.";

      return NextResponse.json({ error: message }, { status: 429 });
    }

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
        { error: "That recording is too long. Keep voice notes to about a minute or two, or type it instead." },
        { status: 400 },
      );
    }

    const arrayBuffer = await audio.arrayBuffer();
    const audioBase64 = Buffer.from(arrayBuffer).toString("base64");

    const result = await transcribeVoiceIdea({
      audioBase64,
      mimeType: audio.type || "audio/webm",
    });

    await Promise.all([
      recordVoiceUsage(ipHash),
      recordAiUsageEvent({
        userId: null,
        feature: "voice_transcribe_public",
        model: result.model,
        usage: result.usage,
      }),
    ]);

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
