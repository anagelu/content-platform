import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ensureDefaultCategories } from "@/lib/categories";
import {
  getAiCapacityTier,
  getAiProvider,
  getProviderLabel,
  getTierLabel,
  isAiProviderConfigured,
} from "@/lib/ai-admin";
import { redirect } from "next/navigation";
import { EditPostForm } from "./edit-post-form";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const { slug } = await params;

  const post = await prisma.post.findUnique({
    where: {
      slug,
    },
    include: {
      category: true,
    },
  });

  if (!post) {
    return <div style={{ padding: "2rem" }}>Post not found.</div>;
  }

  await ensureDefaultCategories();

  const [categories, aiDraftEnabled, aiProvider, aiTier] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: "asc" },
    }),
    isAiProviderConfigured(),
    getAiProvider(),
    getAiCapacityTier(),
  ]);

  return (
    <main>
      <div className="site-shell">
        <h1 className="page-title">Edit Post</h1>
        <p className="page-subtitle">
          Refine the source conversation, summary, and final article format.
        </p>

        <EditPostForm
          post={post}
          categories={categories}
          aiDraftEnabled={aiDraftEnabled}
          aiProviderLabel={getProviderLabel(aiProvider)}
          aiTierLabel={getTierLabel(aiTier)}
        />
      </div>
    </main>
  );
}
