"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateSummary } from "@/lib/post-summary";
import { redirect } from "next/navigation";

export async function updatePost(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const id = Number(formData.get("id"));
  const title = formData.get("title")?.toString().trim() || "";
  const summaryValue = formData.get("summary")?.toString().trim() || "";
  const content = formData.get("content")?.toString().trim() || "";
  const sourceChat = formData.get("sourceChat")?.toString().trim() || "";
  const categoryIdValue = formData.get("categoryId")?.toString() || "";

  if (!id || !title || !content) {
    throw new Error("Post ID, title, and content are required.");
  }

  const existingPost = await prisma.post.findUnique({
    where: { id },
  });

  if (!existingPost) {
    throw new Error("Post not found.");
  }

  const userId = Number(session.user.id);
  const isAdmin = session.user.role === "admin";

  if (!isAdmin && existingPost.authorId !== userId) {
    throw new Error("You do not have permission to edit this post.");
  }

  const post = await prisma.post.update({
    where: { id },
    data: {
      title,
      summary: summaryValue || generateSummary(content),
      body: content,
      sourceChat: sourceChat || null,
      categoryId: categoryIdValue ? Number(categoryIdValue) : null,
    },
  });

  redirect(`/posts/${post.slug}`);
}
