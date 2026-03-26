const MAX_SUMMARY_LENGTH = 280;

function stripMarkdown(content: string) {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[.*?\]\(.*?\)/g, " ")
    .replace(/\[([^\]]+)\]\(.*?\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function generateSummary(content: string) {
  const normalizedContent = stripMarkdown(content);

  if (!normalizedContent) {
    return "";
  }

  const sentences = normalizedContent.match(/[^.!?]+[.!?]+/g) ?? [];

  if (sentences.length === 0) {
    return normalizedContent.slice(0, MAX_SUMMARY_LENGTH).trim();
  }

  let summary = "";

  for (const sentence of sentences) {
    const nextSummary = `${summary} ${sentence.trim()}`.trim();

    if (nextSummary.length > MAX_SUMMARY_LENGTH) {
      break;
    }

    summary = nextSummary;

    if (summary.length >= 180) {
      break;
    }
  }

  if (!summary) {
    return `${normalizedContent.slice(0, MAX_SUMMARY_LENGTH - 1).trim()}…`;
  }

  return summary.trim();
}
