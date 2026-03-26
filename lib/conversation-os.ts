import type { MessageInboxItem } from "@/lib/message-inbox";
import { inferCategoryNameFromText } from "@/lib/category-inference";

export type ConversationOsTheme = {
  name: string;
  count: number;
  latestTitle: string;
  latestUpdatedAt: string;
};

export type ConversationOsOutput = {
  type: "book" | "website" | "research_hub" | "media_pack" | "product_brief";
  label: string;
  count: number;
  description: string;
};

export type ConversationOsSnapshot = {
  totalConversations: number;
  totalSources: number;
  dedupeProtectedCount: number;
  themes: ConversationOsTheme[];
  outputs: ConversationOsOutput[];
};

function inferOutputTypes(item: MessageInboxItem) {
  const normalized = [
    item.title,
    item.sourceLabel || "",
    item.summary || "",
    item.authorNotes || "",
    item.conversation,
  ]
    .join("\n")
    .toLowerCase();

  const outputTypes = new Set<ConversationOsOutput["type"]>();

  if (
    normalized.includes("book") ||
    normalized.includes("chapter") ||
    normalized.includes("manuscript")
  ) {
    outputTypes.add("book");
  }

  if (
    normalized.includes("website") ||
    normalized.includes("landing page") ||
    normalized.includes("site map")
  ) {
    outputTypes.add("website");
  }

  if (
    normalized.includes("research") ||
    normalized.includes("knowledge base") ||
    normalized.includes("archive")
  ) {
    outputTypes.add("research_hub");
  }

  if (
    normalized.includes("video") ||
    normalized.includes("image") ||
    normalized.includes("photo") ||
    normalized.includes("media")
  ) {
    outputTypes.add("media_pack");
  }

  if (
    normalized.includes("product") ||
    normalized.includes("spec") ||
    normalized.includes("feature") ||
    normalized.includes("workflow")
  ) {
    outputTypes.add("product_brief");
  }

  if (outputTypes.size === 0) {
    outputTypes.add("research_hub");
  }

  return outputTypes;
}

export function buildConversationOsSnapshot(
  items: MessageInboxItem[],
): ConversationOsSnapshot {
  const sources = new Set(items.map((item) => item.sourceLabel || "Imported"));
  const themesMap = new Map<string, ConversationOsTheme>();
  const outputCounts = new Map<ConversationOsOutput["type"], number>();
  const uniqueHashes = new Set(items.map((item) => item.contentHash));

  for (const item of items) {
    const themeName = inferCategoryNameFromText(
      [item.title, item.summary || "", item.authorNotes || "", item.conversation].join(
        "\n",
      ),
    ) || "Unsorted";

    const existingTheme = themesMap.get(themeName);
    if (!existingTheme) {
      themesMap.set(themeName, {
        name: themeName,
        count: 1,
        latestTitle: item.title,
        latestUpdatedAt: item.updatedAt,
      });
    } else {
      themesMap.set(themeName, {
        ...existingTheme,
        count: existingTheme.count + 1,
        latestTitle:
          new Date(item.updatedAt).getTime() >
          new Date(existingTheme.latestUpdatedAt).getTime()
            ? item.title
            : existingTheme.latestTitle,
        latestUpdatedAt:
          new Date(item.updatedAt).getTime() >
          new Date(existingTheme.latestUpdatedAt).getTime()
            ? item.updatedAt
            : existingTheme.latestUpdatedAt,
      });
    }

    for (const type of inferOutputTypes(item)) {
      outputCounts.set(type, (outputCounts.get(type) ?? 0) + 1);
    }
  }

  const outputs: ConversationOsOutput[] = [
    {
      type: "book",
      label: "Book candidates",
      count: outputCounts.get("book") ?? 0,
      description: "Long-form threads that look ready to become chapters, essays, or manuscripts.",
    },
    {
      type: "website",
      label: "Website candidates",
      count: outputCounts.get("website") ?? 0,
      description: "Conversations that can become landing pages, research sites, or front-facing product surfaces.",
    },
    {
      type: "research_hub",
      label: "Research hubs",
      count: outputCounts.get("research_hub") ?? 0,
      description: "Message clusters that deserve structured knowledge pages, timelines, and source collections.",
    },
    {
      type: "media_pack",
      label: "Media concepts",
      count: outputCounts.get("media_pack") ?? 0,
      description: "Threads that mention AI images, video, or presentation-ready creative assets.",
    },
    {
      type: "product_brief",
      label: "Product briefs",
      count: outputCounts.get("product_brief") ?? 0,
      description: "Specs, workflow ideas, and recurring product concepts that can become build plans.",
    },
  ];

  return {
    totalConversations: items.length,
    totalSources: sources.size,
    dedupeProtectedCount: uniqueHashes.size,
    themes: Array.from(themesMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    outputs,
  };
}
