import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { prismaWithDistribution } from "@/lib/prisma-distribution";
import { DISTRIBUTION_FORMATS, generateDistributionAsset } from "@/lib/distribution";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const formData = await request.formData();
  const sourceType = formData.get("sourceType")?.toString() || "";
  const sourceId = Number(formData.get("sourceId"));
  const format = formData.get("format")?.toString() || "";

  if (!sourceId || !DISTRIBUTION_FORMATS.find((item) => item.id === format)) {
    return NextResponse.redirect(new URL("/studio?generated=invalid", request.url));
  }

  if (sourceType === "post") {
    const post = await prisma.post.findUnique({
      where: { id: sourceId },
      select: {
        id: true,
        title: true,
        summary: true,
        body: true,
        slug: true,
      },
    });

    if (post) {
      const asset = generateDistributionAsset(
        { sourceType: "post", content: post },
        format as (typeof DISTRIBUTION_FORMATS)[number]["id"],
      );
      const metadata = DISTRIBUTION_FORMATS.find((item) => item.id === format)!;

      await prismaWithDistribution.contentDerivative.create({
        data: {
          channel: metadata.channel,
          format,
          title: asset.title,
          body: asset.body,
          metadata: asset.metadata ? JSON.stringify(asset.metadata) : null,
          authorId: Number(session.user.id),
          postId: post.id,
        },
      });
    }
  }

  if (sourceType === "trading_session") {
    const tradingSession = await prisma.tradingSession.findUnique({
      where: { id: sourceId },
      select: {
        id: true,
        title: true,
        summary: true,
        thesis: true,
        workflowNotes: true,
        market: true,
        timeframe: true,
        setupType: true,
        slug: true,
      },
    });

    if (tradingSession) {
      const asset = generateDistributionAsset(
        { sourceType: "trading_session", content: tradingSession },
        format as (typeof DISTRIBUTION_FORMATS)[number]["id"],
      );
      const metadata = DISTRIBUTION_FORMATS.find((item) => item.id === format)!;

      await prismaWithDistribution.contentDerivative.create({
        data: {
          channel: metadata.channel,
          format,
          title: asset.title,
          body: asset.body,
          metadata: asset.metadata ? JSON.stringify(asset.metadata) : null,
          authorId: Number(session.user.id),
          tradingSessionId: tradingSession.id,
        },
      });
    }
  }

  return NextResponse.redirect(new URL("/studio?generated=success", request.url));
}
