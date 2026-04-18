import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDirectMessageThread, markDirectThreadRead } from "@/lib/direct-messages";
import { sendDirectMessageReply } from "../actions";

function formatTimestamp(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export default async function DirectMessageThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = Number(session.user.id);
  const { threadId } = await params;
  const threadIdNumber = Number(threadId);

  if (!Number.isFinite(threadIdNumber) || threadIdNumber <= 0) {
    redirect("/inbox/messages");
  }

  const thread = await getDirectMessageThread(userId, threadIdNumber);

  if (!thread) {
    redirect("/inbox/messages");
  }

  await markDirectThreadRead(userId, threadIdNumber);

  return (
    <main>
      <div className="site-shell site-shell-wide">
        <h1 className="page-title">{thread.counterpartLabel}</h1>
        <p className="page-subtitle">
          {thread.subject?.trim() || "Direct conversation"} · Continue the thread and keep everything inside the inbox.
        </p>

        <div className="toolbar">
          <Link href="/inbox/messages" className="button-link secondary">
            Back to Inbox
          </Link>
        </div>

        <section className="form-card">
          <div className="form-callout">
            <h2 className="form-callout-title">Conversation</h2>
            <p className="form-callout-text">
              Messages are ordered oldest to newest so the thread reads like a single running exchange.
            </p>
          </div>

          <div className="card-list" style={{ marginBottom: "1.25rem" }}>
            {thread.messages.map((message) => {
              const isOwn = message.senderId === userId;

              return (
                <article
                  key={message.id}
                  className="card"
                  style={{
                    margin: 0,
                    background: isOwn ? "linear-gradient(180deg, rgba(239,246,255,0.98), rgba(219,234,254,0.92))" : undefined,
                    borderColor: isOwn ? "rgba(96,165,250,0.35)" : undefined,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "1rem",
                      alignItems: "flex-start",
                      marginBottom: "0.65rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <strong>{isOwn ? "You" : message.sender.name?.trim() || message.sender.username}</strong>
                    <span className="meta">{formatTimestamp(message.createdAt)}</span>
                  </div>
                  <p className="preview" style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>
                    {message.body}
                  </p>
                </article>
              );
            })}
          </div>

          <form action={sendDirectMessageReply}>
            <input type="hidden" name="threadId" value={thread.id} />
            <div className="form-group">
              <label htmlFor="replyBody" className="form-label">
                Reply
              </label>
              <textarea
                id="replyBody"
                name="body"
                rows={6}
                className="form-textarea"
                placeholder="Write your reply..."
              />
            </div>
            <button type="submit" className="submit-button">
              Send Reply
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
