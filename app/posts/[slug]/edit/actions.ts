"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateSummary } from "@/lib/post-summary";
import { redirect } from "next/navigation";

export async function updatePost(formData: FormData) {
  const session = await auth();

  if (!session) {
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
