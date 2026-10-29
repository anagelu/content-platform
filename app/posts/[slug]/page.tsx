import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site-url";
import {
  type PostComment,
  listPostComments,
  listPostReactionCounts,
} from "@/lib/post-comments";
import Link from "next/link";
import {
  addPostComment,
  deletePost,
  reactToComment,
  reactToPost,
  setPostVisibility,
  upvotePost,
} from "./actions";
import { auth } from "@/auth";
import { PostDraftWorkspace } from "./post-draft-workspace";
import { SharePlatformButtons } from "@/app/share-platform-buttons";

import type { ReactNode } from "react";

const REACTION_OPTIONS = ["👍", "❤️", "🔥", "👏", "😂"] as const;

function buildPostDescription(post: { summary: string | null; body: string }) {
  const trimmedSummary = post.summary?.trim();
  if (trimmedSummary) {
    return trimmedSummary;
  }

  const plainBody = post.body.replace(/\s+/g, " ").trim();
  return plainBody.length > 160 ? `${plainBody.slice(0, 160)}...` : plainBody;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const session = await auth();
  const post = await prisma.post.findUnique({
    where: { slug },
    select: {
      title: true,
      summary: true,
      body: true,
      slug: true,
      isPublic: true,
      authorId: true,
    },
  });

  if (!post) {
    return { title: "Post not found" };
  }

  const viewerId = session?.user?.id ? Number(session.user.id) : null;
  const canManage =
    session?.user?.role === "admin" ||
    (viewerId !== null && post.authorId === viewerId);

  if (!post.isPublic && !canManage) {
    return { title: "Private post", robots: { index: false, follow: false } };
  }

  const description = buildPostDescription(post);
  const url = `/posts/${post.slug}`;

  return {
    title: post.title,
    description,
    alternates: { canonical: url },
    robots: post.isPublic ? undefined : { index: false, follow: false },
    openGraph: {
      type: "article",
      title: post.title,
      description,
      url,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  const { slug } = await params;

  const post = await prisma.post.findUnique({
    where: {
      slug,
    },
    include: {
      category: true,
      author: true,
    },
  });

  if (!post) {
    return (
      <main>
        <div className="site-shell">
          <div className="card">
            <h2 className="page-title">Post not found</h2>
            <Link href="/posts" className="button-link">
              Back to Posts
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const userId = session?.user?.id ? Number(session.user.id) : null;
  const isAdmin = session?.user?.role === "admin";
  const isAuthor = userId !== null && post.authorId === userId;
  const canModerate = isAdmin || isAuthor;
  const canView = Boolean(post.isPublic || canModerate);

  if (!canView) {
    return (
      <main>
        <div className="site-shell">
          <div className="card">
            <h1 className="page-title">This post is private</h1>
            <div className="toolbar" style={{ marginBottom: 0 }}>
              <Link href="/posts" className="button-link secondary">
                Back to Posts
              </Link>
              <Link href="/login" className="button-link">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const comments = await listPostComments(post.id);
  const reactions = await listPostReactionCounts(post.id);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: buildPostDescription(post),
    datePublished: post.createdAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    url: `${SITE_URL}/posts/${post.slug}`,
    author: { "@type": "Organization", name: "Pattern Foundry" },
    publisher: { "@type": "Organization", name: "Pattern Foundry" },
    ...(post.category ? { articleSection: post.category.name } : {}),
  };

  return (
    <main>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <div className="site-shell">
        <article className="article-card">
          <h1 className="article-title">{post.title}</h1>

          <p className="meta article-meta">
            By {post.author?.name ?? post.author?.username ?? "Pattern Foundry"}
            {post.isPublic ? "" : " · Private"}
          </p>

          <p className="meta article-meta">
            Published: {new Date(post.createdAt).toLocaleDateString()}
          </p>

          <p className="meta article-meta">
            Last updated: {new Date(post.updatedAt).toLocaleDateString()}
          </p>

          <p className="meta article-meta" style={{ fontWeight: 600 }}>
            Votes: {post.votes}
          </p>

          {post.category && (
            <div className="badge-row">
              <Link href={`/categories/${encodeURIComponent(post.category.name)}`}>
                <span className="badge">{post.category.name}</span>
              </Link>
            </div>
          )}

          <div className="article-actions">
            <Link href="/posts" className="button-link secondary">
              Back to Posts
            </Link>

            <form action={upvotePost}>
              <input type="hidden" name="id" value={post.id} />
              <button type="submit" className="submit-button">
                ▲ Upvote
              </button>
            </form>

            {canModerate ? (
              <>
                <form action={setPostVisibility}>
                  <input type="hidden" name="id" value={post.id} />
                  <input
                    type="hidden"
                    name="isPublic"
                    value={post.isPublic ? "false" : "true"}
                  />
                  <button type="submit" className="button-link secondary">
                    {post.isPublic ? "Make Private" : "Make Public"}
                  </button>
                </form>

                <Link
                  href={`/posts/${post.slug}/edit`}
                  className="button-link secondary article-admin-button"
                >
                  Edit
                </Link>
              </>
            ) : null}

            {isAuthor ? (
              <form action={deletePost}>
                <input type="hidden" name="id" value={post.id} />
                <button type="submit" className="delete-button article-admin-delete">
                  Delete
                </button>
              </form>
            ) : null}
          </div>

          <SharePlatformButtons title={post.title} summary={post.summary} />

          <div className="reaction-row">
            <p className="form-help" style={{ margin: 0 }}>
              React to this post
            </p>
            <div className="reaction-list">
              {REACTION_OPTIONS.map((emoji) => {
                const existing = reactions.find((reaction) => reaction.emoji === emoji);

                return (
                  <form key={emoji} action={reactToPost}>
                    <input type="hidden" name="postId" value={post.id} />
                    <input type="hidden" name="slug" value={post.slug} />
                    <input type="hidden" name="emoji" value={emoji} />
                    <button type="submit" className="reaction-button">
                      <span>{emoji}</span>
                      <span>{existing?.count ?? 0}</span>
                    </button>
                  </form>
                );
              })}
            </div>
          </div>

          <PostDraftWorkspace
            id={post.id}
            slug={post.slug}
            title={post.title}
            summary={post.summary}
            body={post.body}
            sourceChat={post.sourceChat}
            authorNotes={null}
            canManage={canModerate}
          />

          <section className="comments-section">
            <div className="comments-header">
              <h2 className="comments-title">Comments</h2>
              <p className="form-help">
                {countComments(comments)} comment{countComments(comments) === 1 ? "" : "s"}
              </p>
            </div>

            {session ? (
              <form action={addPostComment} className="form-card comments-form">
                <input type="hidden" name="postId" value={post.id} />
                <input type="hidden" name="slug" value={post.slug} />
                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label htmlFor="body" className="form-label">
                    Add a comment
                  </label>
                  <textarea
                    id="body"
                    name="body"
                    rows={4}
                    maxLength={2000}
                    className="form-textarea form-textarea-compact"
                    placeholder="Share a question, reaction, or follow-up thought."
                  />
                </div>
                <button type="submit" className="submit-button">
                  Post Comment
                </button>
              </form>
            ) : (
              <div className="form-callout" style={{ marginTop: "2rem" }}>
                <h2 className="form-callout-title">Join the discussion</h2>
                <p className="form-callout-text">
                  Sign in to leave a comment on this post.
                </p>
                <Link href="/login" className="button-link">
                  Sign In
                </Link>
              </div>
            )}

            {comments.length === 0 ? (
              <div className="card" style={{ marginTop: "1.5rem" }}>
                <p className="form-help" style={{ marginBottom: 0 }}>
                  No comments yet. Start the conversation.
                </p>
              </div>
            ) : (
              <div className="card-list comments-list">
                {comments.map((comment) => renderCommentThread(comment, post.slug, Boolean(session)))}
              </div>
            )}
          </section>
        </article>
      </div>
    </main>
  );
}

function countComments(comments: PostComment[]): number {
  return comments.reduce(
    (total, comment) => total + 1 + countComments(comment.replies),
    0,
  );
}

function renderCommentThread(
  comment: PostComment,
  slug: string,
  canReply: boolean,
): ReactNode {
  return (
    <article key={comment.id} className="card comment-card">
      <div className="comments-header">
        <h3 className="comment-author">{comment.authorName}</h3>
        <p className="meta" style={{ margin: 0 }}>
          {new Date(comment.createdAt).toLocaleString()}
        </p>
      </div>

      <p className="comment-body">{comment.body}</p>

      <div className="reaction-list">
        {REACTION_OPTIONS.map((emoji) => {
          const existing = comment.reactions.find((reaction) => reaction.emoji === emoji);

          return (
            <form key={`${comment.id}-${emoji}`} action={reactToComment}>
              <input type="hidden" name="commentId" value={comment.id} />
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="emoji" value={emoji} />
              <button type="submit" className="reaction-button reaction-button-subtle">
                <span>{emoji}</span>
                <span>{existing?.count ?? 0}</span>
              </button>
            </form>
          );
        })}
      </div>

      {canReply ? (
        <form action={addPostComment} className="comment-reply-form">
          <input type="hidden" name="postId" value={comment.postId} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="parentCommentId" value={comment.id} />
          <div className="form-group" style={{ marginBottom: "0.75rem" }}>
            <label htmlFor={`reply-${comment.id}`} className="form-label">
              Reply
            </label>
            <textarea
              id={`reply-${comment.id}`}
              name="body"
              rows={3}
              maxLength={2000}
              className="form-textarea form-textarea-compact"
              placeholder="Write a reply..."
            />
          </div>
          <button type="submit" className="button-link secondary">
            Reply
          </button>
        </form>
      ) : null}

      {comment.replies.length > 0 ? (
        <div className="comment-replies">
          {comment.replies.map((reply) => renderCommentThread(reply, slug, canReply))}
        </div>
      ) : null}
    </article>
  );
}
