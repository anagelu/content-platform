import { auth } from "@/auth";
import { recordAiUsageEvent } from "@/lib/ai-usage";
import { generateSpatialAgentInsight } from "@/lib/openai";
import {
  buildSpatialPromptForTarget,
  type SpatialAgentMode,
  type SpatialBehaviorProfile,
  type SpatialCockpitContext,
  type SpatialPromptTarget,
} from "@/lib/spatial-agent-prompts";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = Number(session.user.id);
    const body = (await request.json()) as {
      cockpit?: SpatialCockpitContext;
      target?: SpatialPromptTarget;
      behavior?: SpatialBehaviorProfile;
      mode?: SpatialAgentMode;
    };

    if (!body.cockpit || !body.target) {
      throw new Error("Spatial cockpit context is missing.");
    }

    const prompt = buildSpatialPromptForTarget({
      cockpit: body.cockpit,
      target: body.target,
      behavior: body.behavior,
      mode: body.mode,
    });

    const result = await generateSpatialAgentInsight(prompt);

    await recordAiUsageEvent({
      userId: Number.isFinite(userId) ? userId : null,
      feature: "spatial_agent_hud",
      model: result.model,
      usage: result.usage,
    });

    return NextResponse.json({
      reply: result.reply,
      model: result.model,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Spatial agent request failed.",
      },
      { status: 400 },
    );
  }
}
