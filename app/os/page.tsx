import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { listMessageInboxItems } from "@/lib/message-inbox";
import { buildConversationOsSnapshot } from "@/lib/conversation-os";

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function ConversationOsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const inboxItems = await listMessageInboxItems(Number(session.user.id));
  const osSnapshot = buildConversationOsSnapshot(inboxItems);

  return (
    <main>
      <div className="site-shell site-shell-wide">
        <h1 className="page-title">Conversation OS</h1>
        <p className="page-subtitle">
          A first-pass operating system for imported AI conversations: dedupe-aware
          ingestion, theme discovery, and output pipelines for posts, books,
          websites, research hubs, and media concepts.
        </p>

        <div className="toolbar">
          <Link href="/inbox/messages" className="button-link">
            Open Message Inbox
          </Link>
          <Link href="/posts/new" className="button-link secondary">
            Create New Post
          </Link>
          <Link href="/studio" className="button-link secondary">
            Open Studio
          </Link>
        </div>

        <section className="trading-hero-card" style={{ marginTop: "2rem" }}>
          <h2 className="trading-section-title">OS Layer</h2>
          <p>
            The inbox is the ingestion layer. Conversation OS sits above it and
            turns imported chat history into structured themes and output paths.
            This foundation is where we can later add incremental sync, semantic
            dedupe, entity extraction, books, custom websites, and media pipelines.
          </p>
        </section>

        <section style={{ marginTop: "2rem" }}>
          <h2 className="trading-section-title">System Snapshot</h2>
          <div className="trading-metric-row" style={{ marginTop: "1rem" }}>
            <div className="trading-metric-card">
              <span className="trading-metric-label">Imported conversations</span>
              <strong>{osSnapshot.totalConversations}</strong>
            </div>
            <div className="trading-metric-card">
              <span className="trading-metric-label">Distinct sources</span>
              <strong>{osSnapshot.totalSources}</strong>
            </div>
            <div className="trading-metric-card">
              <span className="trading-metric-label">Unique fingerprints</span>
              <strong>{osSnapshot.dedupeProtectedCount}</strong>
            </div>
            <div className="trading-metric-card">
              <span className="trading-metric-label">Theme clusters</span>
              <strong>{osSnapshot.themes.length}</strong>
            </div>
          </div>
        </section>

        <section style={{ marginTop: "2rem" }}>
          <h2 className="trading-section-title">Output Pipelines</h2>
          <div className="card-list">
            {osSnapshot.outputs.map((output) => (
              <article key={output.type} className="card">
                <h3 className="card-title">{output.label}</h3>
                <p className="meta">Candidate count {output.count}</p>
                <p className="preview">{output.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section style={{ marginTop: "2rem" }}>
          <h2 className="trading-section-title">Detected Themes</h2>
          {osSnapshot.themes.length === 0 ? (
            <div className="card">
              <p className="meta">
                No imported conversations yet. Start by saving a few chats into
                the inbox and the OS will begin clustering them here.
              </p>
            </div>
          ) : (
            <ul className="card-list">
              {osSnapshot.themes.map((theme) => (
                <li key={theme.name} className="card">
                  <h3 className="card-title">{theme.name}</h3>
                  <p className="meta">
                    {theme.count} conversation{theme.count === 1 ? "" : "s"} · latest{" "}
                    {formatTimestamp(theme.latestUpdatedAt)}
                  </p>
                  <p className="preview">Latest thread: {theme.latestTitle}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section style={{ marginTop: "2rem" }}>
          <h2 className="trading-section-title">Source Threads</h2>
          {inboxItems.length === 0 ? (
            <div className="card">
              <p className="meta">
                Your OS is ready, but it needs source material. Import a
                conversation in the inbox to start building memory and outputs.
              </p>
            </div>
          ) : (
            <ul className="card-list">
              {inboxItems.slice(0, 12).map((item) => (
                <li key={item.id} className="card">
                  <h3 className="card-title">{item.title}</h3>
                  <p className="meta">
                    {item.sourceLabel || "Imported"} · fingerprint{" "}
                    {item.contentHash.slice(0, 12)} · updated {formatTimestamp(item.updatedAt)}
                  </p>
                  {item.summary ? <p className="preview">{item.summary}</p> : null}
                  <div className="toolbar" style={{ marginBottom: 0 }}>
                    <Link href={`/posts/new?inboxId=${item.id}`} className="button-link secondary">
                      Draft Post
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
