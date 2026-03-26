import { auth } from "@/auth";
import {
  getAiCapacityTier,
  getAiProvider,
  getModelForTier,
  getProviderLabel,
  getTierLabel,
  isAiProviderConfigured,
} from "@/lib/ai-admin";
import { getAiUsageSummaryForRange } from "@/lib/ai-usage";
import Link from "next/link";
import { redirect } from "next/navigation";
import { updateAiCapacityTier, updateAiProvider } from "./actions";

export default async function AdminAiPage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role !== "admin") {
    redirect("/");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedRange =
    resolvedSearchParams.range === "today" ||
    resolvedSearchParams.range === "7d" ||
    resolvedSearchParams.range === "30d"
      ? resolvedSearchParams.range
      : "30d";

  const [capacityTier, provider, providerConfigured, aiUsage] = await Promise.all([
    getAiCapacityTier(),
    getAiProvider(),
    isAiProviderConfigured(),
    getAiUsageSummaryForRange(selectedRange),
  ]);

  const activeModel = getModelForTier(capacityTier, provider);

  return (
    <main>
      <div className="site-shell site-shell-wide">
        <h1 className="page-title">Admin AI Control Center</h1>
        <p className="page-subtitle">
          Monitor estimated spend and raise model capacity over time from one
          local admin surface.
        </p>

        <div className="toolbar">
          <Link href="/studio" className="button-link secondary">
            Back to Studio
          </Link>
          <Link href="/admin/ai?range=30d" className="button-link secondary">
            Refresh AI Admin
          </Link>
        </div>

        <section style={{ marginTop: "2rem" }}>
          <h2 className="trading-section-title">Provider</h2>
          <div className="card">
            <p className="preview">
              The active provider is <strong>{getProviderLabel(provider)}</strong>.
              {providerConfigured
                ? " The matching API key is available."
                : " The matching API key is missing."}
            </p>
            <div className="toolbar" style={{ marginTop: "1rem" }}>
              {(["gemini", "openai"] as const).map((providerOption) => (
                <form key={providerOption} action={updateAiProvider}>
                  <input type="hidden" name="provider" value={providerOption} />
                  <button
                    type="submit"
                    className={`button-link${provider === providerOption ? "" : " secondary"}`}
                  >
                    {getProviderLabel(providerOption)}
                  </button>
                </form>
              ))}
            </div>
            <p className="form-help" style={{ marginTop: "1rem" }}>
              Use Gemini or OpenAI behind the same local product flows and cost dashboard.
            </p>
          </div>
        </section>

        <section style={{ marginTop: "2rem" }}>
          <h2 className="trading-section-title">Capacity Tier</h2>
          <div className="card">
            <p className="preview">
              The current admin tier is <strong>{getTierLabel(capacityTier)}</strong>,
              which maps post drafting and journal assist to <strong>{activeModel}</strong>.
            </p>
            <div className="toolbar" style={{ marginTop: "1rem" }}>
              {(["low", "medium", "high"] as const).map((tier) => (
                <form key={tier} action={updateAiCapacityTier}>
                  <input type="hidden" name="tier" value={tier} />
                  <button
                    type="submit"
                    className={`button-link${capacityTier === tier ? "" : " secondary"}`}
                  >
                    {getTierLabel(tier)} · {getModelForTier(tier, provider)}
                  </button>
                </form>
              ))}
            </div>
            <p className="form-help" style={{ marginTop: "1rem" }}>
              `Low` keeps costs minimal, `Medium` improves quality at a modest
              increase, and `High` moves to the full model for heavier drafting.
            </p>
          </div>
        </section>

        <section style={{ marginTop: "2rem" }}>
          <h2 className="trading-section-title">Usage Window</h2>
          <div className="toolbar">
            <Link
              href="/admin/ai?range=today"
              className={`button-link${selectedRange === "today" ? "" : " secondary"}`}
            >
              Today
            </Link>
            <Link
              href="/admin/ai?range=7d"
              className={`button-link${selectedRange === "7d" ? "" : " secondary"}`}
            >
              7d
            </Link>
            <Link
              href="/admin/ai?range=30d"
              className={`button-link${selectedRange === "30d" ? "" : " secondary"}`}
            >
              30d
            </Link>
          </div>
        </section>

        <section style={{ marginTop: "2rem" }}>
          <h2 className="trading-section-title">Estimated Cost</h2>
          <div className="trading-metric-row">
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
          </div>
        </section>

        <section style={{ marginTop: "2rem" }}>
          <h2 className="trading-section-title">By Feature</h2>
          {aiUsage.rows.length === 0 ? (
            <div className="card">
              <p>No tracked AI usage yet for this window.</p>
            </div>
          ) : (
            <div className="card-list">
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
          )}
        </section>

        <section style={{ marginTop: "2rem" }}>
          <h2 className="trading-section-title">Recent Requests</h2>
          {aiUsage.recentEvents.length === 0 ? (
            <div className="card">
              <p>No recent AI requests yet for this window.</p>
            </div>
          ) : (
            <div className="card-list">
              {aiUsage.recentEvents.map((event, index) => (
                <article key={`${event.feature}-${event.createdAt}-${index}`} className="card">
                  <h3 className="card-title">
                    {event.feature.replaceAll("_", " ")} · {event.model}
                  </h3>
                  <p className="meta">{new Date(event.createdAt).toLocaleString()}</p>
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
          )}
        </section>
      </div>
    </main>
  );
}
