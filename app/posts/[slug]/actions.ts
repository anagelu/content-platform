"use server";

import { auth } from "@/auth";
import {
  addCommentReaction,
  addPostReaction,
  createPostComment,
} from "@/lib/post-comments";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

const ALLOWED_REACTIONS = new Set(["👍", "❤️", "🔥", "👏", "😂"]);

export async function deletePost(formData: FormData) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const id = Number(formData.get("id"));

  if (!id) {
    throw new Error("Post ID is required.");
  }

  await prisma.post.delete({
    where: { id },
  });

  redirect("/posts");
}

export async function upvotePost(formData: FormData) {
  const id = Number(formData.get("id"));

  if (!id) {
    throw new Error("Post ID is required.");
  }

  const post = await prisma.post.update({
    where: { id },
    data: {
      votes: {
        increment: 1,
      },
    },
  });

  redirect(`/posts/${post.slug}`);
}

export async function addPostComment(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const postId = Number(formData.get("postId"));
  const slug = formData.get("slug")?.toString() || "";
  const body = formData.get("body")?.toString().trim() || "";
  const parentCommentIdValue = formData.get("parentCommentId");
  const parentCommentId = parentCommentIdValue
    ? Number(parentCommentIdValue)
    : null;

  if (!postId || !slug) {
    throw new Error("Post details are required.");
  }

  if (!body) {
    throw new Error("Comment text is required.");
  }

  if (body.length > 2000) {
    throw new Error("Comments must be 2000 characters or less.");
  }

  const numericUserId = Number(session.user.id);

  await createPostComment({
    postId,
    userId: Number.isFinite(numericUserId) ? numericUserId : null,
    parentCommentId:
      parentCommentId && Number.isFinite(parentCommentId)
        ? parentCommentId
        : null,
    authorName:
      session.user.name?.trim() || session.user.email?.trim() || "Signed-in user",
    body,
  });

  redirect(`/posts/${slug}`);
}

export async function reactToPost(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const postId = Number(formData.get("postId"));
  const slug = formData.get("slug")?.toString() || "";
  const emoji = formData.get("emoji")?.toString() || "";

  if (!postId || !slug || !ALLOWED_REACTIONS.has(emoji)) {
    throw new Error("A valid post reaction is required.");
  }

  const numericUserId = Number(session.user.id);
  const actorKey = session.user.id;

  await addPostReaction({
    postId,
    userId: Number.isFinite(numericUserId) ? numericUserId : null,
    actorKey,
    emoji,
  });

  redirect(`/posts/${slug}`);
}

export async function reactToComment(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const commentId = Number(formData.get("commentId"));
  const slug = formData.get("slug")?.toString() || "";
  const emoji = formData.get("emoji")?.toString() || "";

  if (!commentId || !slug || !ALLOWED_REACTIONS.has(emoji)) {
    throw new Error("A valid comment reaction is required.");
  }

  const numericUserId = Number(session.user.id);
  const actorKey = session.user.id;

  await addCommentReaction({
    commentId,
    userId: Number.isFinite(numericUserId) ? numericUserId : null,
    actorKey,
    emoji,
  });

  redirect(`/posts/${slug}`);
}

export async function saveInlinePostDraft(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const id = Number(formData.get("id"));
  const slug = formData.get("slug")?.toString() || "";
  const body = formData.get("body")?.toString().trim() || "";

  if (!id || !slug || !body) {
    throw new Error("Post ID, slug, and body are required.");
  }

  const updatedPost = await prisma.post.update({
    where: { id },
    data: {
      body,
    },
  });

  return {
    updatedAt: updatedPost.updatedAt.toISOString(),
  };
}
