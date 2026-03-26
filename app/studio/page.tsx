import { auth } from "@/auth";
import { getAiUsageSummaryForRange } from "@/lib/ai-usage";
import { prisma } from "@/lib/prisma";
import { prismaWithDistribution } from "@/lib/prisma-distribution";
import { DISTRIBUTION_FORMATS } from "@/lib/distribution";
import type { Post, TradingSession } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function StudioPage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string; idea?: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedRange =
    resolvedSearchParams.range === "today" ||
    resolvedSearchParams.range === "7d" ||
    resolvedSearchParams.range === "30d"
      ? resolvedSearchParams.range
      : "30d";
  const seededIdea = resolvedSearchParams.idea?.trim() || "";
  const userId = Number(session.user.id);
  const [posts, tradingSessions, derivatives, aiUsage] = await Promise.all([
    prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.tradingSession.findMany({
      where:
        session.user.role === "admin"
          ? undefined
          : {
              authorId: userId,
            },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prismaWithDistribution.contentDerivative.findMany({
      where:
        session.user.role === "admin"
          ? undefined
          : {
              authorId: userId,
            },
      include: {
        post: true,
        tradingSession: true,
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }) as Promise<
      Array<{
        id: number;
        channel: string;
        format: string;
        title: string;
        body: string;
        metadata: string | null;
        status: string;
        post: Post | null;
        tradingSession: TradingSession | null;
      }>
    >,
    session.user.role === "admin"
      ? getAiUsageSummaryForRange(selectedRange)
      : Promise.resolve(null),
  ]);

  const latestAsset = derivatives[0];

  return (
    <main>
      <div className="site-shell site-shell-wide">
        <h1 className="page-title">Distribution Studio</h1>
        <p className="page-subtitle">
          Take one core idea and turn it into a social thread, a short-form
          video script, or podcast talking points without leaving the platform.
        </p>

        <div className="toolbar">
          <Link href="/posts" className="button-link secondary">
            Posts
          </Link>
          <Link href="/trading" className="button-link secondary">
            Trading
          </Link>
          <Link href="/" className="button-link secondary">
            Home
          </Link>
          {session.user.role === "admin" ? (
            <Link href="/admin/ai?range=30d" className="button-link secondary">
              AI Control Center
            </Link>
          ) : null}
        </div>

        {seededIdea ? (
          <section style={{ marginTop: "1.5rem" }}>
            <div className="card">
              <h2 className="card-title">Seed Idea From Home</h2>
              <p className="meta">
                You brought this idea in from the homepage. Studio works best
                once the idea has been shaped into a post or draft, but the seed
                is preserved here so you do not lose it.
              </p>
              <p className="preview">{seededIdea}</p>
              <div className="toolbar" style={{ marginTop: "1rem", marginBottom: 0 }}>
                <Link
                  href={`/posts/new?idea=${encodeURIComponent(seededIdea)}`}
                  className="button-link secondary"
                >
                  Turn Into Post First
                </Link>
                <Link
                  href={`/books/new?idea=${encodeURIComponent(seededIdea)}`}
                  className="button-link secondary"
                >
                  Turn Into Book Section
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        <section style={{ marginTop: "2rem" }}>
          <h2 className="trading-section-title">AI Usage</h2>
          {session.user.role === "admin" && aiUsage ? (
            <div className="card">
              <p className="preview">
                Estimated from actual OpenAI token usage returned by each request
                and priced against the configured model rates.
              </p>
              <div className="toolbar" style={{ marginTop: "1rem" }}>
                <Link href="/admin/ai?range=30d" className="button-link secondary">
                  Open Admin AI Control Center
                </Link>
              </div>

              <div className="toolbar" style={{ marginTop: "1rem" }}>
                <Link
                  href="/studio?range=today"
                  className={`button-link${selectedRange === "today" ? "" : " secondary"}`}
                >
                  Today
                </Link>
                <Link
                  href="/studio?range=7d"
                  className={`button-link${selectedRange === "7d" ? "" : " secondary"}`}
                >
                  7d
                </Link>
                <Link
                  href="/studio?range=30d"
                  className={`button-link${selectedRange === "30d" ? "" : " secondary"}`}
                >
                  30d
                </Link>
              </div>

              <div className="trading-metric-row" style={{ marginTop: "1rem" }}>
                <div className="trading-metric-card">
                  <span className="trading-metric-label">Estimated cost</span>
                  <strong>${aiUsage.totals.estimatedCostUsd.toFixed(4)}</strong>
                </div>
                <div className="trading-metric-card">
                  <span className="trading-metric-label">Requests</span>
                  <strong>{aiUsage.totals.requests}</strong>
                </div>
                <div className="trading-metric-card">
                  <span className="trading-metric-label">Total tokens</span>
                  <strong>{aiUsage.totals.totalTokens.toLocaleString()}</strong>
                </div>
                <div className="trading-metric-card">
                  <span className="trading-metric-label">Range</span>
                  <strong>{selectedRange === "today" ? "Today" : selectedRange}</strong>
                </div>
              </div>

              {aiUsage.rows.length === 0 ? (
                <p className="meta" style={{ marginTop: "1rem" }}>
                  No tracked AI usage yet.
                </p>
              ) : (
                <>
                  <div className="card-list" style={{ marginTop: "1rem" }}>
                    {aiUsage.rows.map((row) => (
                      <article key={`${row.feature}-${row.model}`} className="card">
                        <h3 className="card-title">
                          {row.feature.replaceAll("_", " ")} · {row.model}
                        </h3>
                        <p className="meta">
                          {row.requests} requests · {row.totalTokens.toLocaleString()} tokens
                        </p>
                        <p className="meta">
                          Input {row.inputTokens.toLocaleString()} · Output{" "}
                          {row.outputTokens.toLocaleString()} · Reasoning{" "}
                          {row.reasoningTokens.toLocaleString()}
                        </p>
                        <p className="preview">
                          Estimated cost ${row.estimatedCostUsd.toFixed(4)}
                        </p>
                      </article>
                    ))}
                  </div>

                  <div className="card-list" style={{ marginTop: "1rem" }}>
                    {aiUsage.recentEvents.map((event, index) => (
                      <article key={`${event.feature}-${event.createdAt}-${index}`} className="card">
                        <h3 className="card-title">
                          {event.feature.replaceAll("_", " ")} · {event.model}
                        </h3>
                        <p className="meta">
                          {new Date(event.createdAt).toLocaleString()}
                        </p>
                        <p className="meta">
                          Input {event.inputTokens.toLocaleString()} · Output{" "}
                          {event.outputTokens.toLocaleString()} · Total{" "}
                          {event.totalTokens.toLocaleString()}
                        </p>
                        <p className="preview">
                          Estimated cost ${event.estimatedCostUsd.toFixed(4)}
                        </p>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="card">
              <p>AI usage reporting is visible to admins only.</p>
            </div>
          )}
        </section>

        <section style={{ marginTop: "2rem" }}>
          <h2 className="trading-section-title">Latest Generated Asset</h2>
          {latestAsset ? (
            <div className="card">
              <h3 className="card-title">{latestAsset.title}</h3>
              <p className="meta">
                {latestAsset.channel} · {latestAsset.format.replaceAll("_", " ")} · status{" "}
                {latestAsset.status}
              </p>
              <p className="meta">
                Source: {latestAsset.post?.title || latestAsset.tradingSession?.title || "Unknown"}
              </p>
              <div className="toolbar" style={{ marginBottom: "1rem" }}>
                <Link
                  href={`/studio/share/${latestAsset.id}`}
                  className="button-link secondary"
                >
                  Open Share Page
                </Link>
              </div>
              <pre className="trading-source-chat">{latestAsset.body}</pre>
            </div>
          ) : (
            <div className="card">
              <p>No generated assets yet.</p>
            </div>
          )}
        </section>

        <section style={{ marginTop: "2rem" }}>
          <h2 className="trading-section-title">Repurpose Posts</h2>
          {posts.length === 0 ? (
            <div className="card">
              <p>No posts available yet.</p>
            </div>
          ) : (
            <ul className="card-list">
              {posts.map((post) => (
                <li key={post.id} className="card">
                  <h3 className="card-title">
                    <Link href={`/posts/${post.slug}`}>{post.title}</Link>
                  </h3>
                  <p className="preview">
                    {post.summary || `${post.body.slice(0, 180)}${post.body.length > 180 ? "..." : ""}`}
                  </p>
                  <div className="toolbar" style={{ marginBottom: 0 }}>
                    {DISTRIBUTION_FORMATS.map((format) => (
                      <form key={format.id} action="/studio/generate" method="post">
                        <input type="hidden" name="sourceType" value="post" />
                        <input type="hidden" name="sourceId" value={post.id} />
                        <input type="hidden" name="format" value={format.id} />
                        <button type="submit" className="button-link secondary">
                          Generate {format.label}
                        </button>
                      </form>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section style={{ marginTop: "2rem" }}>
          <h2 className="trading-section-title">Repurpose Trading Sessions</h2>
          {tradingSessions.length === 0 ? (
            <div className="card">
              <p>No trading sessions available yet.</p>
            </div>
          ) : (
            <ul className="card-list">
              {tradingSessions.map((tradingSession) => (
                <li key={tradingSession.id} className="card">
                  <h3 className="card-title">
                    <Link href={`/trading/${tradingSession.slug}`}>
                      {tradingSession.title}
                    </Link>
                  </h3>
                  <p className="meta">
                    {tradingSession.market} · {tradingSession.timeframe} ·{" "}
                    {tradingSession.setupType}
                  </p>
                  <p className="preview">{tradingSession.summary}</p>
                  <div className="toolbar" style={{ marginBottom: 0 }}>
                    {DISTRIBUTION_FORMATS.map((format) => (
                      <form
                        key={format.id}
                        action="/studio/generate"
                        method="post"
                      >
                        <input
                          type="hidden"
                          name="sourceType"
                          value="trading_session"
                        />
                        <input
                          type="hidden"
                          name="sourceId"
                          value={tradingSession.id}
                        />
                        <input type="hidden" name="format" value={format.id} />
                        <button type="submit" className="button-link secondary">
                          Generate {format.label}
                        </button>
                      </form>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section style={{ marginTop: "2rem" }}>
          <h2 className="trading-section-title">Generated Assets</h2>
          <ul className="card-list">
            {derivatives.map((asset) => (
              <li key={asset.id} className="card">
                <h3 className="card-title">{asset.title}</h3>
                <p className="meta">
                  {asset.channel} · {asset.format.replaceAll("_", " ")} · status{" "}
                  {asset.status}
                </p>
                <p className="meta">
                  Source: {asset.post?.title || asset.tradingSession?.title || "Unknown"}
                </p>
                <div className="toolbar" style={{ marginBottom: "1rem" }}>
                  <Link
                    href={`/studio/share/${asset.id}`}
                    className="button-link secondary"
                  >
                    Open Share Page
                  </Link>
                </div>
                <pre className="trading-source-chat">{asset.body}</pre>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
