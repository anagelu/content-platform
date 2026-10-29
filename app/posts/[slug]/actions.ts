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

  if (!session?.user?.id) {
    redirect("/login");
  }

  const id = Number(formData.get("id"));

  if (!id) {
    throw new Error("Post ID is required.");
  }

  const post = await prisma.post.findUnique({
    where: { id },
  });

  if (!post) {
    redirect("/posts");
  }

  const userId = Number(session.user.id);

  if (post.authorId !== userId) {
    throw new Error("You do not have permission to delete this post.");
  }

  await prisma.post.delete({
    where: { id },
  });

  redirect("/posts");
}

export async function setPostVisibility(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const id = Number(formData.get("id"));
  const nextVisibility = formData.get("isPublic")?.toString() === "true";

  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Post ID is required.");
  }

  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, slug: true, authorId: true },
  });

  if (!post) {
    throw new Error("Post not found.");
  }

  const userId = Number(session.user.id);
  const isAdmin = session.user.role === "admin";

  if (!isAdmin && post.authorId !== userId) {
    throw new Error("You do not have permission to change this post's visibility.");
  }

  await prisma.post.update({
    where: { id },
    data: {
      isPublic: nextVisibility,
    },
  });

  redirect(`/posts/${post.slug}`);
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
  const summaryValue = formData.get("summary");
  const summary =
    typeof summaryValue === "string" ? summaryValue.trim() : undefined;

  if (!id || !slug || !body) {
    throw new Error("Post ID, slug, and body are required.");
  }

  const existingPost = await prisma.post.findUnique({
    where: { id },
    select: { authorId: true },
  });

  if (!existingPost) {
    throw new Error("Post not found.");
  }

  const draftUserId = Number(session.user.id);
  const isDraftAdmin = session.user.role === "admin";

  if (!isDraftAdmin && existingPost.authorId !== draftUserId) {
    throw new Error("You do not have permission to edit this post.");
  }

  const updatedPost = await prisma.post.update({
    where: { id },
    data: {
      body,
      ...(summary !== undefined ? { summary: summary || null } : {}),
    },
  });

  return {
    updatedAt: updatedPost.updatedAt.toISOString(),
  };
}
