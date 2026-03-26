export const DEFAULT_CATEGORY_NAMES = [
  "AI",
  "Trading",
  "Coding",
  "Job Hunting",
  "Theology",
  "Writing",
  "Business",
  "Life",
] as const;

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  AI: [
    "openai",
    "chatgpt",
    "claude",
    "gemini",
    "prompt",
    "llm",
    "model",
    "ai",
    "artificial intelligence",
  ],
  Trading: [
    "trade",
    "trading",
    "entry",
    "stop loss",
    "target",
    "btc",
    "stock",
    "ticker",
    "market",
    "setup",
  ],
  Coding: [
    "next.js",
    "nextjs",
    "react",
    "typescript",
    "javascript",
    "api",
    "bug",
    "debug",
    "code",
    "programming",
  ],
  "Job Hunting": [
    "resume",
    "cv",
    "interview",
    "recruiter",
    "job",
    "career",
    "application",
    "hiring",
    "offer",
  ],
  Theology: [
    "bible",
    "god",
    "jesus",
    "theology",
    "church",
    "sermon",
    "faith",
    "doctrine",
    "gospel",
  ],
  Writing: [
    "essay",
    "writing",
    "article",
    "story",
    "draft",
    "outline",
    "summary",
  ],
  Business: [
    "startup",
    "business",
    "sales",
    "customer",
    "marketing",
    "offer",
    "product",
    "pricing",
  ],
  Life: [
    "habit",
    "health",
    "relationship",
    "life",
    "routine",
    "mindset",
    "stress",
  ],
};

export function inferCategoryNameFromText(input: string) {
  const normalized = input.toLowerCase();

  const scoredCategories = Object.entries(CATEGORY_KEYWORDS)
    .map(([category, keywords]) => ({
      category,
      score: keywords.reduce(
        (total, keyword) => total + (normalized.includes(keyword) ? 1 : 0),
        0,
      ),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scoredCategories[0]?.category ?? "";
}
