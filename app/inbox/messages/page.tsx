import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  listDirectMessageCandidates,
  listDirectMessageThreads,
} from "@/lib/direct-messages";
import {
  listMessageInboxItems,
} from "@/lib/message-inbox";
import { importMessageInboxItem, removeMessageInboxItem, startDirectMessageThread } from "./actions";

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function MessageInboxPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const inboxItems = await listMessageInboxItems(Number(session.user.id));
  const directThreads = await listDirectMessageThreads(Number(session.user.id));
  const directCandidates = await listDirectMessageCandidates(Number(session.user.id));

  return (
    <main>
      <div className="site-shell site-shell-wide">
        <h1 className="page-title">Message Inbox</h1>
        <p className="page-subtitle">
          Bring AI conversations into the site, keep them as reusable source
          material, and turn them into posts when an idea is ready to move.
        </p>

        <div className="toolbar">
          <Link href="/inbox/messages" className="button-link">
            Peer Messages
          </Link>
          <Link href="/posts/new" className="button-link secondary">
            Create Post Directly
          </Link>
          <Link href="/posts" className="button-link secondary">
            Browse Posts
          </Link>
        </div>

        <section className="form-card">
          <div className="form-callout">
            <h2 className="form-callout-title">Peer Messaging</h2>
            <p className="form-callout-text">
              Start a direct conversation with another Pattern Foundry user, keep the thread inside the site, and continue it from a dedicated conversation view.
            </p>
          </div>

          <div className="trading-grid">
            <form action={startDirectMessageThread} className="card" style={{ margin: 0 }}>
              <h3 className="card-title" style={{ marginBottom: "0.85rem" }}>
                Start a conversation
              </h3>
              <div className="form-group">
                <label htmlFor="recipientId" className="form-label">
                  Recipient
                </label>
                <select id="recipientId" name="recipientId" className="form-input" defaultValue="">
                  <option value="" disabled>
                    Select a user
                  </option>
                  {directCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {(candidate.name?.trim() || candidate.username) + (candidate.email ? ` · ${candidate.email}` : "")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="peerSubject" className="form-label">
                  Subject
                </label>
                <input
                  id="peerSubject"
                  name="subject"
                  type="text"
                  className="form-input"
                  placeholder="Optional conversation subject"
                />
              </div>
              <div className="form-group">
                <label htmlFor="peerBody" className="form-label">
                  Message
                </label>
                <textarea
                  id="peerBody"
                  name="body"
                  rows={6}
                  className="form-textarea form-textarea-compact"
                  placeholder="Write your message..."
                />
              </div>
              <button type="submit" className="submit-button">
                Send Message
              </button>
            </form>

            <div className="card" style={{ margin: 0 }}>
              <h3 className="card-title" style={{ marginBottom: "0.85rem" }}>
                Conversations
              </h3>
              {directThreads.length === 0 ? (
                <p className="meta" style={{ marginBottom: 0 }}>
                  No peer conversations yet. Start one from the form and it will show up here.
                </p>
              ) : (
                <ul className="card-list" style={{ margin: 0 }}>
                  {directThreads.map((thread) => (
                    <li key={thread.id} className="card" style={{ margin: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: "1rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ flex: "1 1 320px" }}>
                          <h4 className="card-title" style={{ marginBottom: "0.35rem" }}>
                            {thread.counterpartLabel}
                          </h4>
                          <p className="meta">
                            {thread.subject?.trim() || "Direct conversation"} · updated {formatTimestamp(thread.lastMessageAt.toISOString())}
                          </p>
                          <p className="preview" style={{ marginBottom: 0 }}>
                            {thread.lastMessage?.body || "No messages yet."}
                          </p>
                        </div>
                        <div style={{ display: "grid", gap: "0.65rem", minWidth: "180px" }}>
                          {thread.unreadCount > 0 ? (
                            <span className="badge">{thread.unreadCount} unread</span>
                          ) : null}
                          <Link href={`/inbox/messages/${thread.id}`} className="button-link">
                            Open Conversation
                          </Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className="form-card">
          <div className="form-callout">
            <h2 className="form-callout-title">Import Conversation</h2>
            <p className="form-callout-text">
              Paste a thread or upload a text-based export. This first version
              is import-first, so the inbox becomes your bridge from chat into
              publishing.
            </p>
          </div>

          <form action={importMessageInboxItem}>
            <div className="trading-grid">
              <div className="form-group">
                <label htmlFor="title" className="form-label">
                  Title
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  className="form-input"
                  placeholder="Optional title for this conversation"
                />
              </div>

              <div className="form-group">
                <label htmlFor="sourceLabel" className="form-label">
                  Source
                </label>
                <input
                  id="sourceLabel"
                  name="sourceLabel"
                  type="text"
                  className="form-input"
                  placeholder="ChatGPT, Claude export, pasted notes, Slack thread..."
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="conversation" className="form-label">
                Conversation
              </label>
              <textarea
                id="conversation"
                name="conversation"
                rows={12}
                className="form-textarea"
                placeholder="Paste the raw AI conversation here..."
              />
            </div>

            <div className="form-group">
              <label htmlFor="conversationFile" className="form-label">
                Upload conversation file
              </label>
              <input
                id="conversationFile"
                name="conversationFile"
                type="file"
                accept=".txt,.md,.json,.csv"
                className="form-input"
              />
              <p className="form-help">
                Optional. If both pasted text and a file are provided, the pasted
                conversation takes priority.
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="authorNotes" className="form-label">
                Why this matters
              </label>
              <textarea
                id="authorNotes"
                name="authorNotes"
                rows={5}
                className="form-textarea form-textarea-compact"
                placeholder="Why do you want to keep this conversation, and what do you want to turn it into later?"
              />
            </div>

            <button type="submit" className="submit-button">
              Save To Inbox
            </button>
          </form>
        </section>

        <section style={{ marginTop: "2rem" }}>
          <h2 className="trading-section-title">Saved Conversations</h2>
          {inboxItems.length === 0 ? (
            <div className="card">
              <p className="meta">
                No conversations saved yet. Import one above and it will show
                up here as reusable post source material.
              </p>
            </div>
          ) : (
            <ul className="card-list">
              {inboxItems.map((item) => (
                <li key={item.id} className="card">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "1rem",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ flex: "1 1 520px" }}>
                      <h3 className="card-title">{item.title}</h3>
                      <p className="meta">
                        {item.sourceLabel || "Imported conversation"} · saved{" "}
                        {formatTimestamp(item.createdAt)}
                      </p>
                      {item.summary ? (
                        <p className="preview" style={{ marginBottom: "0.75rem" }}>
                          {item.summary}
                        </p>
                      ) : null}
                      <p className="meta" style={{ whiteSpace: "pre-wrap" }}>
                        {item.conversation.slice(0, 500)}
                        {item.conversation.length > 500 ? "..." : ""}
                      </p>
                      {item.authorNotes ? (
                        <p className="meta" style={{ marginTop: "0.75rem" }}>
                          Note: {item.authorNotes}
                        </p>
                      ) : null}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: "0.75rem",
                        minWidth: "220px",
                      }}
                    >
                      <Link
                        href={`/posts/new?inboxId=${item.id}`}
                        className="button-link"
                      >
                        Create Post Draft
                      </Link>
                      <form action={removeMessageInboxItem}>
                        <input type="hidden" name="id" value={item.id} />
                        <button type="submit" className="button-link secondary">
                          Remove From Inbox
                        </button>
                      </form>
                    </div>
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
