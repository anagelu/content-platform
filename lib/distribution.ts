import type { Post, TradingSession } from "@prisma/client";

export const DISTRIBUTION_FORMATS = [
  {
    id: "instagram_package",
    label: "Instagram Package",
    channel: "instagram",
  },
  {
    id: "social_thread",
    label: "Social Thread",
    channel: "social",
  },
  {
    id: "video_script",
    label: "Video Script",
    channel: "video",
  },
  {
    id: "podcast_notes",
    label: "Podcast Notes",
    channel: "podcast",
  },
] as const;

type DistributionFormat = (typeof DISTRIBUTION_FORMATS)[number]["id"];

export type DistributionAsset = {
  title: string;
  body: string;
  metadata?: {
    caption?: string;
    carouselSlides?: string[];
    cta?: string;
    shareTitle?: string;
  };
};

type SourceContent =
  | {
      sourceType: "post";
      content: Pick<Post, "title" | "summary" | "body" | "slug">;
    }
  | {
      sourceType: "trading_session";
      content: Pick<
        TradingSession,
        "title" | "summary" | "thesis" | "workflowNotes" | "market" | "timeframe" | "setupType" | "slug"
      >;
    };

function splitIntoIdeas(text: string, limit: number) {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function buildThread(title: string, ideas: string[]) {
  const lines = [
    `1. ${title}`,
    ...ideas.map((idea, index) => `${index + 2}. ${idea}`),
    `${ideas.length + 2}. If this resonates, the full breakdown lives on the platform.`,
  ];

  return lines.join("\n\n");
}

function buildVideoScript(title: string, ideas: string[]) {
  const beats = ideas.length > 0 ? ideas : ["Introduce the core idea", "Explain the main takeaway", "End with the practical next step"];

  return [
    `Hook: "${title}"`,
    "",
    "Opening:",
    `Start with why this idea matters right now and what the viewer will learn in the next 60-90 seconds.`,
    "",
    ...beats.map((beat, index) => `Scene ${index + 1}: ${beat}`),
    "",
    'Closing CTA: "If you want the full write-up and the evolving framework, go deeper on the platform."',
  ].join("\n");
}

function buildPodcastNotes(title: string, ideas: string[], outro: string) {
  return [
    `Episode angle: ${title}`,
    "",
    "Talking points:",
    ...ideas.map((idea) => `- ${idea}`),
    "",
    `Wrap-up: ${outro}`,
  ].join("\n");
}

function buildInstagramPackage(title: string, ideas: string[]): DistributionAsset {
  const slides = [
    title,
    ...ideas.slice(0, 4),
  ];

  const caption = [
    `${title}`,
    "",
    ...ideas.slice(0, 3).map((idea) => `- ${idea}`),
    "",
    "Read the full breakdown and follow the evolving framework on the platform.",
  ].join("\n");

  return {
    title: `${title} Instagram Package`,
    body: [
      "Instagram caption:",
      caption,
      "",
      "Carousel slides:",
      ...slides.map((slide, index) => `Slide ${index + 1}: ${slide}`),
      "",
      "CTA: Save this, share it, and visit the platform for the full version.",
    ].join("\n"),
    metadata: {
      caption,
      carouselSlides: slides,
      cta: "Save this, share it, and visit the platform for the full version.",
      shareTitle: `${title} Share Page`,
    },
  };
}

export function generateDistributionAsset(
  source: SourceContent,
  format: DistributionFormat,
): DistributionAsset {
  if (source.sourceType === "post") {
    const ideas = splitIntoIdeas(
      [source.content.summary ?? "", source.content.body].filter(Boolean).join("\n"),
      5,
    );
    const title = source.content.title;

    if (format === "instagram_package") {
      return buildInstagramPackage(title, ideas);
    }

    if (format === "social_thread") {
      return {
        title: `${title} Thread`,
        body: buildThread(title, ideas),
      };
    }

    if (format === "video_script") {
      return {
        title: `${title} Video Script`,
        body: buildVideoScript(title, ideas),
      };
    }

    return {
      title: `${title} Podcast Notes`,
      body: buildPodcastNotes(
        title,
        ideas,
        "Summarize the biggest insight and invite listeners back to the platform for the full article.",
      ),
    };
  }

  const ideas = splitIntoIdeas(
    [
      source.content.summary,
      source.content.thesis,
      source.content.workflowNotes ?? "",
      `${source.content.market} on the ${source.content.timeframe} timeframe using a ${source.content.setupType} setup.`,
    ]
      .filter(Boolean)
      .join("\n"),
    5,
  );
  const title = source.content.title;

  if (format === "instagram_package") {
    return buildInstagramPackage(title, ideas);
  }

  if (format === "social_thread") {
    return {
      title: `${title} Thread`,
      body: buildThread(title, ideas),
    };
  }

  if (format === "video_script") {
    return {
      title: `${title} Video Script`,
      body: buildVideoScript(title, ideas),
    };
  }

  return {
    title: `${title} Podcast Notes`,
    body: buildPodcastNotes(
      title,
      ideas,
      "Close by framing the setup, the risk, and how the workflow can evolve with more sessions.",
    ),
  };
}
