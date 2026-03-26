"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateSummary } from "@/lib/post-summary";
import { generateUniqueSlug } from "@/lib/slugify";
import { redirect } from "next/navigation";

export async function createPost(formData: FormData) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const title = formData.get("title")?.toString().trim() || "";
  const summaryValue = formData.get("summary")?.toString().trim() || "";
  const content = formData.get("content")?.toString().trim() || "";
  const sourceChat = formData.get("sourceChat")?.toString().trim() || "";
  const categoryIdValue = formData.get("categoryId")?.toString() || "";

  if (!title || !content) {
    throw new Error("Title and content are required.");
  }

  const slug = await generateUniqueSlug(title);

  const post = await prisma.post.create({
    data: {
      title,
      slug,
      summary: summaryValue || generateSummary(content),
      body: content,
      sourceChat: sourceChat || null,
      categoryId: categoryIdValue ? Number(categoryIdValue) : null,
    },
  });

  redirect(`/posts/${post.slug}`);
}
