import { prisma } from "@/lib/prisma";

export type SiteSearchResult = {
  id: string;
  title: string;
  href: string;
  kind: string;
  excerpt: string;
  visibility: "public" | "private";
  score: number;
};

type SearchRow = {
  id: number | string;
  title: string;
  href: string;
  kind: string;
  excerpt: string;
  visibility: "public" | "private";
};

const STATIC_PAGES: Array<{
  id: string;
  title: string;
  href: string;
  kind: string;
  excerpt: string;
  requiresAuth?: boolean;
}> = [
  {
    id: "home",
    title: "Home",
    href: "/",
    kind: "Page",
    excerpt: "Landing page with featured workflows, posts, studio, and trading.",
  },
  {
    id: "posts",
    title: "Posts",
    href: "/posts",
    kind: "Page",
    excerpt: "Browse published posts and long-form writing.",
  },
  {
    id: "categories",
    title: "Categories",
    href: "/categories",
    kind: "Page",
    excerpt: "Browse content by category and topic clusters.",
  },
  {
    id: "trading",
    title: "Trading Workspace",
    href: "/trading",
    kind: "Page",
    excerpt: "Trading sessions, journal, tools, pipeline, and SPX workflows.",
  },
  {
    id: "trading-tools",
    title: "Trading Tools",
    href: "/trading/tools",
    kind: "Page",
    excerpt: "Risk reward calculator and candlestick signal tools.",
  },
  {
    id: "trading-algo",
    title: "Algo Workspace",
    href: "/trading/algo",
    kind: "Page",
    excerpt: "Alpaca paper trading controller, automation, and strategy checks.",
    requiresAuth: true,
  },
  {
    id: "trading-journal",
    title: "Trading Journal",
    href: "/trading/journal",
    kind: "Page",
    excerpt: "Review executed trades, mistakes, and repeatable lessons.",
    requiresAuth: true,
  },
  {
    id: "books",
    title: "Books",
    href: "/books",
    kind: "Page",
    excerpt: "Structured book drafts, outlines, and manuscript workflow.",
  },
  {
    id: "patents",
    title: "Patent Workspace",
    href: "/patents",
    kind: "Page",
    excerpt: "Draft patent records, novelty summaries, and provisional packet prep.",
    requiresAuth: true,
  },
  {
    id: "studio",
    title: "Studio",
    href: "/studio",
    kind: "Page",
    excerpt: "Content derivatives, AI usage, and repurposing workflows.",
    requiresAuth: true,
  },
  {
    id: "os",
    title: "Conversation OS",
    href: "/os",
    kind: "Page",
    excerpt: "Classify conversations into reusable output types and workflows.",
    requiresAuth: true,
  },
];

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function tokenizeQuery(query: string) {
  return normalizeText(query)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function scoreResult(result: Omit<SiteSearchResult, "score">, tokens: string[]) {
  const haystack = normalizeText(`${result.title} ${result.excerpt} ${result.kind}`);
  const title = normalizeText(result.title);
  const href = normalizeText(result.href);

  return tokens.reduce((score, token) => {
    let nextScore = score;

    if (title.includes(token)) {
      nextScore += 6;
    }

    if (href.includes(token)) {
      nextScore += 4;
    }

    if (haystack.includes(token)) {
      nextScore += 2;
    }

    return nextScore;
  }, result.visibility === "public" ? 1 : 0);
}

function toResult(row: SearchRow, tokens: string[]): SiteSearchResult {
  const result = {
    id: String(row.id),
    title: row.title,
    href: row.href,
    kind: row.kind,
    excerpt: row.excerpt,
    visibility: row.visibility,
  } as const;

  return {
    ...result,
    score: scoreResult(result, tokens),
  };
}

function rowMatchesTokens(row: SearchRow, tokens: string[]) {
  const haystack = normalizeText(
    `${row.title} ${row.excerpt} ${row.kind} ${row.href}`,
  );

  return tokens.every((token) => haystack.includes(token));
}

async function searchPosts() {
  return prisma.$queryRawUnsafe<SearchRow[]>(
    `
      SELECT
        id,
        title,
        '/posts/' || slug AS href,
        'Post' AS kind,
        COALESCE(summary, substr(body, 1, 220)) AS excerpt,
        'public' AS visibility
      FROM "Post"
      ORDER BY datetime(updatedAt) DESC
      LIMIT 80
    `,
  );
}

async function searchCategories() {
  return prisma.$queryRawUnsafe<SearchRow[]>(
    `
      SELECT
        id,
        name AS title,
        '/categories/' || name AS href,
        'Category' AS kind,
        'Category archive and related published posts.' AS excerpt,
        'public' AS visibility
      FROM "Category"
      ORDER BY name ASC
      LIMIT 40
    `,
  );
}

async function searchTradingSessions(userId: number | null, isAdmin: boolean) {
  if (!userId && !isAdmin) {
    return [] as SearchRow[];
  }

  return prisma.$queryRawUnsafe<SearchRow[]>(
    `
      SELECT
        id,
        title,
        '/trading/' || slug AS href,
        'Trading Session' AS kind,
        COALESCE(summary, substr(thesis, 1, 220)) AS excerpt,
        'private' AS visibility
      FROM "TradingSession"
      WHERE ${isAdmin ? "1 = 1" : "authorId = ?"}
      ORDER BY datetime(updatedAt) DESC
      LIMIT 80
    `,
    ...(isAdmin ? [] : [userId as number]),
  );
}

async function searchTradingJournal(userId: number | null, isAdmin: boolean) {
  if (!userId && !isAdmin) {
    return [] as SearchRow[];
  }

  return prisma.$queryRawUnsafe<SearchRow[]>(
    `
      SELECT
        id,
        title,
        '/trading/journal/' || slug AS href,
        'Journal Entry' AS kind,
        COALESCE(summary, substr(COALESCE(executionNotes, ''), 1, 220)) AS excerpt,
        'private' AS visibility
      FROM "TradingJournalEntry"
      WHERE ${isAdmin ? "1 = 1" : "authorId = ?"}
      ORDER BY datetime(updatedAt) DESC
      LIMIT 80
    `,
    ...(isAdmin ? [] : [userId as number]),
  );
}

async function searchBooks(userId: number | null, isAdmin: boolean) {
  return prisma.$queryRawUnsafe<SearchRow[]>(
    `
      SELECT
        id,
        title,
        '/books/' || slug AS href,
        'Book' AS kind,
        COALESCE(summary, substr(sourceDraft, 1, 220)) AS excerpt,
        CASE WHEN isPublic = 1 THEN 'public' ELSE 'private' END AS visibility
      FROM "Book"
      WHERE ${
        isAdmin
          ? "1 = 1"
          : userId
            ? "(authorId = ? OR isPublic = 1)"
            : "isPublic = 1"
      }
      ORDER BY datetime(updatedAt) DESC
      LIMIT 80
    `,
    ...(isAdmin ? [] : userId ? [userId as number] : []),
  );
}

async function searchPatents(userId: number | null, isAdmin: boolean) {
  if (!userId && !isAdmin) {
    return [] as SearchRow[];
  }

  return prisma.$queryRawUnsafe<SearchRow[]>(
    `
      SELECT
        id,
        title,
        '/patents/' || slug AS href,
        'Patent Record' AS kind,
        substr(problem || ' ' || solution, 1, 220) AS excerpt,
        'private' AS visibility
      FROM "PatentRecord"
      WHERE ${isAdmin ? "1 = 1" : "authorId = ?"}
      ORDER BY datetime(updatedAt) DESC
      LIMIT 80
    `,
    ...(isAdmin ? [] : [userId as number]),
  );
}

function searchStaticPages(query: string, hasPrivateAccess: boolean, tokens: string[]) {
  return STATIC_PAGES.filter((page) => !page.requiresAuth || hasPrivateAccess)
    .filter((page) =>
      rowMatchesTokens(
        {
          id: page.id,
          title: page.title,
          href: page.href,
          kind: page.kind,
          excerpt: page.excerpt,
          visibility: page.requiresAuth ? "private" : "public",
        },
        tokens,
      ),
    )
    .map((page) =>
      toResult(
        {
          id: page.id,
          title: page.title,
          href: page.href,
          kind: page.kind,
          excerpt: page.excerpt,
          visibility: page.requiresAuth ? "private" : "public",
        },
        tokens,
      ),
    );
}

export async function searchSiteContent(input: {
  query: string;
  userId: number | null;
  isAdmin: boolean;
}) {
  const query = input.query.trim();

  if (!query) {
    return [] as SiteSearchResult[];
  }

  const tokens = tokenizeQuery(query);
  const hasPrivateAccess = input.isAdmin || input.userId !== null;

  const [
    posts,
    categories,
    tradingSessions,
    tradingJournal,
    books,
    patents,
  ] = await Promise.all([
    searchPosts(),
    searchCategories(),
    searchTradingSessions(input.userId, input.isAdmin),
    searchTradingJournal(input.userId, input.isAdmin),
    searchBooks(input.userId, input.isAdmin),
    searchPatents(input.userId, input.isAdmin),
  ]);

  const results = [
    ...searchStaticPages(query, hasPrivateAccess, tokens),
    ...posts.filter((row) => rowMatchesTokens(row, tokens)).map((row) => toResult(row, tokens)),
    ...categories
      .filter((row) => rowMatchesTokens(row, tokens))
      .map((row) => toResult(row, tokens)),
    ...tradingSessions
      .filter((row) => rowMatchesTokens(row, tokens))
      .map((row) => toResult(row, tokens)),
    ...tradingJournal
      .filter((row) => rowMatchesTokens(row, tokens))
      .map((row) => toResult(row, tokens)),
    ...books.filter((row) => rowMatchesTokens(row, tokens)).map((row) => toResult(row, tokens)),
    ...patents
      .filter((row) => rowMatchesTokens(row, tokens))
      .map((row) => toResult(row, tokens)),
  ];

  return results
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, 24);
}
